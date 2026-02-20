import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './db.js'

export type TtsProvider = 'inworld' | 'elevenlabs' | 'openai' | 'kittentts'

export type TtsConfig = {
  provider: TtsProvider
  // Inworld
  inworldApiKey?: string
  inworldVoiceId?: string
  inworldModelId?: string
  // ElevenLabs
  elevenlabsApiKey?: string
  elevenlabsVoiceId?: string
  elevenlabsModelId?: string
  // OpenAI
  openaiApiKey?: string
  openaiBaseUrl?: string
  openaiModelId?: string
  openaiVoiceId?: string
  // KittenTTS (local)
  kittenModelId?: string
  kittenVoiceId?: string
  kittenPythonBin?: string
}

// Legacy JSON store (one-time migration)
const LEGACY_STORE_PATH = process.env.TTS_PATH || path.resolve(process.cwd(), 'tts.json')

function loadFromLegacyJson(): any {
  try {
    const raw = fs.readFileSync(LEGACY_STORE_PATH, 'utf8')
    const j = JSON.parse(raw)
    if (j && typeof j === 'object') return j
  } catch {}
  return null
}

export function loadTts(): TtsConfig {
  const db = getDb()
  const row = db.prepare('select * from tts_config where id = 1').get() as any
  if (row) return normalizeTts(row)

  const legacy = loadFromLegacyJson()
  if (legacy) {
    const cfg = normalizeTts(legacy)
    saveTts(cfg)
    return cfg
  }

  return { provider: 'inworld' }
}

export function saveTts(cfg: TtsConfig) {
  const db = getDb()
  const now = Date.now()
  const n = normalizeTts(cfg)

  db.prepare(`
    insert into tts_config (
      id, provider,
      inworldApiKey, inworldVoiceId, inworldModelId,
      elevenlabsApiKey, elevenlabsVoiceId, elevenlabsModelId,
      openaiApiKey, openaiBaseUrl, openaiModelId, openaiVoiceId,
      kittenModelId, kittenVoiceId, kittenPythonBin,
      updatedAt
    ) values (
      1, @provider,
      @inworldApiKey, @inworldVoiceId, @inworldModelId,
      @elevenlabsApiKey, @elevenlabsVoiceId, @elevenlabsModelId,
      @openaiApiKey, @openaiBaseUrl, @openaiModelId, @openaiVoiceId,
      @kittenModelId, @kittenVoiceId, @kittenPythonBin,
      @updatedAt
    )
    on conflict(id) do update set
      provider=excluded.provider,
      inworldApiKey=excluded.inworldApiKey,
      inworldVoiceId=excluded.inworldVoiceId,
      inworldModelId=excluded.inworldModelId,
      elevenlabsApiKey=excluded.elevenlabsApiKey,
      elevenlabsVoiceId=excluded.elevenlabsVoiceId,
      elevenlabsModelId=excluded.elevenlabsModelId,
      openaiApiKey=excluded.openaiApiKey,
      openaiBaseUrl=excluded.openaiBaseUrl,
      openaiModelId=excluded.openaiModelId,
      openaiVoiceId=excluded.openaiVoiceId,
      kittenModelId=excluded.kittenModelId,
      kittenVoiceId=excluded.kittenVoiceId,
      kittenPythonBin=excluded.kittenPythonBin,
      updatedAt=excluded.updatedAt
  `).run({
    provider: n.provider,
    inworldApiKey: n.inworldApiKey ?? null,
    inworldVoiceId: n.inworldVoiceId ?? null,
    inworldModelId: n.inworldModelId ?? null,
    elevenlabsApiKey: n.elevenlabsApiKey ?? null,
    elevenlabsVoiceId: n.elevenlabsVoiceId ?? null,
    elevenlabsModelId: n.elevenlabsModelId ?? null,
    openaiApiKey: n.openaiApiKey ?? null,
    openaiBaseUrl: n.openaiBaseUrl ?? null,
    openaiModelId: n.openaiModelId ?? null,
    openaiVoiceId: n.openaiVoiceId ?? null,

    kittenModelId: n.kittenModelId ?? null,
    kittenVoiceId: n.kittenVoiceId ?? null,
    kittenPythonBin: n.kittenPythonBin ?? null,

    updatedAt: now,
  })
}

export function normalizeTts(cfg: any): TtsConfig {
  const rawProvider = String(cfg?.provider ?? '').trim()
  const provider: TtsProvider =
    rawProvider === 'elevenlabs' ? 'elevenlabs'
      : rawProvider === 'openai' ? 'openai'
      : rawProvider === 'kittentts' ? 'kittentts'
      : 'inworld'

  return {
    provider,

    inworldApiKey: String(cfg?.inworldApiKey ?? cfg?.INWORLD_API_KEY ?? '').trim() || undefined,
    inworldVoiceId: String(cfg?.inworldVoiceId ?? '').trim() || undefined,
    inworldModelId: String(cfg?.inworldModelId ?? '').trim() || undefined,

    elevenlabsApiKey: String(cfg?.elevenlabsApiKey ?? '').trim() || undefined,
    elevenlabsVoiceId: String(cfg?.elevenlabsVoiceId ?? '').trim() || undefined,
    elevenlabsModelId: String(cfg?.elevenlabsModelId ?? '').trim() || undefined,

    openaiApiKey: String(cfg?.openaiApiKey ?? '').trim() || undefined,
    openaiBaseUrl: String(cfg?.openaiBaseUrl ?? '').trim() || undefined,
    openaiModelId: String(cfg?.openaiModelId ?? '').trim() || undefined,
    openaiVoiceId: String(cfg?.openaiVoiceId ?? '').trim() || undefined,

    kittenModelId: String(cfg?.kittenModelId ?? '').trim() || undefined,
    kittenVoiceId: String(cfg?.kittenVoiceId ?? '').trim() || undefined,
    kittenPythonBin: String(cfg?.kittenPythonBin ?? '').trim() || undefined,
  }
}
