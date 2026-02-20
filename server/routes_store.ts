import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './db.js'

export type RouteProvider = 'ollama' | 'openai_compat' | 'openclaw'

export type RouteConfig = {
  number: string // up to 11 digits
  label: string
  provider: RouteProvider
  model: string
  // per-route TTS voice (provider-specific id)
  voiceId?: string
  // for openai_compat/openclaw
  baseUrl?: string
  apiKey?: string
  // for openclaw
  agentId?: string
  // optional contact avatar (url under /public or remote)
  avatarUrl?: string
}

// Legacy JSON store (one-time migration)
const LEGACY_STORE_PATH = process.env.ROUTES_PATH || path.resolve(process.cwd(), 'routes.json')

function loadRoutesFromLegacyJson(): RouteConfig[] {
  try {
    const raw = fs.readFileSync(LEGACY_STORE_PATH, 'utf8')
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j as RouteConfig[]
    if (Array.isArray(j?.routes)) return j.routes as RouteConfig[]
  } catch {}
  return []
}

export function loadRoutes(): RouteConfig[] {
  const db = getDb()
  const rows = db
    .prepare(
      'select number, label, provider, model, voiceId, baseUrl, apiKey, agentId, avatarUrl from routes order by label asc'
    )
    .all() as any[]

  if (rows.length > 0) return rows.map(normalizeRoute)

  // Migration path: if DB is empty, import legacy JSON once.
  const legacy = normalizeRoutes(loadRoutesFromLegacyJson())
  if (legacy.length > 0) {
    saveRoutes(legacy)
    return legacy
  }

  return []
}

export function saveRoutes(routes: RouteConfig[]) {
  const db = getDb()
  const now = Date.now()
  const tx = db.transaction((rs: RouteConfig[]) => {
    db.prepare('delete from routes').run()
    const ins = db.prepare(`
      insert into routes (number, label, provider, model, voiceId, baseUrl, apiKey, agentId, avatarUrl, updatedAt)
      values (@number, @label, @provider, @model, @voiceId, @baseUrl, @apiKey, @agentId, @avatarUrl, @updatedAt)
    `)

    for (const r of rs) {
      ins.run({
        number: r.number,
        label: r.label,
        provider: r.provider,
        model: r.model,
        voiceId: r.voiceId ?? null,
        baseUrl: r.baseUrl ?? null,
        apiKey: r.apiKey ?? null,
        agentId: r.agentId ?? null,
        avatarUrl: r.avatarUrl ?? null,
        updatedAt: now,
      })
    }
  })

  tx(normalizeRoutes(routes))
}

function normalizeRoute(r: any): RouteConfig {
  const number = String(r?.number ?? '').trim()
  const p = String(r?.provider ?? '').trim()
  const provider = (p === 'openai_compat' || p === 'openclaw') ? (p as RouteProvider) : 'ollama'

  return {
    number,
    label: String(r?.label ?? number),
    provider,
    model: String(r?.model ?? ''),
    voiceId: String(r?.voiceId ?? '').trim() || undefined,
    // baseUrl is valid for all providers:
    // - ollama: optional remote Ollama URL
    // - openai_compat/openclaw: OpenAI-style base
    baseUrl: String(r?.baseUrl ?? '').trim() || undefined,
    apiKey: (provider === 'openai_compat' || provider === 'openclaw') ? String(r?.apiKey ?? '').trim() || undefined : undefined,
    agentId: provider === 'openclaw' ? String(r?.agentId ?? '').trim() || undefined : undefined,
    avatarUrl: String(r?.avatarUrl ?? '').trim() || undefined,
  }
}

export function normalizeRoutes(routes: RouteConfig[]): RouteConfig[] {
  const seen = new Set<string>()
  const out: RouteConfig[] = []
  for (const r of routes || []) {
    const number = String((r as any)?.number ?? '').trim()
    if (!/^\d{1,11}$/.test(number)) continue
    if (seen.has(number)) continue
    seen.add(number)

    const nr = normalizeRoute({ ...r, number })
    if (!nr.model) continue
    if (!nr.label) nr.label = number

    out.push(nr)
  }
  return out
}
