# Post-Nebius state

Document **after** the [`docs/pre-nebius.md`](pre-nebius.md) baseline. It describes the
repository in its current state: the migration to Nebius Token Factory, the prior
hardening, and everything implemented since then (universal STT, bilingual mode,
findings, Ultra, enriched Tavily, Sentry, local history, downloadable script, and
so on).

**Living counterpart of the file ↔ code map:** [`docs/status.md`](status.md) (same
cutoff date and the same verification standard). This file emphasizes the **before /
after** against the `pre-nebius` tag and the architecture of the model layer; the
tabular implementation detail is not duplicated here — it lives in `status.md` §1.

| Reference | Value |
| --- | --- |
| Baseline | tag `pre-nebius` → `51ddfd6` (2026-08-30) |
| Documented state | `HEAD` on `main` as of **2026-10-02** → `e90781a` ("feat(stt): download a timed pitch script…") |
| Commits since the tag | 26 (`git rev-list --count pre-nebius..HEAD`) |
| Cumulative diff vs tag | 117 files, +21325 / −2284 (`git diff --shortstat pre-nebius HEAD`) |

Nebius milestone (the provider migration only, not the whole repo):

```
c018cc6 hardening: secure, determinize and isolate the model layer before Nebius
6024240 docs: document pre-nebius baseline for the Nebius migration
ea1c55e feat(model): add Nebius Token Factory provider, standard + ultra tiers
15902cb feat(modelo): log mínimo no sensible en la ruta de éxito
```

Everything after that on `main` (Scribe, sparring, bilingual mode, Tavily phases A/B,
Sentry, history, script, and so on) is reflected in the **product summary** (§4) and
in [`status.md`](status.md).

---

## 1. Analysis architecture (now)

The API route does not know concrete providers. The flow is: **route → use case →
neutral layer → adapter**.

| Layer | File | Role |
| --- | --- | --- |
| HTTP entry | [`src/app/api/analizar-pitch/route.ts`](../src/app/api/analizar-pitch/route.ts) | Validates the body and `idioma`, 8000-character limit (413), prompt, `analizarConModelo`, composes `ResultadoAnalisis` with server-side filler words, generic 502 to the client |
| Use case | [`src/lib/analisis-modelo.ts`](../src/lib/analisis-modelo.ts) | `system` + `user`, schema, point names, `validarAnalisis` |
| Shared policy | [`src/lib/modelo.ts`](../src/lib/modelo.ts) | Fallbacks, retries, backoff, timeout (20 s standard/fast; 90 s ultra), JSON parsing |
| Adapters | [`proveedor-nebius.ts`](../src/lib/proveedor-nebius.ts), [`proveedor-gemini.ts`](../src/lib/proveedor-gemini.ts) | HTTP transport only |

**Provider selection:** `proveedorActivo()` reads `MODEL_PROVIDER` on every
call. Default **`nebius`**; `gemini` is a manual contingency; any other value →
`ErrorModelo`.

**Three Nebius tiers** (`crearProveedorNebius(nivel)`):

| Tier | Use in the product | Model | Reasoning |
| --- | --- | --- | --- |
| `estandar` | Main pitch analysis | `MODEL` (default Super) | `enable_thinking: false` |
| `ultra` | "Ultra analysis" button on the dashboard | `NEBIUS_MODEL_ULTRA` | Field omitted (thinking on) + `traza` in the JSON |
| `rapido` | Sparring, Tavily, auxiliary checks | `NEBIUS_MODEL_NANO` | `enable_thinking: false` |

Gemini ignores the tier (`estandar` / `ultra` / `rapido`): a single model quality
via `GEMINI_*` / `MODEL_*`.

**Restricted schema (Nebius):** `construirEsquemaAnalisisRestringido(puntos)` in
[`validar-analisis.ts`](../src/lib/validar-analisis.ts) — exact length of
`rubrica`, items `{ cumplido, comentario }` with no `punto` and no `score`. Gemini uses the
neutral schema without a strict length constraint in the provider.

Operations guide: [`guia-integracion-nebius.md`](guia-integracion-nebius.md).

---

## 2. Output contract (now)

The model returns **only** the evaluation and the copy; the server assigns rubric
ids/names and computes the **score** deterministically:

```
score = clamp( round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100 )
```

Typical JSON (standard analysis):

```json
{
  "veredicto_corto": "Buen problema; falta cerrar el ask.",
  "claridad": 17,
  "rubrica": [
    { "cumplido": true, "comentario": "..." },
    { "cumplido": false, "comentario": "..." }
  ]
}
```

Ultra analysis adds `"traza": ["paso 1", "..."]` (4–8 steps). The prompt and the
schema are in the **session language** (`es` / `en`); see [`alcance.md`](alcance.md)
§15.

Local validation is **tolerant** of extra fields from the model; **strict** on the
number of rubric items (a mismatch triggers a retry through the neutral layer).

---

## 3. Comparison table (tag `pre-nebius` vs. current `HEAD`)

