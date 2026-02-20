import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { loadRoutes, normalizeRoutes, saveRoutes, type RouteConfig } from "./routes_store.js";
import { loadTts, normalizeTts, saveTts, type TtsConfig } from "./tts_store.js";

dotenv.config();

export const app = express();
app.use(cors());
app.use(express.json({ limit: "3mb" }));

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

// TTS config can be overridden via persisted config (preferred) or env (.env).
let ttsCfg: TtsConfig = normalizeTts(loadTts());

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || "nova-2";
const DEEPGRAM_LANGUAGE = process.env.DEEPGRAM_LANGUAGE || "en";

// --- Dialplan / routes ---
let routes: RouteConfig[] = normalizeRoutes(loadRoutes());

function getRoute(number: string) {
  return routes.find((r) => r.number === number);
}

function basicSystemFor(label: string) {
  // Keep it lightweight: the model should mostly be itself.
  return `You are ${label}. Be concise, helpful, and stay in character.`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/routes", (_req, res) => {
  res.json({ routes });
});

app.get("/api/tts-config", (_req, res) => {
  // Do not return API key by default? Jack explicitly wants config on disk; we return it for local UI editing.
  res.json({ tts: ttsCfg });
});

const TtsPutReq = z.object({
  tts: z.object({
    provider: z.enum(["inworld", "elevenlabs", "openai", "kittentts"]),

    inworldApiKey: z.string().optional(),
    inworldVoiceId: z.string().optional(),
    inworldModelId: z.string().optional(),

    elevenlabsApiKey: z.string().optional(),
    elevenlabsVoiceId: z.string().optional(),
    elevenlabsModelId: z.string().optional(),

    openaiApiKey: z.string().optional(),
    openaiBaseUrl: z.string().optional(),
    openaiModelId: z.string().optional(),
    openaiVoiceId: z.string().optional(),

    kittenModelId: z.string().optional(),
    kittenVoiceId: z.string().optional(),
    kittenPythonBin: z.string().optional(),
  }),
});

app.put("/api/tts-config", (req, res) => {
  const parsed = TtsPutReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  ttsCfg = normalizeTts(parsed.data.tts as any);
  saveTts(ttsCfg);
  res.json({ ok: true, tts: ttsCfg });
});

const RoutesPutReq = z.object({
  routes: z.array(
    z.object({
      number: z.string().regex(/^\d{1,11}$/),
      label: z.string().min(1).max(64),
      provider: z.enum(["ollama", "openai_compat", "openclaw"]),
      model: z.string().min(1).max(256),
      voiceId: z.string().optional(),
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      agentId: z.string().optional(),
      avatarUrl: z.string().optional(),
    })
  ),
});

app.put("/api/routes", (req, res) => {
  const parsed = RoutesPutReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  routes = normalizeRoutes(parsed.data.routes as any);
  saveRoutes(routes);
  res.json({ ok: true, routes });
});

// Optional helper: list local ollama models for dropdown
app.get("/api/models/ollama", async (_req, res) => {
  try {
    const base = OLLAMA_BASE_URL.replace(/\/$/, "");
    const r = await fetch(`${base}/api/tags`);
    if (!r.ok) return res.status(502).json({ error: "ollama_tags_error", status: r.status });
    const j: any = await r.json();
    const names = (j?.models || [])
      .map((m: any) => String(m?.name || ""))
      .filter(Boolean)
      .filter((n: string) => !/whiterabbit/i.test(n));
    res.json({ models: names });
  } catch (e: any) {
    res.status(502).json({ error: "ollama_tags_exception", message: String(e?.message || e) });
  }
});

const ChatReq = z.object({
  number: z.string().regex(/^\d{1,11}$/),
  text: z.string().min(1).max(4000),
});

app.post("/api/chat", async (req, res) => {
  const parsed = ChatReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { number, text } = parsed.data;
  const route = getRoute(number);
  if (!route) return res.status(404).json({ error: "Unknown number" });

  const system = basicSystemFor(route.label);

  if (route.provider === "openai_compat" || route.provider === "openclaw") {
    const baseUrl = String(route.baseUrl || "").trim().replace(/\/$/, "");
    const apiKey = String(route.apiKey || "").trim();
    if (!baseUrl) return res.status(400).json({ error: "route_missing_baseUrl" });
    if (!apiKey) return res.status(400).json({ error: "route_missing_apiKey" });

    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (route.provider === "openclaw") {
      const agentId = String(route.agentId || process.env.OPENCLAW_AGENT_ID || "main").trim();
      if (agentId) headers["x-openclaw-agent-id"] = agentId;
    }

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: route.model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });

    const raw = await r.text().catch(() => "");
    if (!r.ok) {
      return res.status(502).json({ error: "openai_compat_error", status: r.status, body: raw.slice(0, 1200) });
    }

    let reply = "";
    try {
      const j = JSON.parse(raw);
      reply = j?.choices?.[0]?.message?.content ?? "";
    } catch {
      // if provider returned non-json
      reply = "";
    }

    return res.json({ number, label: route.label, text: reply });
  }

  // Default: ollama
  const r = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: route.model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    return res.status(502).json({ error: "ollama_error", status: r.status, body: errText });
  }

  const data = (await r.json()) as any;
  const reply = data?.message?.content ?? "";
  res.json({ number, label: route.label, text: reply });
});

const TtsReq = z.object({
  text: z.string().min(1).max(8000),
  // optional number so we can select per-route voice
  number: z.string().regex(/^\d{1,11}$/).optional(),
});

