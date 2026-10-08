# Documentation — Pitch Coach

Index by goal ([Diátaxis](https://diataxis.fr/)). These documents are the
source of truth for the product and the code. They are written in English.
The app itself is bilingual (Spanish and English).

**Design sources of truth:** `PRODUCT.md` (product layer, no tokens),
`DESIGN.md` (the only formal home of the visual system and its tokens), and
[`docs/referencias-ui/`](referencias-ui/README.md) (evidence and a **proposed**
direction, not yet a contract). If the visuals disagree, `DESIGN.md` wins.

## Start here (tutorial)

1. [README](../README.md) — what the project is, local setup, and deploy.
2. Copy [`.env.example`](../.env.example) → `.env.local` and fill in the keys.
3. `npm run dev` and try the loop with a microphone (or the backup text field).

## Guides (how to solve a problem)

| Guide | When to use it |
| --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | New pitch type, filler word, language, or PR |
| [guia-integracion-nebius.md](guia-integracion-nebius.md) | Model layer, JSON schema, Nebius smoke test |
| [guia-integracion-gemini.md](guia-integracion-gemini.md) | Fallback `MODEL_PROVIDER=gemini` |
| [guia-integracion-elevenlabs.md](guia-integracion-elevenlabs.md) | Scribe (STT) and TTS |
| [guia-integracion-tavily.md](guia-integracion-tavily.md) | Suggestion pipeline on `/api/enriquecer` |
| [guia-readme-pitch-coach.md](guia-readme-pitch-coach.md) | How to keep the root README current |

## Reference (what is what)

| Document | Contents |
| --- | --- |
| [alcance.md](alcance.md) | Problem, user loop, rubrics, bilingual mode, services, out of scope |
| [status.md](status.md) | Implemented ↔ files, environment variables, tests, Sentry (summary) |
| [PRODUCT.md](../PRODUCT.md) | Product layer: users, purpose, context, hackathon, principles (no tokens) |
| [DESIGN.md](../DESIGN.md) | Visual system and tokens — **design source of truth** |
| [referencias-ui/](referencias-ui/README.md) | **Proposed** visual evidence and direction (palette, motion, references) |
| [mejoras_ux.md](mejoras_ux.md) | Design review (5 Oct): strengths, prioritized findings, action plan |
| [`.env.example`](../.env.example) | Full variable list and documented defaults |
| [CLAUDE.md](../CLAUDE.md) | Repo conventions for people and agents |
| [formulario-devpost.md](formulario-devpost.md) | Devpost additional-info fields, ready to paste |

### API routes (server)

| Route | Role |
| --- | --- |
| `POST /api/transcribir` | Audio → text (Scribe) |
| `POST /api/analizar-pitch` | Transcript → rubric, clarity, verdict, score |
| `POST /api/tts` | Text → audio (verdict / questions) |
| `POST /api/enriquecer` | Tavily: cited figures, one room objection, one spoken-figure check |
| `POST /api/linea-tiempo` | Place covered rubric points on Scribe timestamps |
| `POST /api/segunda-toma` | Judge a 45-second retake of one missed point |
| `POST /api/sparring/pregunta` | Follow-up question (findings) |
| `POST /api/sparring/evaluar` | Judge the user's answer |

Every route accepts `idioma` (`es` \| `en`). A 429 uses the `X-Idioma` header
when the body has not been read yet. Detail in [alcance.md §15](alcance.md).

## Explanation (why it is this way)

| Document | Topic |
| --- | --- |
| [sentry.md](sentry.md) | Privacy, PII scrubbing, source maps, SDK decisions |
| [pre-nebius.md](pre-nebius.md) | Repo baseline **before** the Nebius migration (tag `pre-nebius`) |
| [post-nebius.md](post-nebius.md) | State **after** that baseline; aligned with [status.md](status.md) |
| [pitch-coach-review.md](pitch-coach-review.md) | Hackathon review snapshot |

- **`pre-nebius.md`** — frozen at the `pre-nebius` tag (how the project was).
- **`post-nebius.md`** — before/after narrative plus the Nebius architecture.
- **`status.md`** — file ↔ code table and verification notes (the living source).

## UX/UI status

The visual language is defined and mostly implemented. The live indicator is
the ring in [`AnilloSenal.tsx`](../src/components/AnilloSenal.tsx): an arc that
reacts to the audio while recording and settles as the score on the result
(three modes of the same stroke). The direction is **anti-orb** (no glowing
sphere), with a single olive tint. Live STT (Scribe Realtime) is out of the
current scope.

Findings and the close-out plan for that phase are in
[mejoras_ux.md](mejoras_ux.md). Design sources, in this order:

1. [`PRODUCT.md`](../PRODUCT.md) — product layer and brand commitments.
2. [`DESIGN.md`](../DESIGN.md) — current visual system and the **formal home**
   of approved tokens.
3. [`referencias-ui/README.md`](referencias-ui/README.md) — **proposed**
   direction and palette.
4. [`referencias-ui/RESUMEN-REFS-UI.md`](referencias-ui/RESUMEN-REFS-UI.md) —
   curated summary of the references.
5. [`referencias-ui/01-visualizador-audio/FICHAS.md`](referencias-ui/01-visualizador-audio/FICHAS.md)
   — notes on the audio-visualizer screenshots.
