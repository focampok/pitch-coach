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
  - `LIVE_DEMO` — exact `true` runs the live demo. Any other value, or absent, pauses it (banner + 503 on provider routes). Server-side only.
  - `EVAL_LIMIT` — integer practices per browser. Empty, `0`, or invalid means unlimited. Server-side only.
  - `EVAL_COOKIE_SECRET` — HMAC secret for the `pc_eval` cookie, at least 32 random bytes. Required when `EVAL_LIMIT` is greater than 0. Server-side only. Never log it.
  - `DEMO_VIDEO_URL` — https URL of the demo video, or empty (the link is hidden). Server-side only.
  - `CONTACTO` — optional email or https URL on the exhausted-quota message. Server-side only.
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
│   │       ├── sparring/             # resolve findings
│   │       └── estado/               # live-demo pause + evaluation quota
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
│   │   ├── config-evaluacion.ts, cupo-evaluacion.ts
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

## Hackathon evaluation window

The pause and the practice quota exist only for hackathon judging, to protect shared credits. Pitch Coach stays account-free: no login, no judge codes, no plans.

`src/lib/config-evaluacion.ts` reads `LIVE_DEMO`, `EVAL_LIMIT`, `EVAL_COOKIE_SECRET`, `DEMO_VIDEO_URL`, and `CONTACTO` inside functions called per request (not as module constants). Provider routes and `GET /api/estado` are `force-dynamic`. Changing a variable and restarting the process, without a rebuild, changes the behavior.

- `LIVE_DEMO` must be the exact string `true`. Otherwise the home screen replaces the recorder with a pause banner, and `/api/analizar-pitch`, `/api/enriquecer`, `/api/linea-tiempo`, `/api/segunda-toma`, `/api/sparring/pregunta`, `/api/sparring/evaluar`, `/api/transcribir`, and `/api/tts` return 503 `{ error: "demo_pausada" }` before any provider call.
- When `EVAL_LIMIT` is a positive integer, a signed `pc_eval` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production, about 30 days) counts practices per browser. A missing, malformed, or badly signed cookie starts a new quota at 0. It is never unlimited and it never crashes the request. A negative or over-limit counter is clamped.
- The charge happens only after a successful, valid provider result, just before the 200: standard, fast, and Ultra analysis each cost 1 (standard and then Ultra is 2 across two requests); each resolved sparring finding costs 1; the 45-second retake costs 1. Enrich, timeline, sparring question, transcription, and TTS cost 0. Any 4xx, 5xx, timeout, abort, or invalid result costs 0. `/api/transcribir` accepts `proposito: "pitch" | "toma"` (default `pitch`). With `pitch` and no practices left it returns 429 `{ error: "cupo_evaluacion_agotado" }` before ElevenLabs. That 429 is not the rate-limit 429 (`demasiadasSolicitudes` plus `Retry-After`); `src/lib/rate-limit.ts` limits stay as they are.
- If `EVAL_LIMIT` is set and `EVAL_COOKIE_SECRET` is missing or shorter than 32 bytes, those routes fail closed with 503. The log names the variables and does not print their values or the cookie.
- With `EVAL_LIMIT` empty, `0`, or invalid, and `LIVE_DEMO=true`, there is no `pc_eval` cookie, no `X-Eval-*` header, and no new UI copy.
- `GET /api/estado` returns `{ liveDemo, limite, restantes, demoVideoUrl, contacto }` with `Cache-Control: no-store`. The client must not import the evaluation modules. It may keep the last `X-Eval-Restantes` in React state (and in `sessionStorage` as a visual cache only). The server is the source of truth.

Honest limitation: clearing the cookie (incognito, another browser, or clearing site data) opens a new quota. That stops a normal judge and a curious visitor. It does not stop a determined abuser. The real defenses are `LIVE_DEMO=false` outside the judging window, the per-IP limits in `src/lib/rate-limit.ts`, and the spend alerts Francisco sets by hand on Nebius, ElevenLabs, and Tavily.

Known race: two simultaneous requests with the same cookie can both pass the check and both call the provider. The second `Set-Cookie` overwrites the first, so the counter goes up by 1 while the provider was used twice. That is accepted; there is no shared store to close it.

## Language convention

- **The product is bilingual (es / en).** The market is still LATAM. What the end user sees follows the session language: UI copy, error messages, rubrics, spoken and written verdicts, and model feedback.
- **The session language is the `idioma` parameter (`'es' | 'en'`).** It travels on the API (request body; `X-Idioma` header when the body cannot be read yet; if that header is also missing, the `Accept-Language` header). On the server, the root layout reads `Accept-Language` (`idiomaDeAcceptLanguage` in `src/lib/idiomas.ts`) to serve `<html lang>`, the metadata, and the first render in the browser's language, so the home page is rendered per request, not prerendered. On the client it is resolved in the same module: first the value stored in `localStorage` (key `pitch-coach:idioma`), otherwise `navigator.language` / `navigator.languages`, otherwise the language the server chose. If there is no signal at all, the fallback is `'es'`.
- **Interface copy.** `src/lib/diccionarios.ts` exposes the `Diccionario` interface and the `diccionario(idioma)` selector. The content lives in `src/lib/diccionario-es.ts` and `src/lib/diccionario-en.ts`. The shape comes from Spanish (`export type Diccionario = typeof es` in `diccionario-es.ts`). English is typed against that shape, so a missing or extra key fails the build.
- **Prompts.** Each provider prompt asks for the answer in the session language, not always in Spanish. In `src/lib/prompts.ts` the schema is per language: a `system` constructor and a `user` constructor per language (`CONSTRUCTORES_SYSTEM`, `CONSTRUCTORES_USER`). The same rule applies to `src/lib/prompts-sparring.ts`.
- **Do not "fix" the English.** A later agent must not rewrite an English output, UI string, verdict, or prompt into Spanish on the assumption that the project is Spanish-only. If `idioma` is `en`, the English output is the correct one.
- **Documentation is English.** Markdown in this repo (README, `docs/`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md`) is written in English. Do not translate those files back to Spanish.
- **Code is written in English**, following ordinary industry convention:
  - Names of variables, functions, types, and generic technical files (for example `route.ts`, `page.tsx`) are English.
  - Comments may be in Spanish when they explain a specific business context (for example a rubric). Purely technical logic is commented in English.
- **Intentional exception:** file and component names tied directly to Spanish business concepts (as in the scaffolding above: `SelectorTipoPitch.tsx`, `rubricas.ts`) stay in Spanish because they name the product domain and keep the purpose unambiguous. If full English consistency is wanted for code names, update this section before generating new files.
