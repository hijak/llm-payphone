# payphone-ollama-tts

Local "payphone" web UI that dials personas (1-4) and talks to a hosted Ollama model, then speaks replies via Inworld TTS.

## Run

```bash
cd /Users/jack/clawd/projects/payphone-ollama-tts
cp .env.example .env
# edit .env
npm install
npm run dev
```

- Web: http://localhost:5173 (binds 0.0.0.0)
- API: http://localhost:5174

## Dialplan

- `1` Plutus
- `2` Comedian
- `3` Lisabot
- `4` Self-image persona (name TBD)

Press `#` to connect, `*` to clear.

## Keypad calibration

If the clickable region is offset on a device/browser:

Open `/?calibrate=1` and adjust the keypad region (saved per browser in localStorage).

Controls:
- Move: Arrow keys (Shift = faster)
- Width: `[` and `]`
- Height: `;` and `'`
- Reset: `R`

Current default (good for Firefox per Jack): `x=56.5 y=56.2 w=12.8 h=28.5`.
