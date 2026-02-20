import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatStatus } from 'ai'
import './App.css'

import { PayphoneChat } from '@/components/PayphoneChat'

type Role = 'user' | 'assistant'
type ChatMsg = { id: string; role: Role; text: string; t: number; pending?: boolean }

type RouteProvider = 'ollama' | 'openai_compat' | 'openclaw'
type RouteConfig = {
  number: string
  label: string
  provider: RouteProvider
  model: string
  voiceId?: string
  baseUrl?: string
  apiKey?: string
  agentId?: string
  avatarUrl?: string
}

type TtsProvider = 'inworld' | 'elevenlabs' | 'openai' | 'kittentts'

type TtsConfig = {
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
  // KittenTTS
  kittenModelId?: string
  kittenVoiceId?: string
  kittenPythonBin?: string
}

type SettingsPayload = { routes: RouteConfig[] }

type OllamaModelsResp = { models: string[] }

type AvatarPreset = { id: string; label: string; url: string }
const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'none', label: 'None', url: '' },
  { id: 'pixel-robot', label: 'Pixel Robot', url: '/avatars/pixel-robot.svg' },
  { id: 'pixel-cat', label: 'Pixel Cat', url: '/avatars/pixel-cat.svg' },
  { id: 'pixel-ghost', label: 'Pixel Ghost', url: '/avatars/pixel-ghost.svg' },
  { id: 'pixel-wizard', label: 'Pixel Wizard', url: '/avatars/pixel-wizard.svg' },
]

type ProviderPreset = { id: string; label: string; baseUrl: string; modelHint?: string }
const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelHint: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelHint: 'openai/gpt-4o-mini' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', modelHint: 'llama-3.1-70b-versatile' },
  { id: 'together', label: 'Together', baseUrl: 'https://api.together.xyz/v1', modelHint: 'meta-llama/Llama-3.1-70B-Instruct-Turbo' },
  { id: 'lmstudio', label: 'LM Studio (local)', baseUrl: 'http://127.0.0.1:1234/v1', modelHint: 'local-model' },
]

// Bump this string when swapping /public assets to avoid stale mobile caches.
const ASSET_VER = '2026-02-15a'

const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
}

function beep(freq: number, durMs = 80) {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new AudioCtx()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.value = 0.04
  o.connect(g)
  g.connect(ctx.destination)
  o.start()
  setTimeout(() => {
    o.stop()
    ctx.close()
  }, durMs)
}

function playDtmf(key: string) {
  const pair = DTMF[key]
  if (!pair) return
  beep(pair[0], 90)
  beep(pair[1], 90)
}

function preloadImage(src: string) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(img as any).decode?.().then(resolve).catch(resolve)
      if (!(img as any).decode) resolve()
    }
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function getIsMobile() {
  return window.matchMedia?.('(max-width: 640px)').matches ?? false
}

function DialPadModal({
  open,
  dialed,
  onClose,
  onKey,
  onDial,
  onBackspace,
  onClear,
}: {
  open: boolean
  dialed: string
  onClose: () => void
  onKey: (k: string) => void
  onDial: () => void
  onBackspace: () => void
  onClear: () => void
}) {
  if (!open) return null

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" onMouseDown={onClose} onClick={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">DIAL</div>
          <button
            className="modalClose"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="modalDisplay" aria-label="dialed number">
          {dialed || '—'}
        </div>

        <div className="dialGrid" role="group" aria-label="dial pad">
          {keys.map((k) => (
            <button key={k} className="dialKey" onClick={() => onKey(k)} aria-label={`key ${k}`}> {k} </button>
          ))}
        </div>

        <div className="modalActions">
          <button className="btnGhost" onClick={onClear}>Clear</button>
          <button className="btnGhost" onClick={onBackspace}>⌫</button>
          <button className="btnPrimary" onClick={onDial} disabled={!dialed}>Dial</button>
        </div>

        <div className="modalHint">Numbers can be up to 11 digits.</div>
      </div>
    </div>
  )
}

