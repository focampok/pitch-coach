# Pitch Coach — Working guide for agents

> This file applies to **Claude Code** and **Roo Code**. Both agents follow these rules inside this codebase. Project documentation is written in English. The product UI stays bilingual (Spanish and English).

## Development environment

- **All development happens on native Linux Mint.** Docker and containers are not used for local development.
- **Do not generate `docker-compose.yml` or instructions that assume containers** to run the project locally (for example "start the container" or "shell into the container"). Commands assume a direct run on the system (`npm run dev`, `npm install`, and so on).
- The only Docker use in the project is a **`Dockerfile` reserved for production on Railway**. This Dockerfile:
  - Is not used or run locally.
  - Exists so Railway can build and deploy the application.
  - Is not part of the daily development flow and is not a debugging tool.
- Any install, test, or run instructions an agent proposes must work directly on the operating system (Linux Mint), with no container step in between.

## Next.js configuration — agentRules: false

`next.config.ts` sets `agentRules: false`. This is intentional, not a leftover default.

**What it does:** Next.js 16 can, on `npm run dev`, generate or edit an AI-agent rules file at the repo root. By default it tries to use `CLAUDE.md` and inject a generic Next.js block.

**Why it is off:** when the project was created, that feature replaced `CLAUDE.md` with a one-line pointer to a generated `AGENTS.md`, and later startups kept appending unsolicited content. `CLAUDE.md` is the source of truth for working rules (Roo Code reads it through the symlink in `.roo/rules/`). Leaving the feature on risked diluting or overwriting those rules on every server start.

**Rule for agents:** do not turn `agentRules` back on or remove this setting unless someone asks for it explicitly. If Next.js later needs to manage an agent-rules file, point it at a file other than `CLAUDE.md` (for example its own `AGENTS.md`), never at `CLAUDE.md` itself.

## Environment variables

- All credentials and keys (Gemini, and any later key) live **only** in environment variables. Never hardcode them, not even "just to try".
- `.env.local` at the repo root is for local development — **never commit it**. It belongs in `.gitignore` from the first commit.
- `.env.example` is committed, with the same keys and no real values (or with placeholders), so the required variables stay documented.
- Expected variables (keep this list current as keys are added):
  - `MODEL_PROVIDER` — `nebius` (default) or `gemini`.
  - `NEBIUS_API_KEY` — analysis with Nebius Token Factory (required with the default provider). Server-side only.
  - `NEBIUS_BASE_URL`, `NEBIUS_MODEL_ULTRA`, `NEBIUS_MODEL_NANO` — optional; see `.env.example`.
  - `MODEL`, `MODEL_FALLBACK_MODELS`, `MODEL_MAX_TOKENS`, `MODEL_TEMPERATURE`, `MODEL_RETRY_*` — provider-neutral model settings.
  - `GEMINI_API_KEY` — Gemini API key, only if `MODEL_PROVIDER=gemini`. Server-side.
  - `ELEVENLABS_API_KEY` — ElevenLabs key (verdict TTS and Scribe STT), used only in API routes (server-side), never exposed to the client.
  - `ELEVENLABS_VOICE_ID_MALE` — male Spanish voice id (VoiceLab). Server-side only.
  - `ELEVENLABS_VOICE_ID_FEMALE` — female Spanish voice id (VoiceLab). Server-side only.
  - `ELEVENLABS_VOICE_ID_EN_MALE` — male English voice id. Server-side only.
  - `ELEVENLABS_VOICE_ID_EN_FEMALE` — female English voice id. Server-side only.
  - `ELEVENLABS_SCRIBE_MODEL` — Scribe batch model (default `scribe_v2`). Server-side only.
  - `TAVILY_API_KEY` — Tavily key (statistics for suggestions, the room objection, and the spoken-figure check), used only in API routes (server-side), never exposed to the client.
  - `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*` — optional monitoring; see `.env.example` and `docs/sentry.md`. The client DSN is public ingest by Sentry's design; `SENTRY_AUTH_TOKEN` never uses the `NEXT_PUBLIC_` prefix.
  - On Railway, set the same keys in the project panel (Settings → Variables) as in `.env.local`.
  - Any variable that starts with `NEXT_PUBLIC_` is exposed to the browser — **never use that prefix for API keys or secrets**.

## Folder structure (scaffolding)

Next.js (App Router) in one repository, no separate backend:

