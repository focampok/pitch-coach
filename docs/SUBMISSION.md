# Pitch Coach — Devpost submission story

Text for the public project page on the [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/) (track: **Best Apps and Agents**). Each heading below matches a Devpost field. Everything here comes from the repository (`PRODUCT.md`, `README.md`, `docs/formulario-devpost.md`, the code and `.env.example`); there are no usage numbers, customers, or benchmarks because the project has none to report. The private "Additional info" fields live in [`formulario-devpost.md`](formulario-devpost.md).

---

## Tagline

```
Rehearse a pitch out loud. Get a rubric score, a sourced figure you can say, and a spoken verdict in about a minute — no account. Nemotron 3 on Nebius Token Factory.
```

(165 characters.)

## Inspiration

Most people rehearse a pitch the night before, alone: in front of a mirror, into a phone recording nobody analyzes, or with a friend who says "sounded good". The feedback they need is specific — did you actually say what the problem is, how big the market is, what you are asking for? — and it has to arrive before the real audience does.

Pitch Coach started as a small tool for that moment, built for Latin America and bilingual from the first screen: Latin American Spanish is a first-class case, not a later localization. The idea that holds the product together is that **the rubric is tied to the pitch type**. A generic coach grades "communication". This one checks whether a capital pitch covered the problem, the market, the solution, traction and the ask; an education pitch its learning goal and structure; an innovation pitch its validation and impact; a technology pitch the problem it solves, how it works, and what is hard to replicate. Four types, five fixed points each, and none of the four is the main path.

The second idea is **immediacy without an account**: speak, stop, and see what is missing. No sign-up, no upload, no ceremony.

## What it does

Pick the language, the pitch type and a time limit (1 to 7 minutes), press record and talk. The recording stops itself at the limit. The server transcribes the clip, counts filler words, and judges the transcript against the five rubric points of the type you chose. The dashboard shows the score, which points were covered and which were missed, the transcript with fillers highlighted, and a short verdict you can listen to.

The same session then continues as a chain — these are features, not decorations:

- **Cited figure** — for a missed point, a real statistic found on the web, with its source and a sentence ready to say out loud. At most two points per practice.
- **The room** — one sourced objection the audience for that type would raise: an investment panel, a classroom, an innovation committee, or a technical buyer.
- **Figures you said** — if the pitch already stated a number, the app looks for a source of the same order. If none is found it says so and does not penalize the point.
- **Where the time went** — covered points placed on the audio timeline, when word timestamps are available.
- **Second take** — 45 seconds on one missed point. If you cover it, this browser remembers the point id.
- **Ultra analysis** — an opt-in re-analysis with an extended-reasoning trace of four to eight steps, shown next to the score.
- **Resolve findings** — up to three follow-up questions on the missed points, answered by voice or text.
- **Downloadable script** with a `[mm:ss.cc]` mark per sentence, and **Your progress**, a local history of the last 20 practices with the coverage delta against the previous one of the same type and language.

Everything — interface, rubrics, prompts, error messages, voices — follows one `idioma` value, `es` or `en`. The session is anonymous. Audio is processed in memory and discarded; the transcript is never sent to the search provider; history lives only in that browser's `localStorage`. If there is no microphone or permission is denied, there is a text field. If text-to-speech fails, the browser's own speech synthesis reads the verdict.

## How we built it

One Next.js repository, no separate backend: the browser records with `MediaRecorder` and every provider call happens in API routes on the server, so no key ever reaches the client.

### What runs at runtime, and where

