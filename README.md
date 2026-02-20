# 📞 Payphone Ollama TTS

A fun, retro-styled web UI that lets you "dial" different AI personas on a vintage payphone interface and have voice conversations with them.

> **This is a passion project** — built for the joy of talking to AI agents (including **OpenClaw**) through a nostalgic payphone metaphor. Pick up the receiver, dial a number, and chat away!

---

## 🎨 What Is This?

Imagine a 1980s payphone that can call AI personalities:

- **Dial `1`** → Plutus (finance assistant)
- **Dial `2`** → Comedian
- **Dial `3`** → Lisabot
- **Dial `4`** → Self-image persona
- **Dial custom numbers** → Configure your own routes!

Once connected, type your message and the AI responds **out loud** using text-to-speech (Inworld, ElevenLabs, or OpenAI TTS).

---

## ⚠️ Repository Size Apology

**Sorry about the large repo size!** 🙏

This project uses **frame-by-frame PNG animations** to recreate authentic retro UI interactions:

| Animation | Frames | Size |
|-----------|--------|------|
| Dialpad animation | 150 frames | ~93 MB |
| Address book intro | 192 frames | ~139 MB |
| **Total animations** | **342 frames** | **~232 MB** |

These animations create a polished, nostalgic experience but do bloat the repository. If you're cloning just to experiment, consider using `--depth 1` or checking out the code without history.

```bash
git clone --depth 1 https://github.com/yourusername/llm-payphone.git
```

---

## 🚀 Quick Start

```bash
cd llm-payphone
cp .env.example .env
# Edit .env with your API keys and preferences
npm install
npm run dev
```

### Optional: enable KittenTTS (local)

KittenTTS is a local TTS option.

There are **two modes**:

#### Mode A (recommended): persistent KittenTTS microservice (separate project)

This keeps the model warm in memory and avoids spawning Python for every TTS request.

- Run the microservice separately (recommended repo/folder name: `kittentts-microservice`)
- Configure payphone to call it via HTTP.

In `.env`:

```bash
KITTENTTS_BASE_URL=http://127.0.0.1:9123
KITTENTTS_VOICE=Jasper
```

In the app Settings → TTS, select **KittenTTS (local)** and pick a voice.

#### Mode B (fallback): per-request python spawn (no service)

This repo can also call a tiny Python helper (`server/kittentts_runner.py`) per request.

**Requirements:** Python 3.12.

Install KittenTTS (wheel) + deps:

```bash
python3.12 -m venv .venv-kittentts
source .venv-kittentts/bin/activate
pip install --upgrade pip
pip install https://github.com/KittenML/KittenTTS/releases/download/0.8/kittentts-0.8.0-py3-none-any.whl
```

Then set in `.env`:

```bash
KITTENTTS_PYTHON=./.venv-kittentts/bin/python
KITTENTTS_MODEL=KittenML/kitten-tts-mini-0.8
KITTENTTS_VOICE=Jasper
```

**Access points:**
- **Web UI:** http://localhost:5173 (binds to 0.0.0.0)
- **API:** http://localhost:5174

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Backend** | Node.js, Express, tsx |
| **AI Providers** | Ollama, OpenAI-compatible APIs, OpenClaw |
| **TTS** | Inworld, ElevenLabs, OpenAI |
| **STT** | Deepgram |
| **UI Components** | Radix UI, shadcn/ui patterns |

---

## 📡 Provider Support

### LLM Providers
- **Ollama** (local models)
- **OpenAI-compatible** (OpenAI, OpenRouter, Groq, Together, LM Studio)
- **OpenClaw** (with agent ID support)

### Text-to-Speech
- **Inworld** (default)
- **ElevenLabs**
- **OpenAI TTS**
- **KittenTTS (local)** — lightweight local model (uses `kitten-tts-mini`)

### Speech-to-Text
- **Deepgram** (for voice input)

---

## ⌨️ Keypad Controls

| Key | Action |
|-----|--------|
| `0-9`, `*`, `#` | Dial digits |
| `#` | Connect call |
| `*` | Clear input |

---

## 🔧 Keypad Calibration

If the clickable keypad region is offset on your device/browser:

1. Open `/?calibrate=1`
2. Adjust the keypad region using:
   - **Move:** Arrow keys (Shift = faster)
   - **Width:** `[` and `]`
   - **Height:** `;` and `'`
   - **Reset:** `R`

Calibration is saved per browser in localStorage.

**Default calibration** (tested on Firefox): `x=56.5 y=56.2 w=12.8 h=28.5`

---

## 📁 Project Structure

```
llm-payphone/
├── src/                    # React frontend
│   ├── components/
│   │   ├── PayphoneChat.tsx
│   │   └── ai-elements/
│   └── App.tsx             # Main app logic
├── server/                 # Express backend
│   ├── app.ts              # API routes
│   ├── routes_store.ts     # Route persistence
│   └── tts_store.ts        # TTS config
├── public/
│   ├── dialpad_anim/       # 150-frame dialpad animation
│   ├── addressbook_intro/  # 192-frame address book animation
│   └── avatars/            # Pixel art avatars
└── tts.json                # TTS provider config
```

---

## 🎯 Features

- 📞 **Retro payphone UI** with frame-perfect animations
- 🎭 **Multiple personas** via speed-dial numbers
- 🔊 **Voice responses** via TTS
- ⌨️ **DTMF tones** for authentic dial sounds
- 📱 **Mobile responsive** with touch-friendly keypad
- 🔧 **Configurable routes** via settings overlay
- 💾 **Persistent config** saved to disk
- 🌐 **Multi-provider** LLM and TTS support

---

## 🙏 Acknowledgments

Built for fun and experimentation with local AI. The payphone aesthetic is a love letter to retro telecom interfaces.

**Enjoy your calls!** 📞✨