function SettingsOverlay({
  open,
  routes,
  setRoutes,
  tts,
  setTts,
  ollamaModels,
  onClose,
  onSave,
}: {
  open: boolean
  routes: RouteConfig[]
  setRoutes: (r: RouteConfig[]) => void
  tts: TtsConfig
  setTts: (t: TtsConfig) => void
  ollamaModels: string[]
  onClose: () => void
  onSave: () => void
}) {
  if (!open) return null

  function update(i: number, patch: Partial<RouteConfig>) {
    const next = routes.slice()
    next[i] = { ...next[i], ...patch }
    setRoutes(next)
  }

  function add() {
    setRoutes([
      ...routes,
      { number: '', label: '', provider: 'ollama', model: ollamaModels[0] || 'llama3.1:8b' },
    ])
  }

  function del(i: number) {
    const next = routes.slice()
    next.splice(i, 1)
    setRoutes(next)
  }

  function normUrl(u?: string) {
    return String(u || '').trim().replace(/\/$/, '')
  }

  return (
    <div className="settingsBackdrop" role="dialog" aria-modal="true" onMouseDown={onClose} onClick={onClose}>
      <div className="settings" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="settingsHeader">
          <div className="settingsTitle">SETTINGS</div>
          <button className="modalClose" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="settingsHint">
          Configure numbers (up to 11 digits) → providers → models.
        </div>

        <div className="sectionTitle">TTS</div>
        <div className="ttsBox">
          <label>
            <div className="lbl">Provider</div>
            <select
              value={tts.provider}
              onChange={(e) => setTts({ ...tts, provider: e.target.value as TtsProvider })}
            >
              <option value="inworld">Inworld</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai">OpenAI</option>
              <option value="kittentts">KittenTTS (local)</option>
            </select>
          </label>

          {tts.provider === 'inworld' && (
            <>
              <label>
                <div className="lbl">Voice ID</div>
                <input
                  value={tts.inworldVoiceId || ''}
                  onChange={(e) => setTts({ ...tts, inworldVoiceId: e.target.value })}
                  placeholder="Timothy"
                />
              </label>
              <label>
                <div className="lbl">Model ID</div>
                <input
                  value={tts.inworldModelId || ''}
                  onChange={(e) => setTts({ ...tts, inworldModelId: e.target.value })}
                  placeholder="inworld-tts-1.5-mini"
                />
              </label>
              <label>
                <div className="lbl">API Key (base64)</div>
                <input
                  value={tts.inworldApiKey || ''}
                  onChange={(e) => setTts({ ...tts, inworldApiKey: e.target.value })}
                  placeholder="base64..."
                />
              </label>
            </>
          )}

          {tts.provider === 'elevenlabs' && (
            <>
              <label>
                <div className="lbl">Voice ID</div>
                <input
                  value={tts.elevenlabsVoiceId || ''}
                  onChange={(e) => setTts({ ...tts, elevenlabsVoiceId: e.target.value })}
                  placeholder="Rachel"
                />
              </label>
              <label>
                <div className="lbl">Model ID</div>
                <input
                  value={tts.elevenlabsModelId || ''}
                  onChange={(e) => setTts({ ...tts, elevenlabsModelId: e.target.value })}
                  placeholder="eleven_multilingual_v2"
                />
              </label>
              <label>
                <div className="lbl">API Key</div>
                <input
                  value={tts.elevenlabsApiKey || ''}
                  onChange={(e) => setTts({ ...tts, elevenlabsApiKey: e.target.value })}
                  placeholder="..."
                />
              </label>
            </>
          )}

          {tts.provider === 'openai' && (
            <>
              <label>
                <div className="lbl">Base URL</div>
                <input
                  value={tts.openaiBaseUrl || ''}
                  onChange={(e) => setTts({ ...tts, openaiBaseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                <div className="lbl">Model</div>
                <input
                  value={tts.openaiModelId || ''}
                  onChange={(e) => setTts({ ...tts, openaiModelId: e.target.value })}
                  placeholder="gpt-4o-mini-tts"
                />
              </label>
              <label>
                <div className="lbl">Voice</div>
                <input
                  value={tts.openaiVoiceId || ''}
                  onChange={(e) => setTts({ ...tts, openaiVoiceId: e.target.value })}
                  placeholder="alloy"
                />
              </label>
              <label>
                <div className="lbl">API Key</div>
                <input
                  value={tts.openaiApiKey || ''}
                  onChange={(e) => setTts({ ...tts, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </label>
            </>
          )}

          {tts.provider === 'kittentts' && (
            <>
              <label>
                <div className="lbl">Model (HF)</div>
                <input
                  value={tts.kittenModelId || ''}
                  onChange={(e) => setTts({ ...tts, kittenModelId: e.target.value })}
                  placeholder="KittenML/kitten-tts-mini-0.8"
                />
              </label>

              <label>
                <div className="lbl">Voice</div>
                <select
                  value={tts.kittenVoiceId || 'Jasper'}
                  onChange={(e) => setTts({ ...tts, kittenVoiceId: e.target.value })}
                >
                  {['Bella', 'Jasper', 'Luna', 'Bruno', 'Rosie', 'Hugo', 'Kiki', 'Leo'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>

              <label>
                <div className="lbl">Python</div>
                <input
                  value={tts.kittenPythonBin || ''}
                  onChange={(e) => setTts({ ...tts, kittenPythonBin: e.target.value })}
                  placeholder="python3"
                />
              </label>

              <div className="settingsHint" style={{ marginTop: 8 }}>
                Requires Python 3.12 + KittenTTS installed. See README.
              </div>
            </>
          )}
        </div>

        <div className="sectionTitle">Routes</div>

        <div className="routesList">
          {routes.map((r, i) => (
            <div key={i} className="routeRow">
              <div className="routeGrid">
                <label>
                  <div className="lbl">Number</div>
                  <input value={r.number} onChange={(e) => update(i, { number: e.target.value.replace(/\D/g, '').slice(0, 11) })} placeholder="e.g. 18005551212" />
                </label>
                <label>
                  <div className="lbl">Label</div>
                  <input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="e.g. Plutus" />
                </label>

                <label>
                  <div className="lbl">Avatar</div>
                  <select
                    value={normUrl(r.avatarUrl) || ''}
                    onChange={(e) => update(i, { avatarUrl: e.target.value || undefined })}
                  >
                    {AVATAR_PRESETS.map((a) => (
                      <option key={a.id} value={a.url}>{a.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="lbl">Provider</div>
                  <select
                    value={r.provider}
                    onChange={(e) => {
                      const provider = e.target.value as RouteProvider
                      // If switching away from openai_compat/openclaw, clear their fields.
                      if (provider === 'ollama') {
                        update(i, { provider, baseUrl: undefined, apiKey: undefined, agentId: undefined })
                        return
                      }
                      // If switching away from openclaw, clear agentId.
                      if (provider === 'openai_compat') {
                        update(i, { provider, agentId: undefined })
                        return
                      }
                      update(i, { provider })
                    }}
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai_compat">OpenAI-compatible</option>
                    <option value="openclaw">OpenClaw</option>
                  </select>
                </label>

                {r.provider === 'openai_compat' && (
                  <label>
                    <div className="lbl">Preset</div>
                    <select
                      value={OPENAI_COMPAT_PRESETS.find((p) => normUrl(p.baseUrl) === normUrl(r.baseUrl))?.id || ''}
                      onChange={(e) => {
                        const p = OPENAI_COMPAT_PRESETS.find((x) => x.id === e.target.value)
                        if (!p) return
                        update(i, {
                          baseUrl: p.baseUrl,
                          model: r.model || p.modelHint || r.model,
                        })
                      }}
                    >
                      <option value="">(choose)</option>
                      {OPENAI_COMPAT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <div className="lbl">Model</div>
                  {r.provider === 'ollama' ? (
                    <select value={r.model} onChange={(e) => update(i, { model: e.target.value })}>
                      {ollamaModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={r.model} onChange={(e) => update(i, { model: e.target.value })} placeholder="e.g. gpt-4o-mini" />
                  )}
                </label>

                <label>
                  <div className="lbl">Voice ID</div>
                  <input value={r.voiceId || ''} onChange={(e) => update(i, { voiceId: e.target.value })} placeholder="(optional)" />
                </label>

                {(r.provider === 'openai_compat' || r.provider === 'openclaw') && (
                  <>
                    <label>
                      <div className="lbl">Base URL</div>
                      <input value={r.baseUrl || ''} onChange={(e) => update(i, { baseUrl: e.target.value })} placeholder={r.provider === 'openclaw' ? 'http://127.0.0.1:18789 (or with /v1)' : 'https://host/v1 (or without /v1)'} />
                    </label>
                    <label>
                      <div className="lbl">API Key</div>
                      <input value={r.apiKey || ''} onChange={(e) => update(i, { apiKey: e.target.value })} placeholder={r.provider === 'openclaw' ? 'OpenClaw gateway token/password' : 'sk-...'} />
                    </label>
                    {r.provider === 'openclaw' && (
                      <label>
                        <div className="lbl">Agent ID</div>
                        <input value={r.agentId || ''} onChange={(e) => update(i, { agentId: e.target.value })} placeholder="main" />
                      </label>
                    )}
                  </>
                )}
              </div>

              <button className="btnDanger" onClick={() => del(i)}>Delete</button>
            </div>
          ))}
        </div>

        <div className="settingsActions">
          <button className="btnGhost" onClick={add}>Add route</button>
          <div style={{ flex: 1 }} />
          <button className="btnPrimary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [dialed, setDialed] = useState('')
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null)

  const [routes, setRoutes] = useState<RouteConfig[]>([])
  const [tts, setTts] = useState<TtsConfig>({ provider: 'inworld' })
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  const [history, setHistory] = useState<ChatMsg[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [chatStatus, setChatStatus] = useState<ChatStatus>('ready')
  const [input, setInput] = useState('')

  const [isMobile, setIsMobile] = useState(() => {
    try { return getIsMobile() } catch { return false }
  })

  const debugAnim = useMemo(() => {
    try { return new URLSearchParams(window.location.search).has('debugAnim') } catch { return false }
  }, [])

  const [dialModalOpen, setDialModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addressBookOpen, setAddressBookOpen] = useState(false)

  // Address book intro animation (/public/addressbook_intro)
  const [abFrame, setAbFrame] = useState(1)
  const [abPlaying, setAbPlaying] = useState(false)
  const [abPhase, setAbPhase] = useState<'opening' | 'open' | 'closing'>('opening')
  const [, setAbReady] = useState(false)
  const abTimerRef = useRef<number | null>(null)
  const abPreloadRef = useRef<Promise<void> | null>(null)

  // Dial pad click animation (frame sequence in /public/dialpad_anim)
  const [dialAnimFrame, setDialAnimFrame] = useState(1)
  const [dialAnimPlaying, setDialAnimPlaying] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  // dialAnimReady is currently informational; kept as a hook state for future UI/UX.
  const [, setDialAnimReady] = useState(false)
  const dialAnimTimerRef = useRef<number | null>(null)
  const dialAnimPreloadRef = useRef<Promise<void> | null>(null)
  const dialAnimPlayingRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const mobileDialRef = useRef<HTMLInputElement | null>(null)

  // Simple WebAudio ringtone (looping pattern) used as a buffer while greeting generates.
  const ringCtxRef = useRef<AudioContext | null>(null)
  const ringGainRef = useRef<GainNode | null>(null)
  const ringOscARef = useRef<OscillatorNode | null>(null)
  const ringOscBRef = useRef<OscillatorNode | null>(null)
  const ringPatternTimerRef = useRef<number | null>(null)
  const greetingAbortRef = useRef<AbortController | null>(null)

  async function refreshConfig() {
    const r = await fetch('/api/routes').then((x) => x.json()).catch(() => ({ routes: [] }))
    setRoutes(r.routes || [])

    const t = await fetch('/api/tts-config').then((x) => x.json()).catch(() => ({ tts: { provider: 'inworld' } }))
    setTts(t.tts || { provider: 'inworld' })

    const m: OllamaModelsResp = await fetch('/api/models/ollama').then((x) => x.json()).catch(() => ({ models: [] }))
    setOllamaModels(m.models || [])
  }

  useEffect(() => {
    refreshConfig().catch(() => {})
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(getIsMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [history.length])

  function stopDialAnim() {
    if (dialAnimTimerRef.current) {
      window.clearInterval(dialAnimTimerRef.current)
      dialAnimTimerRef.current = null
    }
    setDialAnimPlaying(false)
    setDialAnimFrame(1)
  }

  const DIAL_ANIM_FPS = 30
  const DIAL_ANIM_LAST_FRAME = 120 // 1s trimmed off the end (30fps -> 30 frames)

  const AB_ANIM_FPS = 24
  const AB_ANIM_LAST_FRAME = 192

  function preloadDialAnimFrames() {
    // Memoize the preload promise so we only do this once.
    if (dialAnimPreloadRef.current) return dialAnimPreloadRef.current

    const frameCount = DIAL_ANIM_LAST_FRAME
    dialAnimPreloadRef.current = (async () => {
      const urls = Array.from({ length: frameCount }, (_, idx) => {
        const n = idx + 1
        return `/dialpad_anim/dialpad_${String(n).padStart(3, '0')}.png?v=${ASSET_VER}`
      })

      // Load + decode all frames so playback doesn't "race" the network.
      await Promise.all(
        urls.map(
          (src) =>
            new Promise<void>((resolve, reject) => {
              const img = new Image()
              img.onload = () => {
                // decode() helps avoid a blank frame right after src swap
                // (supported in modern browsers; safe to ignore failures)
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(img as any).decode?.().then(resolve).catch(resolve)
                if (!(img as any).decode) resolve()
              }
              img.onerror = () => reject(new Error(`Failed to load ${src}`))
              img.src = src
            })
        )
      )

      setDialAnimReady(true)
    })().catch((e) => {
      console.warn('dialpad animation preload failed', e)
      // Still allow trying to play (will be janky), but don't block UI forever.
      setDialAnimReady(false)
    })

    return dialAnimPreloadRef.current
  }

  function playDialAnimOnce(onDone?: () => void) {
    // restart from frame 1
    if (dialAnimTimerRef.current) {
      window.clearInterval(dialAnimTimerRef.current)
      dialAnimTimerRef.current = null
    }

    const fps = DIAL_ANIM_FPS
    const frameCount = DIAL_ANIM_LAST_FRAME

    // Start moving immediately: frame 1 is already the base image.
    let i = 1
    setDialAnimFrame(1)
    setDialAnimPlaying(true)

    dialAnimTimerRef.current = window.setInterval(() => {
      i += 1
      if (i > frameCount) {
        if (dialAnimTimerRef.current) {
          window.clearInterval(dialAnimTimerRef.current)
          dialAnimTimerRef.current = null
        }
        setDialAnimPlaying(false)
        onDone?.()
        return
      }
      setDialAnimFrame(i)
    }, 1000 / fps)
  }

  function abSrc(n: number) {
    return `/addressbook_intro/ab_${String(n).padStart(3, '0')}.png`
  }

  function abSrcV(n: number) {
    return `${abSrc(n)}?v=${ASSET_VER}`
  }

  function preloadAddressBookFrames() {
    if (abPreloadRef.current) return abPreloadRef.current
    const frameCount = AB_ANIM_LAST_FRAME

    abPreloadRef.current = (async () => {
      const urls = Array.from({ length: frameCount }, (_, idx) => abSrcV(idx + 1))
      await Promise.all(
        urls.map(
          (src) =>
            new Promise<void>((resolve, reject) => {
              const img = new Image()
              img.onload = () => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(img as any).decode?.().then(resolve).catch(resolve)
                if (!(img as any).decode) resolve()
              }
              img.onerror = () => reject(new Error(`Failed to load ${src}`))
              img.src = src
            })
        )
      )
      setAbReady(true)
    })().catch((e) => {
      console.warn('address book preload failed', e)
      setAbReady(false)
    })

    return abPreloadRef.current
  }

  function stopAbAnim({ resetFrame }: { resetFrame: boolean } = { resetFrame: true }) {
    if (abTimerRef.current) {
      window.clearInterval(abTimerRef.current)
      abTimerRef.current = null
    }
    setAbPlaying(false)
    if (resetFrame) setAbFrame(1)
  }

  function playAbAnim({ from, to, onDone }: { from: number; to: number; onDone?: () => void }) {
    if (abTimerRef.current) {
      window.clearInterval(abTimerRef.current)
      abTimerRef.current = null
    }

    const fps = AB_ANIM_FPS
    const dir = to >= from ? 1 : -1
    let i = from

    setAbFrame(from)
    setAbPlaying(true)

    abTimerRef.current = window.setInterval(() => {
      i += dir
      const done = dir === 1 ? i > to : i < to
      if (done) {
        if (abTimerRef.current) {
          window.clearInterval(abTimerRef.current)
          abTimerRef.current = null
        }
        setAbPlaying(false)
        // clamp to final
        setAbFrame(to)
        onDone?.()
        return
      }
      setAbFrame(i)
    }, 1000 / fps)
  }

  function openAddressBook() {
    if (addressBookOpen || abPlaying) return
    setAddressBookOpen(true)
    setAbPhase('opening')
    // play forward full-screen, then reveal modal on last frame
    playAbAnim({
      from: 1,
      to: AB_ANIM_LAST_FRAME,
      onDone: () => setAbPhase('open'),
    })
  }

  function closeAddressBook() {
    if (!addressBookOpen) return

    // If we're mid-animation (opening), interrupt and reverse from the current frame.
    if (abTimerRef.current) {
      window.clearInterval(abTimerRef.current)
      abTimerRef.current = null
      setAbPlaying(false)
    }

    setAbPhase('closing')

    const from = Math.min(Math.max(abFrame, 1), AB_ANIM_LAST_FRAME)

    // play reverse from the current frame, then fully close/reset
    playAbAnim({
      from,
      to: 1,
      onDone: () => {
        setAddressBookOpen(false)
        setAbPhase('opening')
        stopAbAnim({ resetFrame: true })
      },
    })
  }

  // Show a quick loading overlay while we preload *critical* images.
  // Then preload the full animation frame sets in the background.
  useEffect(() => {
    ;(async () => {
      try {
        await Promise.allSettled([
          preloadImage(`/dialpad_anim/dialpad_001.png?v=${ASSET_VER}`),
          preloadImage(`/payphone_mobile.png?v=${ASSET_VER}`),
          preloadImage(`${abSrc(1)}?v=${ASSET_VER}`),
          preloadImage(`/addressbook_modal.png?v=${ASSET_VER}`),
        ])
      } finally {
        setAppLoading(false)
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.allSettled([preloadDialAnimFrames(), preloadAddressBookFrames()]).catch(() => {})
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep a ref of dial animation state for async helpers.
  useEffect(() => {
    dialAnimPlayingRef.current = dialAnimPlaying
  }, [dialAnimPlaying])

  // If the dial pad is opened during an active call, always ensure we're holding the last frame.
  useEffect(() => {
    if (connectedNumber && dialModalOpen && !dialAnimPlaying) {
      setDialAnimFrame(DIAL_ANIM_LAST_FRAME)
    }
  }, [connectedNumber, dialModalOpen, dialAnimPlaying])

  // Cleanup if the component unmounts
  useEffect(() => {
    return () => {
      if (dialAnimTimerRef.current) {
        window.clearInterval(dialAnimTimerRef.current)
        dialAnimTimerRef.current = null
      }
      if (abTimerRef.current) {
        window.clearInterval(abTimerRef.current)
        abTimerRef.current = null
      }
    }
  }, [])

  const connectedRoute = useMemo(() => {
    if (!connectedNumber) return null
    return routes.find((r) => r.number === connectedNumber) || null
  }, [connectedNumber, routes])

  function stopRingtone() {
    if (ringPatternTimerRef.current) {
      window.clearInterval(ringPatternTimerRef.current)
      ringPatternTimerRef.current = null
    }
    try {
      ringGainRef.current?.gain?.setValueAtTime(0, ringCtxRef.current?.currentTime || 0)
    } catch {}
    try {
      ringOscARef.current?.stop()
      ringOscBRef.current?.stop()
    } catch {}
    ringOscARef.current = null
    ringOscBRef.current = null
    ringGainRef.current = null

    // Don't close the context (some browsers get unhappy); just suspend it.
    ringCtxRef.current?.suspend?.().catch(() => {})
  }

  function startRingtone() {
    // Must be called from a user gesture to avoid autoplay restrictions.
    const ctx = ringCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
    ringCtxRef.current = ctx

    // If already ringing, do nothing.
    if (ringPatternTimerRef.current) return

    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    ringGainRef.current = gain

    // Classic phone ring-ish: two tones mixed
    const oscA = ctx.createOscillator()
    oscA.type = 'sine'
    oscA.frequency.value = 440
    const oscB = ctx.createOscillator()
    oscB.type = 'sine'
    oscB.frequency.value = 480
    oscA.connect(gain)
    oscB.connect(gain)
    oscA.start()
    oscB.start()
    ringOscARef.current = oscA
    ringOscBRef.current = oscB

    ctx.resume?.().catch(() => {})

    // Ring pattern: 2s on, 2s off (simple + effective)
    let on = false
    const tick = () => {
      on = !on
      const t = ctx.currentTime
      try {
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(gain.gain.value, t)
        gain.gain.linearRampToValueAtTime(on ? 0.08 : 0.0, t + 0.02)
      } catch {}
    }

    tick()
    ringPatternTimerRef.current = window.setInterval(tick, 2000)
  }

  function stopTts() {
    try {
      if (!audioRef.current) return
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    } catch {}
    setTtsPlaying(false)
  }

  async function playTts(
    text: string,
    number?: string | null,
    opts?: { onStart?: () => void }
  ) {
    if (!text) return
    if (!audioRef.current) return

    // Stop any currently playing audio.
    stopTts()

    const t = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, number: number || undefined }),
    })

    if (!t.ok) return

    const blob = await t.blob()
    const url = URL.createObjectURL(blob)
    audioRef.current.src = url

    // Track playback state.
    audioRef.current.onended = () => setTtsPlaying(false)
    audioRef.current.onpause = () => setTtsPlaying(false)

    const p = audioRef.current.play()
    p.then(() => {
      setTtsPlaying(true)
      opts?.onStart?.()
    }).catch(() => {})

    await p.catch(() => {})
  }

  function waitForDialAnimToFinish(minMs = 0) {
    return new Promise<void>((resolve) => {
      const start = Date.now()
      const tick = () => {
        const animDone = !dialAnimPlayingRef.current
        const minDone = Date.now() - start >= minMs
        if (animDone && minDone) return resolve()
        window.setTimeout(tick, 50)
      }
      tick()
    })
  }

  async function generateGreeting(number: string, opts?: { waitForDialAnimDone?: boolean }) {
    // Cancel any in-flight greeting.
    if (greetingAbortRef.current) greetingAbortRef.current.abort()
    const ac = new AbortController()
    greetingAbortRef.current = ac

    startRingtone()

    const waitForAnim = !!opts?.waitForDialAnimDone
    // If requested (address book flow), keep ringing until the dial animation finishes too.
    const animDoneP = waitForAnim ? waitForDialAnimToFinish() : Promise.resolve()

    const greetP = (async () => {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          number,
          text:
            'Answer the phone with a short, natural greeting (1-2 sentences). No stage directions, no quotes. Then ask how you can help.',
        }),
      })

      const data = await r.json().catch(() => ({} as any))
      return String(data?.text || '').trim()
    })()

    // Ring until BOTH are done (whichever takes longer): animation OR LLM.
    const [greeting] = await Promise.all([greetP, animDoneP])
    stopRingtone()

    if (!greeting) return

    // Suspense: add a placeholder bubble, then reveal the real greeting when TTS starts.
    const id = `a:${Date.now()}:${Math.random().toString(16).slice(2)}`
    setHistory((h) => [...h, { id, role: 'assistant' as const, text: '…', pending: true, t: Date.now() }].slice(-60))

    setSpeaking(true)
    try {
      await playTts(greeting, number, {
        onStart: () => {
          setHistory((h) => h.map((m) => (m.id === id ? { ...m, text: greeting, pending: false } : m)))
        },
      })
    } finally {
      setSpeaking(false)
    }
  }

  function hangup() {
    // stop any async/greeting work
    if (greetingAbortRef.current) greetingAbortRef.current.abort()
    greetingAbortRef.current = null

    stopRingtone()
    stopTts()

    setConnectedNumber(null)
    setDialed('')
    setInput('')
    setHistory([])
    setDialModalOpen(false)
    stopDialAnim()
  }

  function connectFromDial(d: string, opts?: { waitForDialAnimDone?: boolean }) {
    const number = (d || '').replace(/\D/g, '').slice(0, 11)
    if (!number) return
    const match = routes.find((r) => r.number === number)
    if (!match) return
    // If we connect while any animation timer is running, stop it and hold the final frame.
    if (dialAnimTimerRef.current) {
      window.clearInterval(dialAnimTimerRef.current)
      dialAnimTimerRef.current = null
    }
    setDialAnimPlaying(false)

    setConnectedNumber(number)
    // Close the dial pad after connection, but keep the last animation frame held until hangup.
    setDialModalOpen(false)
    setDialAnimFrame(DIAL_ANIM_LAST_FRAME)

    // Start the "call": ring while the greeting is generated, then speak it.
    // Fire-and-forget; hangup() aborts if needed.
    generateGreeting(number, { waitForDialAnimDone: !!opts?.waitForDialAnimDone }).catch(() => {})
  }

  function onKey(k: string) {
    playDtmf(k)
    if (k === '*') {
      hangup()
      return
    }
    if (k === '#') {
      connectFromDial(dialed)
      return
    }
    if (!/^[0-9]$/.test(k)) return
    setDialed((d) => (d + k).slice(0, 11))
  }

  function backspace() {
    setDialed((d) => d.slice(0, -1))
  }

  function clearDial() {
    setDialed('')
  }

  function dialNow() {
    connectFromDial(dialed)
  }

  async function saveSettings() {
    const payload: SettingsPayload = { routes }
    const r = await fetch('/api/routes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const t = await fetch('/api/tts-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts }),
    })

    if (r.ok && t.ok) {
      await refreshConfig()
      setSettingsOpen(false)
    }
  }

  async function sendText(userTextRaw: string) {
    if (!connectedNumber) return

    const userText = (userTextRaw || '').trim()
    if (!userText) return

    setChatStatus('submitted')

    setHistory((h) => [...h, { id: `u:${Date.now()}:${Math.random().toString(16).slice(2)}`, role: 'user' as const, text: userText, t: Date.now() }].slice(-60))

    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: connectedNumber, text: userText }),
    })

    const data = await r.json().catch(() => ({}))
    const text = data?.text || ''
    if (!text) {
      setChatStatus('ready')
      return
    }

    // Suspense: add a placeholder bubble, then reveal when TTS starts.
    const id = `a:${Date.now()}:${Math.random().toString(16).slice(2)}`
    setHistory((h) => [...h, { id, role: 'assistant' as const, text: '…', pending: true, t: Date.now() }].slice(-60))

    // Make sure ringtone isn't bleeding into the call audio.
    stopRingtone()

    setSpeaking(true)
    try {
      await playTts(text, connectedNumber, {
        onStart: () => {
          setHistory((h) => h.map((m) => (m.id === id ? { ...m, text, pending: false } : m)))
        },
      })
    } finally {
      setSpeaking(false)
      setChatStatus('ready')
    }
  }

  async function send() {
    const userText = input
    setInput('')
    await sendText(userText)
  }

  // Mobile: connect as soon as the entered digits match a route.
  useEffect(() => {
    if (!isMobile) return
    if (connectedNumber) return
    const number = dialed.replace(/\D/g, '').slice(0, 11)
    if (!number) return
    const match = routes.find((r) => r.number === number)
    if (match) setConnectedNumber(number)
  }, [dialed, isMobile, connectedNumber, routes])

  // Hold on the last frame while the dial pad is open (after the animation completes)
  // and for the duration of an active call (until hangup).
  const dialAnimHoldLastFrame = (dialModalOpen || !!connectedNumber) && !dialAnimPlaying
  const dialAnimEffectiveFrame = dialAnimHoldLastFrame ? DIAL_ANIM_LAST_FRAME : dialAnimFrame
  const dialAnimSrc = `/dialpad_anim/dialpad_${String(dialAnimEffectiveFrame).padStart(3, '0')}.png`
  const dialAnimSrcV = `${dialAnimSrc}?v=${ASSET_VER}`

  // Use the first animation frame as the main desktop image.
  // When animating or holding the final frame, swap the *base* image too so it remains visible under the modal.
  const bgSrc = (dialAnimPlaying || dialAnimHoldLastFrame)
    ? dialAnimSrcV
    : isMobile
      ? `/payphone_mobile.png?v=${ASSET_VER}`
      : `/dialpad_anim/dialpad_001.png?v=${ASSET_VER}`

  return (
    <div className={'page' + (isMobile ? ' mobile' : '')}>
      {appLoading && (
        <div className="loadingOverlay" role="status" aria-live="polite">
          <div className="loadingCard">
            <div className="loadingSpinner" />
            <div className="loadingText">Loading assets…</div>
            <div className="loadingSub">Warming up the dialpad + address book animations.</div>
          </div>
        </div>
      )}
      <div
        className={'frame' + (connectedNumber ? ' connected' : '')}
        onClick={(e) => {
          if (appLoading) return
          if (e.target !== e.currentTarget) return
          // Mobile: play the same dial animation, then focus the numeric keyboard.
          if (isMobile) {
            if (dialAnimPlaying) return
            // Hold final frame when connected; otherwise animate on tap.
            if (connectedNumber) {
              setDialAnimFrame(DIAL_ANIM_LAST_FRAME)
              mobileDialRef.current?.focus()
              return
            }
            playDialAnimOnce(() => mobileDialRef.current?.focus())
            return
          }

          // Desktop: if not in a call, play the dial animation first, then open the dial pad.
          // If already in an active call, just open the dial pad (DTMF) and hold the last frame.
          if (dialModalOpen) return
          if (connectedNumber) {
            setDialAnimFrame(DIAL_ANIM_LAST_FRAME)
            setDialModalOpen(true)
            return
          }
          if (dialAnimPlaying) return

          // Frames are preloaded on mount; start immediately on click.
          playDialAnimOnce(() => setDialModalOpen(true))
        }}
      >
        <img className={'bg' + (isMobile ? ' mobileBg' : '')} src={bgSrc} alt="payphone" />

        {debugAnim && (
          <div style={{
            position: 'absolute',
            zIndex: 50,
            top: 10,
            left: 10,
            padding: '6px 8px',
            fontSize: 12,
            borderRadius: 8,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#e9edf7',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}>
            <div>connected: {String(!!connectedNumber)}</div>
            <div>dialModalOpen: {String(dialModalOpen)}</div>
            <div>dialAnimPlaying: {String(dialAnimPlaying)}</div>
            <div>holdLast: {String(dialAnimHoldLastFrame)}</div>
            <div>frame: {dialAnimEffectiveFrame}</div>
            <div>bgSrc: {bgSrc}</div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>abOpen: {String(addressBookOpen)}</div>
            <div>abPhase: {String(abPhase)}</div>
            <div>abPlaying: {String(abPlaying)}</div>
            <div>abFrame: {String(abFrame)}</div>
          </div>
        )}

        {/* Dial pad selection animation. Plays BEFORE the modal opens.
            When a call is active and the dialpad is open, hold on the last frame until hangup. */}
        {(dialAnimPlaying || dialAnimHoldLastFrame) && (
          <img className="bg dialpadAnim" src={dialAnimSrcV} alt="dialpad animation" />
        )}

        <div className="topBtns">
          <button
            className="topBtn"
            onClick={(e) => {
              e.stopPropagation()
              openAddressBook()
            }}
            aria-label="address book"
            disabled={appLoading}
          >
            📒
          </button>

          <button
            className="topBtn"
            onClick={(e) => {
              e.stopPropagation()
              setSettingsOpen(true)
            }}
            aria-label="settings"
            disabled={appLoading}
          >
            ⚙
          </button>
        </div>

        <SettingsOverlay
          open={settingsOpen}
          routes={routes}
          setRoutes={setRoutes}
          tts={tts}
          setTts={setTts}
          ollamaModels={ollamaModels}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />

        {/* Mobile: tapping the phone should open numeric keyboard */}
        {isMobile && !connectedNumber && (
          <input
            ref={mobileDialRef}
            className="mobileDialOverlay"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={dialed}
            onChange={(e) => setDialed(e.target.value.replace(/\D/g, '').slice(0, 11))}
            aria-label="dial"
          />
        )}

        {/* Desktop modal dial pad */}
        {!isMobile && (
          <DialPadModal
            open={dialModalOpen}
            dialed={dialed}
            onClose={() => {
              setDialModalOpen(false)
              // If we're not in an active call, fully reset the animation.
              if (!connectedNumber) stopDialAnim()
            }}
            onKey={onKey}
            onDial={dialNow}
            onBackspace={backspace}
            onClear={clearDial}
          />
        )}

        {/* Address book: full-screen intro plays first, then the modal appears.
            Holds last frame while open; on dismiss, plays reverse then closes. */}
        {addressBookOpen && (
          <div className={'abBackdrop' + (abPhase === 'open' ? ' open' : '')} onClick={closeAddressBook}>
            {/* Full-screen intro animation */}
            <img className="abFull" src={abSrcV(abFrame)} alt="address book intro" />

            {/* Modal appears after opening animation ends (held on last frame) */}
            {abPhase === 'open' && (
              <div className="abBook" onClick={(e) => e.stopPropagation()}>
                <img className="abBookImg" src="/addressbook_modal.png" alt="address book" />

                <button
                  className="abClose"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeAddressBook()
                  }}
                  aria-label="close"
                >
                  ✕
                </button>

                <div className="abContacts">
                  <table className="abTable">
                    <tbody>
                      {routes
                        .slice()
                        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))
                        .map((r) => (
                          <tr
                            key={r.number}
                            className="abTr"
                            onClick={() => {
                              setDialed(r.number)
                              connectFromDial(r.number, { waitForDialAnimDone: true })
                              closeAddressBook()
                            }}
                          >
                            <td className="abTdEntry">
                              {r.avatarUrl ? (
                                <img
                                  className="abAvatar"
                                  src={r.avatarUrl}
                                  alt=""
                                  style={{ imageRendering: 'pixelated' }}
                                />
                              ) : null}
                              <span className="abEntryName">{r.label || r.number}</span>
                              <span className="abEntryNum">{r.number}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Desktop HUD */}
        {!isMobile && (
          <div className={'hud' + (addressBookOpen ? ' hidden' : '')}>
            {/* Removed Dial/Line pills (replaced by chat header) */}

            {/* Main chat interface (shadcn @blocks/ai-05) */}
            <PayphoneChat
              title={connectedRoute ? connectedRoute.label : 'Payphone'}
              subtitle={connectedNumber ? `Connected: ${connectedNumber}` : 'Idle'}
              avatarUrl={connectedRoute?.avatarUrl}
              connected={!!connectedNumber}
              messages={history}
              input={input}
              setInput={setInput}
              status={chatStatus}
              speaking={speaking}
              ttsPlaying={ttsPlaying}
              onSend={async (text) => {
                setInput('')
                await sendText(text)
              }}
              onStopTts={stopTts}
              onHangup={hangup}
            />
          </div>
        )}

        {/* Mobile overlay chat (only when connected) */}
        {isMobile && connectedNumber && (
          <div className="glassOverlay" onClick={(e) => e.stopPropagation()}>
            <div className="glassTop">
              <div className="pill">
                Line: <strong>{connectedRoute ? connectedRoute.label : connectedNumber}</strong>
              </div>
              <button className="hangup" onClick={hangup}>Hang up</button>
            </div>

            <div className="chatWrap mobileChat">
              <div ref={chatRef} className="chat" role="log" aria-label="chat history">
                {history.map((m, idx) => (
                  <div key={m.id || (m.t + ':' + idx)} className={'msg ' + m.role + (m.pending ? ' pending' : '')}>
                    <div className="bubble">{m.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glassBottom">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={'Say something…'}
              />
              <button onClick={send} disabled={!input.trim() || speaking}>
                {speaking ? 'Speaking…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        <audio ref={audioRef} />
      </div>
    </div>
  )
}
