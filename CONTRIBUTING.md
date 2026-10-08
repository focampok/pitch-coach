# Contributing — Pitch Coach

Thanks for contributing to **Pitch Coach**. It is open source (MIT). Help of
any size counts, from a bug report to a new language or pitch type.

## Run it locally

The **Local setup** section of the [README](README.md) is the source of truth.
Short version:

1. Clone the repository.
2. `npm install`
3. Copy `.env.example` to `.env.local`:
   - `NEBIUS_API_KEY` — analysis with the default provider (**required**).
   - Or `MODEL_PROVIDER=gemini` + `GEMINI_API_KEY` as the fallback.
   - `ELEVENLABS_API_KEY` — STT (Scribe) and TTS. Without it there is backup
     text and SpeechSynthesis.
   - Voice IDs in Spanish and English (see `.env.example`).
   - `TAVILY_API_KEY` — optional. Without it there are no suggestions.
4. `npm run dev`

Native development, no Docker. The `Dockerfile` is only for Railway.

**Browser:** Chrome, Firefox, Safari, Brave, or a phone with a microphone.
STT is MediaRecorder plus Scribe on the server.

**Tests:** `npm test` before opening a PR.

## Conventions

- **Bilingual product (es / en):** UI copy, visible rubric labels, prompts, and
  model output follow the session language (`idioma`). See
  [`CLAUDE.md`](CLAUDE.md) and [`docs/alcance.md`](docs/alcance.md) §15.
- **Documentation is English.** Markdown in this repo is written in English.
  The app itself stays bilingual.
- **Code:** technical names in English. Business-domain files may stay in
  Spanish, such as `rubricas.ts` or `SelectorTipoPitch.tsx`.

## Extension points

### New pitch type

1. Rubric in [`src/lib/rubricas.ts`](src/lib/rubricas.ts): 5 points with a
   stable `id`, plus `nombre` and `queBuscar` **per language**.
2. Option in [`src/components/SelectorTipoPitch.tsx`](src/components/SelectorTipoPitch.tsx).
3. Type in [`src/types/pitch.ts`](src/types/pitch.ts) (`TipoPitch`).
4. UI keys in [`src/lib/diccionario-es.ts`](src/lib/diccionario-es.ts) and
   [`src/lib/diccionario-en.ts`](src/lib/diccionario-en.ts).

### New filler word

Patterns live in [`src/lib/muletillas.ts`](src/lib/muletillas.ts) — one source
for counting and highlighting. In English, extend `patronesMuletillas("en")`
with the same context rules as the existing patterns (`like`, `so`, `right`,
and the rest).

### New language

Add data. Do not branch the components:

1. Entry in [`src/lib/idiomas.ts`](src/lib/idiomas.ts)
2. New dictionary typed against `typeof es`
3. Voice ID pair in `.env.example`, read by TTS
4. Filler-word patterns if they apply

### Coach (status / copy)

Text indicator in [`src/lib/mensajes-coach.ts`](src/lib/mensajes-coach.ts) and
the dictionaries. The visual replacement (animation) belongs to the UX/UI
phase — see [`docs/alcance.md`](docs/alcance.md) §5.1.

## What a PR should include

- `npm test` and `npm run lint` green.
- If you touch recording, the dashboard, or voice: a **manual check** in the
  description:
  - What you tried (steps).
  - What you saw.
  - Browser and session language.

## How to report bugs

Open an **Issue** with:

- Browser and version.
- Console errors (do not paste long transcripts or API keys).
- Steps to reproduce, and expected versus actual result.

More context: [`docs/README.md`](docs/README.md).