| Step | Service | What happens |
|---|---|---|
| Transcription | **ElevenLabs Scribe** (`scribe_v2`), `POST /api/transcribir` | The audio clip is sent in memory, text and word timestamps come back, the audio is discarded. The language hint follows the session language. |
| Take analysis | **NVIDIA Nemotron 3 Super** — `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory, `POST /api/analizar-pitch` | Judges every recording: one `{cumplido, comentario}` pair per rubric point, a clarity value (0–20) and a short verdict. Thinking off, 20-second budget. **The server computes the score**; the model never assigns it or names the points. |
| Ultra analysis | **NVIDIA Nemotron 3 Ultra** — `nvidia/Nemotron-3-Ultra-550b-a55b`, same route with `nivel: "ultra"` | Only when the user presses the button. Thinking left on, a 4–8 step reasoning trace, 90-second budget. |
| Fast tier | **NVIDIA Nemotron 3 Nano** — `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Everything short and schema-bound: the follow-up questions and their evaluation (`/api/sparring/*`), the short entities and the search query for Tavily, the check that an extracted page really quotes an on-topic figure, the spoken sentence for that figure, the room objection, the check on a figure the speaker already said, the timeline (`/api/linea-tiempo`), and the 45-second retake (`/api/segunda-toma`). Thinking off. |
| Web evidence | **Tavily** — `POST /api/enriquecer` → `https://api.tavily.com/search` and `https://api.tavily.com/extract` | A live call in production, not a mock. The request carries short entities and the rubric point, never the transcript. Nano validates each extract; a page without a quoted, relevant figure produces no suggestion. The same call brings the room objection and the spoken-figure check. |
| Spoken verdict | **ElevenLabs TTS**, `POST /api/tts` | Reads the verdict and the follow-up questions in a Spanish or English voice pair. `SpeechSynthesis` is the mandatory fallback. |

All three Nemotron sizes share one key and one endpoint, `https://api.tokenfactory.nebius.com/v1/chat/completions`, selected in code by a level flag (`estandar`, `ultra`, `rapido`) from `src/lib/proveedor-nebius.ts`. Ultra and Nano never fall back to another size, so a fast call cannot silently become an Ultra call.

### The contract around the model

- System and user messages are separate; the transcript travels inside delimiters and is treated as untrusted data.
- `response_format` is Nebius strict `json_schema` (`{ name, strict, schema }`, `additionalProperties: false`, `minItems = maxItems`), so a five-point rubric comes back as exactly five items.
- The rubric point ids are a contract: they travel through the API and are stored in history, and the model never sees them.
- Thinking is a per-call switch (`chat_template_kwargs: { enable_thinking: false }` on Super and Nano; omitted on Ultra).
- Transient errors (408, 429, 5xx, timeout) retry with backoff; a truncated completion (`finish_reason: length`) retries once with a larger `max_tokens`.
- Prompts and schema descriptions are written per language, not translated afterwards, because the schema description is where the model is told which language to write.

### Everything else

Next.js 16 (App Router) with React 19 and Tailwind CSS 4, in TypeScript. The dictionaries for Spanish and English are typed against each other, so a missing key fails the build. The root layout reads `Accept-Language`, so a browser in English receives English HTML, metadata and Open Graph tags from the server. Deployment is a standalone Next.js build on Railway; Sentry (optional) collects errors and traces with PII scrubbing that drops audio, transcripts and keys before anything leaves the server. `vitest` unit tests cover `src/lib/` and the API routes with mocked providers; the microphone loop is checked by hand. Gemini remains in the repo as a manual contingency behind `MODEL_PROVIDER=gemini`; it is not the demo path.

## Challenges we ran into

- **A model-written score was not stable enough to show a founder.** On the earlier Gemini path the same transcript could change its number between runs. The score is now derived on the server from how many points passed plus a clamped clarity value. Clarity is still a model judgment; the number is not.
- **Strict JSON has a shape you have to discover.** An unwrapped schema returns HTTP 422 and the status alone does not say that `name`, `strict` and `schema` must be nested. Once wrapped, Super returns a rubric of the exact length, in both languages.
- **Thinking is a per-size switch.** `enable_thinking: false` inside `chat_template_kwargs` is what keeps Super and Nano inside a 20-second budget; Ultra needs the field omitted so the trace is actually reasoned. Ultra's latency is why it sits behind a button with a 90-second timeout instead of on the default path.
- **A real number from the wrong industry is worse than no number.** Early manual tests showed the first search hit was often a how-to article, the wrong language, or a true figure about another sector. Nano now has to return a verbatim quote, a year and an explicit relevance flag, and anything that fails is discarded rather than displayed.
- **Binding the output language.** Spanish and English both work, but only after the language was stated in the system prompt *and* in the schema field descriptions.
- **Making the chain legible without a logo wall.** The judging guidance asks for a multi-step flow that chains tools. The redesign had to put the score, the missed point and the cited figure on the first view, keep Ultra's trace visible once it ran, and keep model names as short provenance rather than the headline.

