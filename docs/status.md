# Pitch Coach — Project status

> **2026-10-08.** What is implemented, mapped to `docs/alcance.md`.
> Documentation index: `docs/README.md`. Snapshot **after** vs tag
> `pre-nebius`: `docs/post-nebius.md` (this file is the operational detail).
> The loop (voice → analysis → dashboard + verdict on request) is closed.
> STT is universal (MediaRecorder + Scribe). Resolve findings, Ultra analysis,
> and the "Your progress" panel are implemented; microphone verification in
> each browser is left to the maintainer.
> **Bilingual mode (es / en)** is complete: interface, rubrics, prompts, API
> contract, voice (TTS and the Scribe hint), and filler words (§15 of alcance).
> The **reactive avatar and its reaction engine were removed**. The live
> measurement is the signal ring `AnilloSenal` (rest, live, settled); a short
> text status still reports recording, transcribing, and finished. Live STT
> stays out of scope (direction recorded in `docs/referencias-ui/`).
> **Tavily (phases A and B) complete**: auth by `Bearer` header, extraction of
> short entities (level `rapido`), a figure-oriented query (without the negative
> comment from Phase A) and `exclude_domains` for the known methodological
> domains, plus `language` / `filter_by_language` / `topic` / `time_range` on
> the search. A suggestion **is shown only if it passes a mandatory validation
> step** (Tavily Extract + level `rapido`) that requires a concrete cited
> figure with its source, and it is delivered with a **spoken phrase** ready to
> say out loud (the same TTS voice as the session). See the real evidence in
> `docs/guia-integracion-tavily.md` (§2).

## Quick summary

- ✅ Loop voice → transcription → filler words (MediaRecorder + Scribe).
- ✅ Coach status (§5.1): session-language text (`Listening…` /
  `Transcribing…` / 3 phrases when it finishes) and the signal ring
  `AnilloSenal`.
- ✅ Deploy: `Dockerfile` + `railway.toml`. The Dockerfile is for Railway only.
  Local development does not use Docker.
- ✅ Analysis with two providers: **Nebius** (default) and **Gemini**
  (manual contingency). Rubrics, prompt parameterized by language, time as
  context, structured JSON, fallbacks, and retries. Super analyzes every take.
  The model does not set the score.
- ✅ Dashboard: score, rubric, filler words, highlighted transcript, time.
- ✅ TTS: ElevenLabs via `/api/tts`, fallback to SpeechSynthesis.
  **No autoplay** — the user presses "Listen to the verdict".
- ✅ Tavily (§12): `POST /api/enriquecer` if there are missed points. Auth by
  `Authorization: Bearer` (the key does not go in the body). The query is built
  from short entities of the pitch + the visible name of the point (level
  `rapido`), **without repeating the negative comment** that produced useless
  results in the manual tests; known methodological domains — and automatic
  translation proxies (`translate.goog` and similar) — are excluded with
  `exclude_domains`. The search travels with `language` + `filter_by_language`,
  `topic` (`finance` for capital), and `time_range=year`. On the best source,
  **Tavily Extract** runs and a **mandatory validation step**: without a
  concrete figure cited with its source **and relevant to the pitch's
  topic/sector** (the validator receives the entities as comparison context),
  the suggestion is discarded. When it passes, a **spoken phrase** (8–12 s) is
  added in the session language, ready to say. The full pipeline runs only for
  the **first 2 rubric points** of the pitch type, in their order
  (`MAX_PUNTOS_ENRIQUECIDOS`); missed points left outside generate no external
  call. The transcript is never sent to Tavily. The same call adds **one room
  objection** (the first missed point; the room follows the type: investment
  panel, classroom, innovation committee, technical buyer) and the **check of
  one figure already said** (with a source of the same order, or the notice
  that none was found — the point is not penalized). Rubric ids do not change.
  With no key, or if Tavily fails, the rest of the UI continues.
- ✅ Timeline: `POST /api/linea-tiempo`. If Scribe returned marks, Nano places
  the covered points on the audio.
- ✅ Second take: `POST /api/segunda-toma`. 45 seconds on one missed point.
  If it is covered, history stores the id in `puntosCerrados` and does not
  store the retake text. The next practice of the same type and language does
  not remind that closed point. "Your progress" shows which points closed or
  opened versus the previous practice of the same type and language.