app.post("/api/tts", async (req, res) => {
  const parsed = TtsReq.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const text = parsed.data.text;
  const num = (parsed.data as any).number as string | undefined;
  const route = num ? getRoute(num) : undefined;

  const provider = ttsCfg.provider;

  // Route-level voice override (provider-specific id)
  const routeVoiceId = route?.voiceId ? String(route.voiceId).trim() : "";

  if (provider === "elevenlabs") {
    const apiKey = ttsCfg.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || "";
    if (!apiKey) return res.status(503).json({ error: "ELEVENLABS_API_KEY not set" });

    const voiceId = routeVoiceId || ttsCfg.elevenlabsVoiceId || process.env.ELEVENLABS_VOICE_ID || "Rachel";
    const modelId = ttsCfg.elevenlabsModelId || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "User-Agent": "payphone-ollama-tts/1.0",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    const raw = Buffer.from(await r.arrayBuffer());
    if (!r.ok) {
      const errText = raw.toString("utf8").slice(0, 1200);
      return res.status(502).json({ error: "elevenlabs_error", status: r.status, body: errText });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(raw);
  }

  if (provider === "openai") {
    const apiKey = ttsCfg.openaiApiKey || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return res.status(503).json({ error: "OPENAI_API_KEY not set" });

    const baseUrl = (ttsCfg.openaiBaseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = ttsCfg.openaiModelId || process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const voice = routeVoiceId || ttsCfg.openaiVoiceId || process.env.OPENAI_TTS_VOICE || "alloy";

    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/audio/speech` : `${baseUrl}/v1/audio/speech`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "User-Agent": "payphone-ollama-tts/1.0",
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        format: "mp3",
      }),
    });

    const raw = Buffer.from(await r.arrayBuffer());
    if (!r.ok) {
      const errText = raw.toString("utf8").slice(0, 1200);
      return res.status(502).json({ error: "openai_tts_error", status: r.status, body: errText });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(raw);
  }

  if (provider === "kittentts") {
    const { spawn } = await import('node:child_process')
    const python = (ttsCfg.kittenPythonBin || process.env.KITTENTTS_PYTHON || 'python3').trim()
    const model = (ttsCfg.kittenModelId || process.env.KITTENTTS_MODEL || 'KittenML/kitten-tts-mini-0.8').trim()
    const voice = (routeVoiceId || ttsCfg.kittenVoiceId || process.env.KITTENTTS_VOICE || 'Jasper').trim()

    // Safety: cap text length further for local TTS
    const clipped = String(text).slice(0, 2000)

    const { fileURLToPath } = await import('node:url')
    const scriptPath = fileURLToPath(new URL('./kittentts_runner.py', import.meta.url))
    const args = [scriptPath, '--model', model, '--voice', voice, '--text', clipped]

    const child = spawn(python, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c) => chunks.push(Buffer.from(c)))
    child.stderr.on('data', (c) => errChunks.push(Buffer.from(c)))

    const code: number = await new Promise((resolve) => child.on('close', resolve)) as any
    const out = Buffer.concat(chunks)
    if (code !== 0 || out.length === 0) {
      const errText = Buffer.concat(errChunks).toString('utf8').slice(0, 1200)
      return res.status(502).json({ error: 'kittentts_error', code, stderr: errText })
    }

    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(out)
  }

  // Default: inworld
  const inworldApiKey = ttsCfg.inworldApiKey || process.env.INWORLD_API_KEY || "";
  if (!inworldApiKey) return res.status(503).json({ error: "INWORLD_API_KEY not set" });

  const voiceId = routeVoiceId || ttsCfg.inworldVoiceId || process.env.INWORLD_VOICE_ID || "Timothy";
  const modelId = ttsCfg.inworldModelId || process.env.INWORLD_MODEL_ID || "inworld-tts-1.5-mini";

  const url = `https://api.inworld.ai/tts/v1/voice`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${inworldApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "payphone-ollama-tts/1.0",
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId,
      timestampType: "TIMESTAMP_TYPE_UNSPECIFIED",
      audioConfig: { temperature: 0.2 },
    }),
  });

  const raw = Buffer.from(await r.arrayBuffer());
  if (!r.ok) {
    const errText = raw.toString("utf8").slice(0, 1200);
    return res.status(502).json({ error: "inworld_error", status: r.status, body: errText });
  }

  let audioBytes: Buffer = raw;
  try {
    const payload = JSON.parse(raw.toString("utf8"));
    const b64 = payload?.audioContent || payload?.result?.audioContent;
    if (typeof b64 === "string" && b64.length > 0) {
      audioBytes = Buffer.from(b64, "base64");
    }
  } catch {
    // not json
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.send(audioBytes);
});

app.post("/api/stt", async (req, res) => {
  if (!DEEPGRAM_API_KEY) return res.status(503).json({ error: "DEEPGRAM_API_KEY not set" });

  const contentType = String(
    req.query.contentType || req.headers["content-type"] || "application/octet-stream"
  );

  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(Buffer.from(c)));
  req.on("end", async () => {
    const audio = Buffer.concat(chunks);

    const dgUrl = new URL("https://api.deepgram.com/v1/listen");
    dgUrl.searchParams.set("model", DEEPGRAM_MODEL);
    dgUrl.searchParams.set("language", DEEPGRAM_LANGUAGE);
    dgUrl.searchParams.set("smart_format", "true");

    const r = await fetch(dgUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": contentType,
      },
      body: audio,
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(502).json({ error: "deepgram_error", status: r.status, body: errText });
    }

    const data = (await r.json()) as any;
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    res.json({ transcript, raw: data });
  });
});