## Accomplishments that we're proud of

- The whole chain works end to end, in production, on Token Factory: voice → Scribe → Super → Tavily + Nano → Ultra on request → Nano sparring → second take → spoken verdict.
- Each Nemotron size has one job, and the split is the reason the citation loop is affordable: Super for the critique, Ultra only for the reasoning pass, Nano for the many short checks.
- The rubric is a contract, not a prompt: five stable ids per type, the exact array length enforced by the schema, and a score the model cannot inflate.
- Privacy by construction: audio in memory and discarded, the transcript never sent to the search provider, no server-side persistence, an anonymous session.
- Bilingual by contract rather than by translation pass, down to the voice pair, the STT hint and the filler-word lists (21 LATAM public-speaking patterns in Spanish, a separate list in English).
- Nothing depends on a single channel: no microphone → text; TTS down → `SpeechSynthesis`; Tavily down → the rest of the result still arrives.
- Open source under MIT, with a public demo.

## What we learned

- Put the judgment in the model and the arithmetic in the server. Letting the model decide *whether* a point was covered works; letting it decide the final number did not.
- Strict structured output is the feature that makes a multi-model app possible. Without the schema envelope, three model sizes would be three sources of malformed JSON.
- Retrieval needs a validator, and the validator needs to be allowed to say no. "Is there a number on this page?" is not the question; "is this a quoted figure about *this* topic?" is.
- Reasoning is a budget decision. Leaving thinking on for a one-sentence rubric comment spends tokens the product never displays; keeping it for Ultra turns the trace into the feature.
- Bilingual output is a contract across prompt, schema and UI, and it has to be designed in, not appended.
- Capture `usage` yourself. Success logs that store only the provider and model id leave reasoning-token cost as a surprise.

## What's next

Candidates, not commitments — none of these are in the current version:

- Streaming the Ultra trace so the dashboard shows progress instead of a spinner.
- Live transcription (Scribe Realtime) instead of record → stop → transcribe.
- Comparing two attempts side by side in the same session.
- Custom rubrics, while keeping stable point ids as the contract.
- More languages, following the existing rule: adding a language means adding data, not touching components.

Pitch Coach stays account-free, with no server-side persistence, and the four pitch types keep weighing the same.

## Built with

- **Next.js 16** (App Router, API routes), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Nebius Token Factory** — OpenAI-compatible inference endpoint, all Nemotron calls
- **NVIDIA Nemotron 3 Super** (`nvidia/nemotron-3-super-120b-a12b`), **Nemotron 3 Ultra** (`nvidia/Nemotron-3-Ultra-550b-a55b`), **Nemotron 3 Nano** (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`)
- **Tavily** — Search and Extract, live at runtime
- **ElevenLabs** — Scribe (speech to text) and text to speech
- **MediaRecorder** and **SpeechSynthesis** (Web APIs)
- **Railway** — deploy (standalone Next.js build)
- **Sentry** — error monitoring and tracing
- **vitest** — unit tests

## Try it

- Live demo: [https://pitch-coach.focampo.com](https://pitch-coach.focampo.com) — a current browser with a microphone (or use the text field). The interface follows your browser language; switch with the ES / EN control. During judging the demo may cap practices per browser to protect shared credits.
- Repository (MIT): [https://github.com/focampok/pitch-coach](https://github.com/focampok/pitch-coach)
- Video: [https://youtu.be/0dFYcbygXGA](https://youtu.be/0dFYcbygXGA)

## Project history (submission period)

Pitch Coach predates the submission window: the first commit is 18 August 2026, when the pitch was analyzed only with the Gemini API — one prompt string, a model-assigned score, and point names invented by the model. During the submission period the analysis path was rebuilt on Nebius Token Factory with the three Nemotron 3 sizes above, strict `json_schema`, a server-computed score, server-side transcription, the bilingual contract, the Tavily evidence loop, the Ultra pass, the findings loop, the second take and the redesign. The full delta is in [`formulario-devpost.md` §6](formulario-devpost.md).