- ✅ Sentry: server and client errors, with a privacy filter (§5).
  **Session Replay disabled on purpose**; **the client IP is not reported**
  and **console breadcrumbs do not go out** (a real leak, closed). Client
  error path verified in Chrome.
- ✅ Unit tests (`npm test`, vitest) on the logic in `src/lib/`
  (including local history) and the analysis/sparring/transcribe routes
  (mocked fetch; no real calls to providers).
- ✅ Limits: transcript max 8000 characters; audio max 20 MB; sparring answer
  max 2000; in-memory rate limit per IP, **with a ceiling per route**
  (10 / 10 min; `/api/enriquecer`, 5 / 10 min, because of its cost per
  invocation).
- ✅ Ultra analysis: a dashboard button that re-analyzes the same transcript
  at level `ultra` (Nemotron Ultra, reasoning on). Shown in addition to the
  standard analysis, with a reasoning trace (4–8 steps). Opt-in.
- ✅ Resolve findings: up to 3 follow-up questions on the first missed rubric
  points. Text + "Listen to the question" (the same session voice); no
  autoplay. Nano.
- ✅ Local history: the last 20 practices are stored in this browser's
  `localStorage` (no account and no server). The "Your progress" panel lists
  them. Transcript, comments, trace, questions, answers, and audio are not
  stored. The panel shows which points closed or opened versus the previous
  practice of the same type and language.
- ✅ **Bilingual mode (es / en)**: selector on the home page, typed
  dictionaries, rubrics with stable ids, API error messages in the requested
  language, prompts that instruct the output in that language, a TTS voice
  pair per language, Scribe hint, and English filler words. The language is
  remembered in this browser and, if none is saved, it comes from the browser.
  UI strings stay in both languages.
- 🟡 Transcription is not live (record → stop → transcribe). Scribe Realtime
  is left for later; there is no calendar date.

## Legend

- ✅ Implemented and tested in the browser
- 🟡 Implemented with a known limitation
- ⬜ Not implemented (open idea for the community)

## 1. Implemented