| Area | Before (`pre-nebius`) | After (`HEAD`, 2026-10-02) |
| --- | --- | --- |
| **LLM provider** | Gemini only, in `gemini.ts` | Nebius by default + Gemini as contingency; neutral layer |
| **Score and rubric names** | Invented by the model | Server: ids/names by index + deterministic score |
| **Prompt / injection** | One string with the transcript embedded | `system` / `user`, transcript delimited as untrusted data |
| **STT** | Web Speech API (Chrome) | MediaRecorder + **ElevenLabs Scribe** (`/api/transcribir`); fallback text |
| **XSS security** | `dangerouslySetInnerHTML` without escaping | Escaped HTML + highlight by intervals |
| **Limits and rate limit** | Did not exist | 8000 chars, 20 MB audio, 10/10 min (5/10 on `/api/enriquecer`) |
| **Tests** | None | Vitest: `src/lib/` + API routes (`npm test`) |
| **Language** | Spanish only in the product | Full **es / en** (UI, rubrics, prompts, voice, filler words) |
| **Ultra** | N/A | Dashboard button + trace |
| **Findings** | N/A | "Resolve findings" — `/api/sparring/*`, up to 3 points |
| **Tavily** | Simple `results[0]` | Pipeline with entities, Extract, figure validation, spoken sentence |
| **History** | N/A | `localStorage`, "Your progress" panel (20 entries) |
| **Script** | N/A | `.txt` download with `[mm:ss.cc]` marks if Scribe returned timestamps |
| **Coach UI** | Reactive avatar (2 states) | Temporary **text** indicator (UX/UI still pending) |
| **Observability** | Local logs | Optional **Sentry** with PII scrub (see `sentry.md`, `status.md` §5) |
| **API routes** | 3 | 6 (+ sparring question/evaluate, transcribe) |

Row-by-row detail of the Nebius migration (HTTP, `json_schema`, retry on
`length`): historical table in commits `ea1c55e`–`15902cb`; current behavior
matches [`guia-integracion-nebius.md`](guia-integracion-nebius.md).

---

## 4. Product state (aligned with `status.md`)

Summary as of **2026-10-02** — the same content as the opening block of
[`status.md`](status.md). For the **Implemented ↔ files** table, use
`status.md` §1.

**Closed:**

- Loop from voice → Scribe → filler words → analysis → dashboard + verdict on demand.
- Coach indicator in text (`Escuchando…` / `Transcribiendo…` / closing phrases).
- Nebius/Gemini analysis, Ultra, Resolve findings, enriched Tavily (first 2
  failed rubric points), TTS without autoplay, local history, bilingual mode,
  downloadable script, Railway deploy, unit tests, Sentry with privacy.

**Conscious limitations (🟡):**

- Transcription is **not live** (batch Scribe when recording stops).
- Coach is **text only**; animation is in the UX/UI phase (live indicator, **not** an
  orb/sphere).
- Rate limit **in memory** per instance.
- No automated E2E with a microphone.

**Open for the community** (`status.md` §2): history across devices,
custom rubrics, new languages, Realtime STT, coach animation.

---

## 5. Repo structure (now)

Relevant root (without `node_modules` / `.next`):

```
src/app/api/     analizar-pitch, transcribir, tts, enriquecer, sparring/*
src/components/  selectors, GrabadorVoz, Dashboard, SparringCoach, PanelProgreso, …
src/lib/         modelo, proveedores, rubricas, muletillas, prompts*, tavily*, …
test/            vitest (lib + routes with mocked fetch)
docs/            alcance, status, pre/post-nebius, guides, sentry
```

**Demo:** the same URL as in the production README
(`pitch-coach-production-1c0c.up.railway.app`). MIT license.

Environment variables: [`.env.example`](../.env.example) and `status.md` §3.

---

## 6. Evidence and tests

| What | How |
| --- | --- |
| Real Nebius contract | `scripts/smoke-nebius.mjs` (Node ≥ 22.6, imports `src/lib` without a build) |
| Automatic regression | `npm test` — suite in `test/` (Nebius provider, validation, API, Sentry, Tavily, history, script, languages, …) |
| Nebius in production | Log `[modelo] proveedor=nebius modelo=…` on Railway (operational observation; see `status.md`) |
| Sentry privacy | Tests + audit documented in [`sentry.md`](sentry.md) and `status.md` §5 |

**Ultra mode:** implemented in the UI and the API; systematic measurement of reasoning
tokens in production is not instrumented in the logs (`modelo.ts` only prints
provider and model on success).

---

## 7. What did not return to the pre-Nebius state

These pieces **did change** relative to the `pre-nebius` tag and are **not** documented
as "the same as before":

- STT stopped being Web Speech → batch Scribe, universal.
- The product went from monolingual to bilingual, with stable rubric ids.
- Tavily went from minimal enrichment to a pipeline with validation and a spoken sentence.
- Observability: Sentry integrated with aggressive scrubbing (no Session Replay).
- Avatar removed → text indicator (product decision in `alcance.md` §5.1).

What **remains** as in the post-hardening era: anonymous session, fixed rubrics
(4×5), no separate backend, `Dockerfile` for deploy only, Gemini as a manual fallback.

---

## 8. Technical follow-ups (do not confuse with "not implemented")

Live items for maintainers — they are not debt from the `pre-nebius` tag:

1. **In-memory rate limit** — check whether Railway is running several replicas.
2. **Model tokens in logs** — propagate `usage` from the adapters if you want to
   audit cost/reasoning in production.
3. **Sentry SDK v12 migration** — `beforeSendTransaction` deprecated; plan
   `beforeSendSpan` (`sentry.md` §10).
4. **`genAI` trap** — do not install the `openai` SDK without turning off prompt capture
   (`sentry.md` §3.6.2).
5. **UX/UI** — the coach's visual language and possible Realtime STT (out of current
   scope in `alcance.md`).

---

## Cross-references

| Document | Use |
| --- | --- |
| [`pre-nebius.md`](pre-nebius.md) | Baseline **before** the hardening + migration |
| [`status.md`](status.md) | **Living** map of implemented ↔ files |
| [`alcance.md`](alcance.md) | Product rules and contracts (including bilingual mode) |
| [`guia-integracion-nebius.md`](guia-integracion-nebius.md) | HTTP, schema, smoke test |
| [`README.md`](../README.md) | Quick start and setup |
