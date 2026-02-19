export function normalizeOpenAICompatBaseUrl(raw: string) {
  const base = String(raw || '').trim().replace(/\/$/, '')
  if (!base) return ''
  // If user gives https://host/v1 keep as-is; else append /v1
  if (base.endsWith('/v1')) return base
  if (base.includes('/v1/')) return base.replace(/\/$/, '')
  return base + '/v1'
}

export async function openAICompatChat(opts: {
  baseUrl: string
  apiKey?: string
  model: string
  messages: Array<{ role: string; content: string }>
}) {
  const baseUrl = normalizeOpenAICompatBaseUrl(opts.baseUrl)
  const url = baseUrl + '/chat/completions'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`

  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: false,
    }),
  })

  const text = await r.text().catch(() => '')
  if (!r.ok) {
    return { ok: false as const, status: r.status, body: text }
  }

  try {
    const j: any = JSON.parse(text)
    const content = j?.choices?.[0]?.message?.content ?? ''
    return { ok: true as const, content, raw: j }
  } catch {
    return { ok: true as const, content: text, raw: text }
  }
}