| Status | Item | Files | Notes |
|---|---|---|---|
| ✅ | Type selector (§9) | `SelectorTipoPitch.tsx` | capital, educacion, innovacion, tecnologia; the four weigh the same |
| ✅ | Duration selector (§9) | `SelectorDuracion.tsx` | 1 to 7 minutes |
| ✅ | Recording with stop (§9) | `GrabadorVoz.tsx` | MediaRecorder; auto-stop; fallback text if there is no microphone |
| ✅ | Transcription (§9) | `GrabadorVoz.tsx` + `/api/transcribir` | ElevenLabs Scribe (`scribe_v2`); `language_code` hint = session language (`es` or `en`); `timestamps_granularity=word`; no live word by word |
| ✅ | Downloadable script | `guion-transcripcion.ts` + `DashboardResultado.tsx` | `.txt` with `[mm:ss.cc]` per sentence; only if Scribe sent `start`; not persisted in history |
| ✅ | Filler words (§8) | `src/lib/muletillas.ts` | Spanish: 21 patterns (`PATRONES_MULETILLAS`). English: `patronesMuletillas("en")`. `like` / `so` / `right` are not marked from the bare word |
| ✅ | UI | `src/app/page.tsx` | selectors + recorder + `DashboardResultado` |
| ✅ | Coach status (§5.1) | `GrabadorVoz.tsx` + `AnilloSenal.tsx` + `mensajes-coach.ts` | signal ring: 72px while recording (no number), 148px on the result (the arc is the score). Text: `Listening…` while recording, `Transcribing…` while Scribe responds, and, when it finishes, one of the 3 `MENSAJES_ASINTIENDO` phrases (session language). Applies to the pitch and to "Resolve findings" |
| ✅ | Anonymous session | `src/app/page.tsx` | no login, no accounts. History lives in this browser's `localStorage`, not on the server |
| ✅ | Deploy | `Dockerfile` + `railway.toml` | standalone; healthcheck `/`. Railway only; not used for local development |
| ✅ | Rubrics (§6) | `src/lib/rubricas.ts` | 4 types × 5 points, stable ids |
| ✅ | Types (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` and related types |
| ✅ | Real time (§7) | `GrabadorVoz.tsx` + `page.tsx` | model context + dashboard |
| ✅ | Model client (§13) | `src/lib/modelo.ts` + adapters | neutral layer + factory by `MODEL_PROVIDER`; backoff; timeout 20 s |
| ✅ | Nebius provider (default) | `src/lib/proveedor-nebius.ts` | OpenAI-compatible `/chat/completions`; strict `json_schema` (`{name, strict, schema}`); levels `estandar` (Super, every take) / `ultra` (opt-in, 4–8 step trace) / `rapido` (Nano: sparring, short entities, search-query writing, citation checks, room objection, spoken-figure check, timeline, 45-second retake); `enable_thinking: false` on standard and fast; ultra omits the field (reasoning on). The model does not set the score |
| ✅ | Gemini provider (contingency) | `src/lib/proveedor-gemini.ts` | `generateContent`; activated with `MODEL_PROVIDER=gemini`. Ignores the level |
| ✅ | Restricted schema | `src/lib/validar-analisis.ts` | `construirEsquemaAnalisisRestringido`: `rubrica` with `minItems === maxItems === puntos.length`; each item with `additionalProperties: false` and `required: ["cumplido", "comentario"]`; Ultra adds `traza` (4–8 steps) to the schema and requires it in validation |
| ✅ | Prompt (§7/§13) | `src/lib/prompts.ts` | transcript as untrusted data; asks for the rubric without names + `claridad` + `veredicto_corto`. If there is a previous attempt of the same type and language, the main analysis may mention only the names of uncovered points, and skips ids in `puntosCerrados` |
| ✅ | `analizar-pitch` API | `src/app/api/analizar-pitch/route.ts` | accepts optional `nivel` (`estandar` \| `ultra` \| `rapido`); 400 / 413 / 429 / 502 (generic errors to the client); Ultra shares the same rate limit |
| ✅ | Dashboard | `DashboardResultado.tsx` + `dashboard-resultado.css` | includes Tavily and the **Ultra analysis** button |
| ✅ | Resolve findings (§9) | `SparringCoach.tsx` + `/api/sparring/pregunta` + `/api/sparring/evaluar` | visible copy "Resolve findings"; internal APIs stay at `/api/sparring/*`; up to 3 missed points; level `rapido`; listen on request; same recorder + fallback text |
| ✅ | `transcribir` API | `elevenlabs.ts` + `/api/transcribir` | Scribe batch; `language_code` from the session language; `timestamps_granularity=word`; `ELEVENLABS_SCRIBE_MODEL` only chooses the model; audio in memory; 200 `{ texto, palabras }`; generic 400 / 413 / 429 / 502; timeout 60 s |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | Voice ID pair by language (no suffix in es, `_EN_` in en); session gender does not change. Verdict and Resolve findings share `/api/tts`. timeout 6 s; 413/429; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `query-tavily.ts` + `tavily-extract.ts` + `validar-sugerencia.ts` + `entidades-tavily.ts` + `/api/enriquecer` | best-effort; own timeouts (search 8 s, Extract 12 s). Auth `Authorization: Bearer` (the key does not travel in the body). Extracts up to 3 short entities (max 40 characters, level `rapido`) and builds the query with them + the visible name of the point **without the negative comment**; an ambiguous entity (an acronym or one-word brand) never travels alone. One model call (`rapido`) may rewrite the query toward a figure; if it fails, it falls back to the deterministic query. The transcript is **never** sent to Tavily. Localized search: `language` + `filter_by_language`, `exclude_domains` (known methodological domains **and automatic-translation proxies such as `translate.goog`**), `topic` (`finance` if it is `capital`, `general` otherwise), and `time_range=year`. Documented selection criterion (`SCORE_MINIMO`, candidate cap) instead of a blind `results[0]`; on the chosen one, **Tavily Extract** runs and a **mandatory validation** (level `rapido`, restricted schema with `additionalProperties: false`) that requires a cited figure **and confirms its relevance to the topic** (field `relevante`: it compares the figure against the pitch entities, so a real figure from another sector is discarded); only then is the **spoken phrase** generated (level `rapido`). The same call fetches one public-room objection for the first missed point and checks one figure the speaker already said. If no source of the same order is found, the dashboard says so and does not penalize the point. If Tavily fails, the rest of the UI continues. Validation failures are recorded in a **diagnostic log without PII** (final query + whether it passed), never the transcript or the extracted content |
| ✅ | Timeline | `/api/linea-tiempo` | with Scribe word timestamps, Nano places covered rubric points on the audio |
| ✅ | Second take | `/api/segunda-toma` | 45 seconds on one missed point. If it is covered, local history stores the id in `puntosCerrados` and does not store the retake text. The next practice of the same type and language does not remind that closed point |
| ✅ | Limits | `src/lib/limites.ts` + `src/lib/rate-limit.ts` | transcript max 8000; audio max 20 MB; sparring answer max 2000; in-memory rate limit per IP (per instance) with a ceiling per scope: 10 / 10 min by default and **5 / 10 min on `/api/enriquecer`** (`LIMITES_POR_AMBITO`). The lower ceiling follows the cost: each invocation fires 1 Nano call (entities) and, per missed point, up to 1 model query + 1 Tavily search + up to 2 Extract + 1 validation + 1 phrase. The full pipeline runs only for the first `MAX_PUNTOS_ENRIQUECIDOS` (2) rubric points of the type, in their order: the rest generate no external calls. Real ceiling per invocation: 1 + 2 × 6 = **~13 external calls** against 1 for the other routes. Verified by test (including the point ceiling): the `enriquecer` ceiling does not affect the other routes |
| ✅ | Local history | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | key `pitch-coach:historial-sesiones`; last 20; FIFO. No transcript. Fields: date, type, duration, score, clarity (reconstructed from the score), rubric `{punto, cumplido}`, filler-word count, `ultraUsado`, `idioma`, and — if completed — findings `{preguntasHechas, puntosReforzados, puntos: [{punto, cumplido}]}`. If a retake covers a point, the id is stored in `puntosCerrados` and the retake text is not stored. Ultra does not store a score or a rubric of its own |
| ✅ | "Your progress" panel | `PanelProgreso.tsx` | link on the main page; list most recent first (date, type, score, coverage `n/5`, Ultra, findings); shows which points closed or opened versus the previous practice of the same type and language; "Delete history" with `confirm()` |
| ✅ | Bilingual mode (§15) | `src/lib/idiomas.ts`, `src/lib/diccionario-es.ts`, `src/lib/diccionario-en.ts`, `src/lib/diccionarios.ts`, `ProveedorIdioma.tsx`, `SelectorIdioma.tsx` | language registry + typed dictionaries + React context. `en` is typed against the shape of `es`; a test compares the two shapes key by key. Initial language: `localStorage` → `navigator.language` (`es*` → es) → es. UI strings stay in both languages |
| ✅ | `<html lang>` with no flash | `layout.tsx` + `src/lib/idiomas.ts` | a script in the `<head>` sets the attribute before the first paint; the provider starts with the same default language as the server (no hydration warning) and corrects it in a layout effect. The home page stays static |
| ✅ | Stable rubric ids | `src/lib/rubricas.ts` | 4 types × 5 points, each with a stable `id` + name and "what to look for" per language. The id is the only thing that travels through the API and what is persisted; the model never sees it. Verified by a test that pins the list |
| ✅ | History with ids and language | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | each session stores the **ids** of its points and the `idioma`. Old entries (Spanish name, no language) are normalized without breaking: name → id, language → `es`. Continuity only uses sessions of the same type **and** language. An id in `puntosCerrados` is not reminded on the next practice |
| ✅ | Error messages by language | `src/lib/idioma-ruta.ts` + `src/lib/rate-limit.ts` + `src/lib/diccionarios.ts` | every route accepts `idioma` (`'es' \| 'en'`; absent → `'es'`; other → 400) and responds 400/413/429/502 in that language. The 429 uses the `X-Idioma` header because the rate limit runs before reading the body |
| ✅ | Prompts by language | `src/lib/prompts.ts`, `src/lib/prompts-sparring.ts`, `src/lib/validar-analisis.ts`, `src/lib/validar-sparring.ts` | one constructor per language (standard analysis, Ultra with trace, and sparring) and schema descriptions also per language: they are instructions, which is where the model is told which language to write in. Delimiters, restricted schema, and score stay the same. The model does not set the score |

### Filler words (21 patterns)

- **Base (§8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Public speaking (11):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin",
  "entonces", "¿me explico?", "a ver".
- **Threshold ≥3 (2):** **"pues"** and **"bueno"** (they are not reported or
  highlighted with fewer than 3 occurrences).
- The "eeee / ehh" pattern remains; it depends on Scribe transcribing the
  filler. The same happens with "um" / "uh" in English.

### English filler words

`patronesMuletillas("en")`. Clear ones: "um", "uh", "you know", "I mean",
"actually", "basically", "kind of" / "sort of". "you know" can match a real
question ("do you know"); that is accepted, the same as "este" in Spanish.

"like", "so", and "right" are **not** marked from the bare word:

- **like**: start of a clause or between commas ("Like,", ", like,"), repeated
  ("like like"), or followed by um/uh. "I like the product" does not match.
- **so**: start of a clause except "so that/much/many/far/on", between commas, or
  repeated. "and so on" and "so big" do not match.
- **right**: only "right?" or ", right," / ", right.". "right now" and "the right
  market" do not match.
- **well**: start of a clause or after a comma. "as well" and "well-known" do not match.

The highlight marks the word, not the comma that precedes it.

## 2. Open for the community

| Item | Notes |
|---|---|
| History across devices or accounts | Progress stays in this browser's `localStorage`. There are no accounts and no sync. |
| Custom rubrics | Today there are 4 fixed rubrics, in Spanish and English. Editing them or creating your own stays open. |
| New languages | Adding one should mean adding data in the registry, a dictionary, a Voice ID pair, and filler-word patterns; today there are only es and en. |
| Live STT (Scribe Realtime) | This phase transcribes the full clip on stop. It has no calendar date. |

## 3. Environment variables

In `.env.local` and on the deploy host:

- `MODEL_PROVIDER` — `nebius` (default) or `gemini`.
- **Nebius** (`MODEL_PROVIDER=nebius`): `NEBIUS_API_KEY` (required),
  `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`),
  `NEBIUS_MODEL_ULTRA` (default `nvidia/Nemotron-3-Ultra-550b-a55b`) and
  `NEBIUS_MODEL_NANO` (default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`).
  Super, which analyzes every take, is the `estandar` level (`MODEL`).
- **Gemini** (`MODEL_PROVIDER=gemini`, manual contingency):
  `GEMINI_API_KEY` (required in that mode). Ignores the level.
- Model configuration, shared by the active provider (all optional):
  `MODEL`, `MODEL_FALLBACK_MODELS`, `MODEL_MAX_TOKENS`,
  `MODEL_TEMPERATURE`, `MODEL_RETRY_ATTEMPTS`, `MODEL_RETRY_DELAY_MS`,
  `MODEL_RETRY_MAX_DELAY_MS`. The names `GEMINI_MODEL`,
  `GEMINI_FALLBACK_MODELS`, and `GEMINI_RETRY_*` still work as aliases,
  but **they apply only when the active provider is Gemini**.
- `ELEVENLABS_API_KEY` — TTS and STT (Scribe). Without an API key, STT fails and there is fallback text; the verdict falls back to SpeechSynthesis.
- `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` — Spanish voice pair.
- `ELEVENLABS_VOICE_ID_EN_MALE`, `ELEVENLABS_VOICE_ID_EN_FEMALE` — English voice pair. Without them, English TTS fails and the client falls back to SpeechSynthesis. The session gender does not change pair.
- `ELEVENLABS_SCRIBE_MODEL` — Scribe batch model (default `scribe_v2`). It does not choose the language: the hint is `language_code` (`es` or `en`), and if it were omitted Scribe would autodetect.
- `TAVILY_API_KEY` — suggestions; without it, that section does not appear and the rest of the UI continues

Manual smoke test against real Nebius (outside vitest; the maintainer runs it
with their key): `scripts/smoke-nebius.mjs`. It runs the same pitch at three
quality levels (strong / medium / weak) and checks that the evaluator orders
them; with `--lang en` the same thing on English transcripts, to see whether
it distinguishes quality the same way as in Spanish. It consumes quota (one
request per fixture).

```
node scripts/smoke-nebius.mjs --lang en
node scripts/smoke-nebius.mjs --lang en --ultra
node scripts/smoke-nebius.mjs --lang en --fixture debil
```

## 4. Technical notes

- Run: `npm run dev` (no Docker). Any modern browser with a microphone.
  Anonymous session. No accounts. Live demo: `https://pitch-coach.focampo.com`.
- Network: Scribe, the model, ElevenLabs TTS, and Tavily need the internet.
  SpeechSynthesis covers the verdict if TTS fails; fallback text covers STT
  if there is no microphone or the key is missing.
- Tests: `npm test` (vitest; `src/lib/` and analysis/sparring/transcribe routes
  with mocked fetch). The microphone loop is verified by hand.
- Model timeout: 20 s on `estandar`/`rapido`, 90 s on `ultra` (reasoning).
- **Rate-limit decision (Phase B)**: `/api/enriquecer` stays at **5 / 10 min
  per IP** (the global ceiling stays at 10). Explicit reason (and why it is
  **not** lowered further): each invocation no longer costs one or two calls,
  it costs **a full chain per missed point** — 1 model query (`rapido`), 1
  Tavily search at 1 credit with `search_depth: "basic"`, up to 2 `extract`, 1
  validation call (`rapido`), and 1 phrase call (`rapido`) — plus 1 entity
  extraction. That ceiling is not multiplied by every point: the full pipeline
  runs only for the first `MAX_PUNTOS_ENRIQUECIDOS` (2) rubric points of the
  type, in their order, and the rest generate no external call. The real
  ceiling per invocation is 1 + 2 × 6 = **~13 external calls**, against 1 for
  the other routes. With the global ceiling of 10, the worst case per IP and
  window multiplies by ~5 and Tavily's free tier (~1000 credits/month) runs out
  in hours of abuse; with 5 the cost per window stays comparable to the rest.
  It is centralized in `LIMITES_POR_AMBITO` (`src/lib/rate-limit.ts`) and there
  is a test that the `enriquecer` ceiling does not affect the other routes. If
  another multi-cost route is added later, the override goes there, not in the
  route.
- `.env.local` is not committed. `.env.example` is, without values.

## 5. Sentry (error monitoring)

Integrated in the three runtimes: Node, Edge, and the browser. Errors from the
API routes are reported with a **sanitized summary**, never with the raw
error; client render errors, with the App Router error boundaries
(`src/app/error.tsx` and `src/app/global-error.tsx`).

**What does NOT reach Sentry.** The rule is the same one already applied to
local history: sensitive data is not persisted and is not sent, even if that
costs functionality.

- The pitch **transcript**.
- The **`comentario`** field of any rubric (main, Ultra, or a "Resolve
  findings" turn).
- The **`traza`** field of Ultra analysis.
- The **`pregunta`** and the **`respuesta`** of a findings turn.
- The **`veredicto`** and the **`veredicto_corto`**.
- **Audio** in any form.
- The **client IP**. The app is an anonymous session, so the IP was the only
  client identifier that could slip in; it is no longer reported. It used to
  leave through four channels (the user, the event headers, and the span
  attributes); it is turned off with `dataCollection` in the three configs,
  plus a redundant deletion in the filter. Detail in `docs/sentry.md` §3.6.
- **Console breadcrumbs**. They were a real leak, not a theoretical one: the
  `console.error` of the `catch` blocks records the full `ErrorModelo`
  message, and that message carries the provider response body — which can
  repeat the request, with the transcript. They are discarded whole in
  `beforeSend` and `beforeSendTransaction`; the rest of the breadcrumbs still
  pass through the filter. Reproduction and fix in `docs/sentry.md` §3.7.

The filter (`src/lib/sentry-scrub.ts`) redacts those properties by name, at
any depth and also inside arrays (rubrics and turns are arrays of objects).
In addition, the provider error is **never sent raw**: its message can carry
the provider response body, which in turn can repeat the request — and with
it the transcript. A summary is sent (error type, HTTP code, provider, level)
with the stack minus its first line, which is the one that carries the
original message.

**Known limit:** the filter decides by property *name*, not by content. A
sensitive text that travels as the *value* of a property with an allowed name
is not detected. That is why the routes never attach user text as context and
the provider error is summarized instead of being forwarded. If a new `extra`
is added on some route, review this section first.

**Verified, by capturing the real envelope** (these used to be assumptions):

- The filter **actually runs** in the server pipeline: with unfiltered
  sentinels attached on purpose, the real envelope came out with `transcripcion`
  and `veredicto_corto` as `"[Filtered]"`.
- The **client error path works**: a throw in `useEffect` and another in
  render in Chrome 152 make `error.tsx` show the fallback UI, and the event
  with the real exception reaches the tunnel toward Sentry (HTTP 200).
- The IP was kept out on all four channels.
- **`beforeSendTransaction` does run** now, and it was checked directly:
  sentinels on a real transaction came out `"[Filtered]"`. Only the callback
  produces that marker, so it is not enough that the SDK stops warning on the
  console.
- **`httpBodies` does not filter the request body**: a real POST was sent with
  the transcript and the body does not reach Sentry by any path — not
  `request.data`, not span attributes, not `http` breadcrumbs. See `§3.6.1`.
- **The `/api/enriquecer` error path is closed, tested on this flow, and not
  assumed** (`test/enriquecer-privacidad.test.ts`). The double failure is
  provoked — extraction (Nano) and Tavily — with errors that carry the
  transcript, and it is checked on the real route flow: the response to the
  client does not carry the transcript; the payload that goes to
  `captureException` (message, stack, extra, tags) does not either; and the
  raw error the route does write to the console — the console-breadcrumb
  vector, the same one closed for ElevenLabs — is passed through the project's
  REAL `beforeSend` and the breadcrumb is discarded. Coverage note: the
  Sentry report for this route is reached only through the outer catch
  (provider failures are swallowed inside by best-effort design), so the test
  forces that catch with an `ErrorModelo` whose `message` holds the provider
  body, which is the real shape of `src/lib/proveedor-nebius.ts`.
- **`genAI` is inert by construction** (verified, not assumed): it instruments
  only recognized AI SDKs, by **package + version + exact file** (`openai`,
  `@google/genai`, `langchain`…), **never by URL or by host**. This project
  calls the providers with raw `fetch` and has no AI SDK installed, so the
  category captures nothing. Also confirmed on the envelopes: the provider
  call goes out as `auto.http.node_fetch` / `http.client`, with no `gen_ai.*`
  attribute. See `docs/sentry.md` §3.6.2.
- `static` mode **does not lose telemetry**: the same traces and the same
  spans (36 on the browser home page); only the envelope they travel in
  changes.
- **Production, both paths** (verified on Railway on 2026-09-27): the server
  reports with the sanitized summary, `environment: production`, `release`
  with the commit SHA, and **deminified** stack traces (source maps upload
  during the build). And the client reports: browser spans arrive with
  `auto.pageload.nextjs.app_router_instrumentation` and `POST /monitoring` is
  visible in DevTools. Before this, the client reported nothing because the
  `ARG NEXT_PUBLIC_*` were missing from the `Dockerfile` — see
  `docs/sentry.md` §6.
- **The production client already carries `release`.** Before, it did not:
  the browser release is resolved at build time and never reached the build,
  while the server release is resolved at runtime and therefore did appear —
  an asymmetry that made the client look broken. It was fixed by declaring
  `ARG RAILWAY_GIT_COMMIT_SHA` in the `Dockerfile`. Verified in the deployed
  bundle. Detail and the moral, in `docs/sentry.md` §9.14.
- **The only thing not verified in production:** that the browser stack traces
  come out **deminified**. The client already has a release and the maps
  upload under that release, so it should resolve, but checking it requires a
  real error thrown from bundle code — one thrown from the console is not
  enough. Careful when testing: the client samples traces at 10%, so loading
  the page once probably does not generate a transaction; errors are not
  sampled.

> **⚠️ Latent `genAI` trap.** The AI integrations **register by default**
> anyway: they are no-ops only while the vendor package does not exist. If
> someone replaces the raw `fetch` in `src/lib/proveedor-nebius.ts` with the
> **official `openai` package** (plausible: Nebius is compatible with that
> API), `genAI` turns on with its **permissive defaults** (`inputs`/`outputs:
> true`) and the prompt — with the transcript — starts traveling to Sentry
> **without anyone touching privacy**, as a span attribute, which **does not
> pass through `beforeSend`**. If that happens, set `dataCollection.genAI:
> { inputs: false, outputs: false }` **before** the change.

**Still unaudited:** `cookies`, `urlQueryParams`, and `httpHeaders.response`:
no evidence of a leak, and no evidence of the opposite either. See
`docs/sentry.md` §3.6.3.

**Requires your decision, with a date.** `traceLifecycle` is `"static"` on
purpose: with the default (`"stream"`) the SDK **ignores**
`beforeSendTransaction`, and transaction events carry breadcrumbs, which can
carry user text. The price is that `beforeSendTransaction` **is removed in
SDK v12**: migrate to `beforeSendSpan` before upgrading to that version. It is
not urgent, but it is a date. See `docs/sentry.md` §3.8 and §10.

**Session Replay is disabled on purpose.** It records DOM interactions —
including text typed and read — which is exactly the kind of capture this
project does not want. Do not turn it on without reviewing this section first.

Without `SENTRY_DSN` the app works the same: the SDK sends nothing.
`SENTRY_ENABLED=false` turns sending off without touching code. The variables
are documented in `.env.example`; source-map upload also needs
`SENTRY_AUTH_TOKEN` at build time.