```
pitch-coach/
├── CLAUDE.md
├── README.md
├── PRODUCT.md              # product layer (no tokens) — product source of truth
├── DESIGN.md               # visual system and tokens — design source of truth
├── .roo/
│   └── rules/
│       └── CLAUDE.md -> symlink to ../../CLAUDE.md
├── docs/
│   ├── README.md           # documentation index
│   ├── alcance.md          # product and business rules
│   ├── status.md           # implementation ↔ code
│   ├── sentry.md           # monitoring and privacy decisions
│   ├── pre-nebius.md       # historical baseline (before Nebius)
│   ├── post-nebius.md      # state after the Nebius migration
│   ├── guia-integracion-*.md
│   └── referencias-ui/     # proposed visual evidence (not a contract)
├── .env.local              # not committed
├── .env.example
├── Dockerfile              # Railway build/deploy only, not used locally
├── railway.toml            # Dockerfile builder + healthcheck for Railway
├── .dockerignore
├── package.json
├── next.config.ts
├── src/
│   ├── app/
│   │   ├── page.tsx                 # selector + recording + transcript + fillers
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── analizar-pitch/       # analysis (Nebius/Gemini)
│   │       ├── transcribir/          # Scribe STT
│   │       ├── tts/
│   │       ├── enriquecer/           # Tavily
│   │       ├── linea-tiempo/         # covered points on the audio
│   │       ├── segunda-toma/         # 45-second retake
│   │       └── sparring/             # resolve findings
│   ├── components/
│   │   ├── SelectorTipoPitch.tsx, SelectorDuracion.tsx, SelectorIdioma.tsx
│   │   ├── GrabadorVoz.tsx           # MediaRecorder + Scribe + indicator
│   │   ├── DashboardResultado.tsx, SparringCoach.tsx, PanelProgreso.tsx
│   │   ├── SegundaToma.tsx
│   │   └── ReproductorVeredicto.tsx  # ElevenLabs TTS + SpeechSynthesis
│   ├── lib/
│   │   ├── modelo.ts, proveedor-nebius.ts, proveedor-gemini.ts
│   │   ├── rubricas.ts, muletillas.ts, prompts.ts, prompts-sparring.ts
│   │   ├── diccionario-es.ts, diccionario-en.ts, idiomas.ts
│   │   ├── salas.ts, objecion-sala.ts, cifras-dichas.ts, linea-tiempo.ts
│   │   └── mensajes-coach.ts
│   └── types/
│       └── pitch.ts
└── public/
```

### README.md

The repo has a root `README.md` with at least:

- The project name and one line on what it does (see `docs/alcance.md` section 2, "Concept").
- The MIT license and that the project is open source.
- A short stack (Next.js, Nebius/Gemini, MediaRecorder, ElevenLabs Scribe/TTS, Tavily, Railway).
- Local setup:
  - Clone the repo.
  - `npm install`.
  - Copy `.env.example` to `.env.local` and fill in the keys documented there (`NEBIUS_API_KEY` with the default provider; the rest degrades with a fallback).
  - `npm run dev` to run locally (no Docker, native execution).
- An explicit note that the `Dockerfile` is for deploy only and is not used in local development.
- It is updated as the project moves. It is not a static document.
- It is written in English, like the rest of the markdown in this repo.

### .gitignore

It includes at least:

```
# dependencies
node_modules/

# Next.js build
.next/
out/

# environment variables (never committed)
.env
.env.local
.env*.local

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# operating system / editor
.DS_Store
*.pem

# Railway (if it generates local config files)
.railway/
```

`.env.example` is the only environment file that **is** committed, because it has no real values.

Notes on the structure:

- Business logic (rubrics, filler detection, prompt construction) lives in `src/lib/`, separate from UI components, so an agent can edit one without touching the other.
- Pitch analysis lives in `/api/analizar-pitch`. ElevenLabs TTS and Scribe are additional server-side API routes. Do not expose keys to the client.
- `Dockerfile` and `railway.toml` live at the root because Railway expects them there. That does not mean they are used in development (see the development-environment rule above).

## Language convention

- **The product is bilingual (es / en).** The market is still LATAM. What the end user sees follows the session language: UI copy, error messages, rubrics, spoken and written verdicts, and model feedback.
- **The session language is the `idioma` parameter (`'es' | 'en'`).** It travels on the API (request body; `X-Idioma` header when the body cannot be read yet). On the client it is resolved in `src/lib/idiomas.ts`: first the value stored in `localStorage` (key `pitch-coach:idioma`), otherwise `navigator.language` / `navigator.languages`. If there is no signal, the fallback is `'es'`.
- **Interface copy.** `src/lib/diccionarios.ts` exposes the `Diccionario` interface and the `diccionario(idioma)` selector. The content lives in `src/lib/diccionario-es.ts` and `src/lib/diccionario-en.ts`. The shape comes from Spanish (`export type Diccionario = typeof es` in `diccionario-es.ts`). English is typed against that shape, so a missing or extra key fails the build.
- **Prompts.** Each provider prompt asks for the answer in the session language, not always in Spanish. In `src/lib/prompts.ts` the schema is per language: a `system` constructor and a `user` constructor per language (`CONSTRUCTORES_SYSTEM`, `CONSTRUCTORES_USER`). The same rule applies to `src/lib/prompts-sparring.ts`.
- **Do not "fix" the English.** A later agent must not rewrite an English output, UI string, verdict, or prompt into Spanish on the assumption that the project is Spanish-only. If `idioma` is `en`, the English output is the correct one.
- **Documentation is English.** Markdown in this repo (README, `docs/`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md`) is written in English. Do not translate those files back to Spanish.
- **Code is written in English**, following ordinary industry convention:
  - Names of variables, functions, types, and generic technical files (for example `route.ts`, `page.tsx`) are English.
  - Comments may be in Spanish when they explain a specific business context (for example a rubric). Purely technical logic is commented in English.
- **Intentional exception:** file and component names tied directly to Spanish business concepts (as in the scaffolding above: `SelectorTipoPitch.tsx`, `rubricas.ts`) stay in Spanish because they name the product domain and keep the purpose unambiguous. If full English consistency is wanted for code names, update this section before generating new files.
