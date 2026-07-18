# Stagecraft — Personal Toastmasters Coach

Local-first speech coaching built around **Gemma 4** native audio understanding.

## Quick start

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) with an audio-capable Gemma 4 model:

```bash
ollama pull gemma4:e4b
# or use the already-pulled alias:
# ollama pull gemma4
```

Confirm Ollama is running (`ollama list`). This repo defaults to `gemma4:latest` (E4B).

### Install & run

```bash
npm install
copy .env.example .env.local   # Windows
npm run seed                  # optional demo history
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product loop

Record → Gemma 4 (transcribe + evaluate) → code metrics → review → progress.

## Stack

- Next.js (App Router) + React
- Browser `MediaRecorder` → client-side 16 kHz mono WAV conversion
- Ollama + Gemma 4 E4B (primary)
- SQLite (`better-sqlite3`) for sessions / goals
- Zod schema validation for structured coaching output
- Recharts for progress trends

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local app |
| `npm run seed` | Pre-load 4 demo sessions for Progress/History |
| `npm run prepare-demo` | Download known-good sample speech for mic fallback |
| `npm run verify` / `npm test` | Unit + HTTP + Gemma E2E verification suite |
| `npm run build` | Production build |

## Notes for demo day

1. Test Ollama audio on the **demo machine** beforehand.
2. Keep a pre-recorded good WAV ready if live mic fails.
3. Seeded history keeps the Progress dashboard believable after one live take.
4. If local inference is too slow, point `OLLAMA_BASE_URL` / model to a hosted path (cloud fallback wiring can reuse the same prompt + schema).

See `personaltoastmasterscoach.md` for the full build plan and `KAGGLE_WRITEUP.md` for the submission draft.
