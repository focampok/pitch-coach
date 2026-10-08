# Pitch Coach

## 1. Problem

Practicing a pitch is usually done in front of a mirror, by recording on a phone, or in front of other people — with no structured feedback, no measurement of filler words, and no check of whether the key points were actually covered for the pitch type (capital, educacion, innovacion, tecnologia).

Existing feedback is subjective, late, or absent. There is no fast way to practice out loud and receive an objective, immediate evaluation.

## 2. Concept

**Pitch Coach** is a pitch-practice tool. The user speaks out loud into the microphone, the system transcribes, analyzes the content against a rubric for the chosen type, detects filler words, and shows a dashboard with the detail. The user can listen to a short verdict whenever they want. The interface shows a **coach status indicator** in text while recording and transcribing, and the signal ring `AnilloSenal` reacts to the audio (see §5.1).

The central idea:

> Practice out loud. Get concrete feedback — written first, spoken if you ask for it — as if a coach were listening.

## 3. Target user

Builders, founders, students, and professionals who need to prepare a pitch — capital, education, innovation, or technical — and want to practice with objective feedback before presenting to a real audience. Market: **LATAM**, with interface and feedback in **Spanish and English** (§15).

## 4. Main experience (user loop)

1. The user chooses the **pitch type** (capital / educacion / innovacion / tecnologia) and the **maximum duration**, from presets of 1 to 7 minutes.
2. They press record and **pitch out loud**. The recording **stops automatically** when it reaches the maximum duration.
3. The system **records the audio** (MediaRecorder) and, on stop, **transcribes it** on the server (ElevenLabs Scribe). While recording, the interface shows the indicator `Listening…` in English (the session dictionary supplies the string); filler words are counted on the final transcript — see §5.1.
4. The system analyzes the transcript:
   - Detects **filler words** (count by word/phrase).
   - Evaluates the content against the **rubric of the chosen type**.
   - Generates a **score** and a **short verdict**. The model does not set the score.
5. The **dashboard shows the detail** in text: transcript with filler words highlighted, rubric points, score, and time used. If the pitch was recorded (not typed by hand), a **script can be downloaded** as plain text with a time mark per sentence (`[mm:ss.cc]`).
6. The user **can listen to the coach**: `veredicto_corto` is turned into speech (ElevenLabs, with fallback to SpeechSynthesis). It does not play by itself when analysis finishes.
7. If they want more rigor, they can ask for **Ultra analysis**: the same transcript is re-analyzed with Nemotron Ultra (reasoning on). The result is shown in addition to the standard one, labeled, with a **trace** (a log of 4–8 steps: what it looked for, what it found or missed).
8. If at least one rubric point was left uncovered, they can **resolve findings**: up to 3 follow-up questions (one per missed point, in rubric order). Each question appears in text; the user can listen to it (the same voice as the session) if they want. After each answer they receive feedback; at the end they see how many findings they resolved.

## 5. Hybrid model (voice + visual)

Practice is **in voice**, and the result is seen and can be heard:

- **Visual channel:** during recording, status indicator + signal ring + timer. When it finishes, transcript, dashboard with rubric, score, and filler words. This is the main channel of the result.
- **Auditory channel (on request):** the user presses "Listen to the verdict". If ElevenLabs fails, SpeechSynthesis covers it; if both fail, the dashboard is still there.

The product never depends on a single channel.

### 5.1 Coach status indicator

The **reactive avatar was removed**. The current flow is record → transcribe → analyze, so there are no intermediate results to react to: the avatar only had two real states (`escuchando` and `asintiendo`). In its place, the live measurement is the signal ring `AnilloSenal` (rest, live, settled), and a **short text status** still reports the moment. There is no reaction engine and no live STT.

| State | Text | When |
|---|---|---|
| Recording | `Listening…` (session dictionary) | while the pitch is being recorded |
| Transcribing | `Transcribing…` (session dictionary) | while the server transcribes (Scribe) |
| Finished | one of the **3 `MENSAJES_ASINTIENDO` phrases** | when the transcript (or the fallback text) arrives |

The strings come from the session dictionary (`es` / `en`); the final phrase is chosen at random from three. The same applies to the main pitch flow and to **"Resolve findings"**, which reuses the same recorder.

The ring is the live signal: 72px while recording, with no number, and 148px on the result, where the same arc is the score. It is one hue, not an orb. Live STT (Scribe Realtime) stays out of scope and has no calendar date. Direction: [`docs/referencias-ui/`](referencias-ui/README.md).

#### Rules

- **The result is still the dashboard**, plus the auditory channel on request (TTS). The indicator is not a feedback channel.
- **Humor lives in the copy, not in the drawing** (for example, "that 'you know' landed hard — that's 12").

## 6. Rubrics by pitch type

Each type has 5 fixed points the model looks for in the transcript. They are **hardcoded**; there are no custom rubrics in this version. The four types weigh the same.

Each point has a **stable id** — that is what travels through the API and what is stored in history — and a name and a "what to look for" description translated into each language. Translating a point does not invalidate data already stored. The ids per type are in §15; the names below are the English ones.

### Capital
1. Clear problem
2. Market size / opportunity
3. Solution / differentiator
4. Traction or evidence (data, users, revenue)
5. The "ask" (how much capital is sought and what for)

### Education
1. Clear learning goal
2. Pedagogical structure (opening, development, close)
3. Concrete example or case that illustrates the concept
4. Connection to the audience's prior knowledge
5. Call to action or next step for the learner

### Innovation
1. Identified problem or opportunity
2. What makes the proposal different or innovative
3. Evidence of validation (even if early)
4. Expected impact
5. Next steps or vision of the future

### Technology
1. Technical problem it solves
2. How it works (without getting lost in excessive jargon)
3. Real technical differentiator (what makes it hard to replicate)
4. Current status (working, in development, scalability)
5. Relevant resources or stack, mentioned clearly

## 7. Maximum pitch duration

Fixed presets: **1, 2, 3, 4, 5, 6, or 7 minutes**. There is no free value.

- The recording **stops automatically** when it reaches the limit.
- Real time versus the maximum **enters as LLM context** (did time run out before the ask? were there minutes left?).
- The dashboard shows time used versus the maximum.

## 8. Filler-word detection

It does not require AI: regex / keyword count on the transcript.

Base list (Spanish patterns):

- "eeee" / "ehh"
- "o sea"
- "como les decía"
- "este..."
- "bueno pues"
- "a mi me tocó hablar de"
- "digamos"
- "en ese sentido"

The Spanish implementation has **21 patterns** (LATAM public speaking) and a threshold of ≥3 for "pues" and "bueno". The same list (`PATRONES_MULETILLAS`) is used for the count and for the highlight. "eeee / ehh" counts only if Scribe writes the filler.

In English, `patronesMuletillas("en")`: "um", "uh", "you know", "I mean", "actually", "basically", "kind of" / "sort of", plus "well", "like", "so", and "right?" with context. "like", "so", and "right" are not marked from the bare word (they have legitimate uses: "I like", "and so on", "the right market", "right now"). They are marked at the start of a clause, between commas, when repeated, or — "right" — as a tag ("right?"). "um" / "uh" have the same limitation as "eeee": they depend on Scribe transcribing them. "you know" can match "do you know"; that is a known false positive, the same kind as "este" in Spanish. Analysis and highlighting use the session language.

## 9. Current scope

Full cycle:

**pitch type + maximum duration → recording (automatic stop) → transcription → analysis (filler words + rubric + time) → dashboard + verdict on request → [optional] Ultra analysis and/or resolve findings**

- [x] Pitch-type selector (4 fixed options, equal weight: capital, educacion, innovacion, tecnologia).
- [x] Maximum-duration selector (presets from 1 to 7 minutes).
- [x] Recording with automatic stop.
- [x] Transcription (MediaRecorder + ElevenLabs Scribe, with fallback text if there is no microphone).
- [x] Filler-word detection by count.
- [x] Evaluation against the rubric through the active provider (Nebius by default; Gemini as contingency). Structured JSON. The model does not set the score.
- [x] Spoken verdict (ElevenLabs, SpeechSynthesis fallback), on request.
- [x] Dashboard: transcript, highlighted filler words, rubric, score.
- [x] Coach status: session-language text (`Listening…` / `Transcribing…` / 3 phrases when it finishes) and the signal ring `AnilloSenal`, §5.1. Live STT stays out of scope.
- [x] Anonymous session, no login, no accounts.
- [x] Ultra analysis: re-analysis of the same transcript with extended reasoning (Nemotron Ultra), opt-in, with a 4–8 step trace.
- [x] Resolve findings: up to 3 follow-up questions on missed points (rubric order), text + listen on request, answer by voice or fallback text. Nano.
- [x] Local history and the "Your progress" panel: the last 20 practices of this browser (date, type, duration, score, clarity, rubric without the comment, filler-word count, whether Ultra was used, whether the findings summary was completed, and the coverage delta against the previous practice of the same type and language). No transcript is stored. There are no accounts and no server copy.
- [x] Public room: one sourced objection, on the first missed point, according to the type (investment panel, classroom, innovation committee, technical buyer). Rubric ids do not change.
- [x] Spoken figures: if the pitch already states a figure, Tavily looks for a source of the same order. If none is found, the dashboard says so. That does not penalize the point.
- [x] Second take: `POST /api/segunda-toma`, 45 seconds on one missed point. If it is covered, local history stores the id in `puntosCerrados` and does not store the retake text. The next practice of the same type and language does not remind that closed point.
- [x] Timeline: `POST /api/linea-tiempo`. With Scribe word timestamps, Nano places covered rubric points on the audio.

## 10. Out of this version

- User system, login, or profiles.
- Server persistence and sync across browsers or devices. The history that does exist is local (`localStorage` of this browser) and does not store the transcript, comments, the Ultra trace, questions, answers, or audio.
- Comparing two attempts in the same session.
- Editing or creating custom rubrics.
- New languages beyond Spanish and English (§15).
- Live STT (Scribe Realtime). No calendar date.
- A more elaborate coach animation ("talking head", 3D).
- Video analysis, body language, or facial expression.
- A separate backend — everything runs in Next.js with API routes.
- Docker for local development. The `Dockerfile` is for the Railway deploy only.

## 11. What must be evident when using it

- The user pitched out loud (not a preloaded text).
- The transcript matches what was said.
- The filler words are specific, not generic.
- The rubric marks concrete points covered and missing.
- The dashboard and the spoken verdict (if it is heard) match.
- The status indicator reflects the real moment of the flow (recording / transcribing / ready) and the transcript appears when it finishes.
- If they ask for Ultra analysis, they see a second labeled result (with a reasoning trace), not a replacement of the first.
- If there are uncovered points, they can resolve findings (max 3) and see how many they resolved.
- "Your progress" lists attempts from this browser (score and coverage) without showing the transcript or the comments. If there is a previous practice of the same type and language, it says which points closed or opened.
- If there is an uncovered point, a 45-second second take can be recorded. If it ends covered, that session's rubric marks it.
- If the audio has time marks, it is visible which stretch each covered point fell on.
- If Tavily finds a room objection or a source for a spoken figure, the link is visible. If there is no source for the spoken figure, that is said and the point is not penalized.

## 12. External services

All keys live server-side (API routes). None are exposed to the client.

- **Nebius Token Factory** — default pitch analysis (Nemotron Super analyzes every take). Ultra uses Nemotron Ultra; Nano handles sparring, short entities, search-query writing, citation checks, the public-room objection, the check on one figure the speaker already said, the timeline of covered points, and the 45-second retake.
- **Gemini** — manual contingency fallback (`MODEL_PROVIDER=gemini`). Ignores the level (`estandar` / `ultra` / `rapido`).
- **ElevenLabs** — TTS of the verdict and of the sparring questions (SpeechSynthesis is a mandatory fallback) and **STT (Scribe)** of the recording. The user's audio is not written to disk and is not attached to logs or to Sentry.
- **Tavily** — optional enrichment, `POST /api/enriquecer`. The transcript is never sent. At most two missed rubric points get a cited figure (`MAX_PUNTOS_ENRIQUECIDOS`). The same call also fetches one public-room objection for the first missed point and checks one figure the speaker already said. The room follows the type: investment panel, classroom, innovation committee, technical buyer. Rubric ids do not change. If no source of the same order is found, the dashboard says so and does not penalize the point. If there is no key or Tavily fails, the rest of the UI continues.

## 13. Technical stack

### Frontend + backend (single project)
- **Next.js** (React) with **API routes**. Keys do not leave the server.
- **Tailwind CSS**.

### Voice → text (STT)
- **MediaRecorder** on the client (Chrome, Firefox, Safari, Brave, mobile) and **ElevenLabs Scribe** (`POST /v1/speech-to-text`, `scribe_v2`) at `/api/transcribir`.
- Flow of this phase: record → stop → transcribe → show the full text. No live word by word.
- Scribe is requested with `timestamps_granularity=word`. Analysis still uses only the plain text; the `words[].start/end` marks (seconds) are kept on the client for the **downloadable script** (one line per sentence or pause ≥ 0.6 s). Fallback text has no marks: the button does not appear.
- Scribe accepts `audio/webm` (Chrome/Firefox) and `audio/mp4` (Safari) without transcoding.
- If `getUserMedia` does not exist or permission is denied, there is a **fallback text field** (main pitch and Resolve findings).
- Audio is processed **in memory** and discarded once the text is obtained: it is not written to disk and is not attached to logs, breadcrumbs, or Sentry.

### Analysis (LLM)
- **Nebius Token Factory** by default (Nemotron Super / Ultra / Nano according to
  the level). Gemini remains available as contingency.
- The prompt receives transcript + type + rubric + real time versus maximum, and
  the request **idioma**: the instructions and the output are in that language
  (§15). The transcript is marked as **untrusted data** between delimiters,
  which are not translated.
- The model returns **only** this portion, as **structured JSON**:

```json
{
  "veredicto_corto": "Clear handling of the problem, but you never stated the capital ask.",
  "claridad": 15,
  "rubrica": [
    { "cumplido": true, "comentario": "..." },
    { "cumplido": false, "comentario": "..." }
  ]
}
```

In Ultra analysis the model adds `"traza": ["step 1", "..."]` (4 to 8 reasoning
steps). Standard analysis does not ask for it.

- The model **does not** calculate the score, **does not** name the points, and
  **does not** count filler words. The server assigns each point's **id** from
  the rubric by index, calculates the score
  (`clamp(round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100)`),
  and counts filler words with `src/lib/muletillas.ts`.

### Resolve findings (internal: sparring)
- If there are points with `cumplido: false`, up to 3 questions are offered (the
  first ones in rubric order).
- Each question is generated and each answer is evaluated at level `rapido`
  (Nano). The evaluation model returns only `{ cumplido, comentario }`.
- The question is shown in text. The user can press "Listen to the question"
  (the same ElevenLabs voice as the session); it does not play by itself.
- The user answers by voice (the same recorder) or with the fallback text if there is no microphone.

### Text → voice (TTS)
- **ElevenLabs** as the first option (natural voice). The voice is reused in
  sparring of the same session: gender stays fixed and the language chooses the
  Voice ID pair (§15).
- Native **SpeechSynthesis** as fallback: if ElevenLabs fails or is slow, the loop does not stop.

### Filler words
- Regex / keyword matching. Does not require an LLM.

### Coach indicator
- Signal ring `AnilloSenal` plus plain text in the session language (`Listening…` / `Transcribing…` / an assenting phrase). §5.1.

### Deploy
- A single Next.js service (for example Railway). HTTPS is required for the microphone outside localhost. The `Dockerfile` is for that deploy only. Local development does not use Docker.

## 14. Development environment

- Native execution (`npm run dev`). The `Dockerfile` is only for deploy, not for development. No Docker for local development.
- Keys go in `.env.local` (not committed). `.env.example` documents the names, without values.

## 15. Bilingual mode (es / en)

The product works in **Spanish and English**. A single `idioma` value (`'es' | 'en'`)
governs what is read and what is heard: interface, rubrics, prompts, error
messages, the ElevenLabs voice pair, the Scribe hint, filler words, and the
three assenting phrases.

UI strings stay in both languages. This document describes the contract; it does
not replace `diccionario-es.ts` or `diccionario-en.ts`.

### Language registry

`src/lib/idiomas.ts` is the source of truth for which languages exist: code,
name, BCP-47 tag (`es-419` / `en-US`), and `codigoStt` (Scribe's
`language_code` hint, ISO 639-1). Voice IDs do not live in the registry:
they are environment variables (`ELEVENLABS_VOICE_ID_MALE` / `_FEMALE` in Spanish,
`ELEVENLABS_VOICE_ID_EN_MALE` / `_EN_FEMALE` in English). Filler words live
in `src/lib/muletillas.ts`. Adding a new language must be **adding data**
(registry, dictionary, voice pair, patterns), not touching components.

The strings live in typed dictionaries (`src/lib/diccionario-es.ts`,
`src/lib/diccionario-en.ts`, and the selector in `src/lib/diccionarios.ts`).
English is typed against `typeof es`, so a missing or extra key fails the
build; a test checks the same thing at runtime, including the arity of the
plural functions.

### How the language is chosen

1. The value saved in `localStorage` (`pitch-coach:idioma`), if there is one.
2. If not, `navigator.languages[0]`: `es*` → Spanish, anything else → English.
3. If there is no signal at all, Spanish (also the server's value).

The home page is **static** (prerendered at build), so the server cannot read
`localStorage` or `navigator`. A script in the `<head>` therefore sets
`<html lang>` **before the first paint**, and the React tree starts with the
same default language as the server — with no hydration warning — and corrects
itself in a *layout effect*, which React runs before the browser paints. The
result: the first frame is already in the right language, and the home page
keeps being served static.

### Stable rubric-point ids

The ids are a **contract**: they travel through the API and stay stored in each
user's history, so renaming one breaks data already persisted (a test pins the
list so the change is deliberate). They are unique **within each type**, not
across types. Five per type.

| Type | Ids (in order) |
|---|---|
| Capital | `problema`, `mercado`, `solucion`, `traccion`, `ask` |
| Education | `objetivo`, `estructura`, `ejemplo`, `conocimiento-previo`, `llamado-accion` |
| Innovation | `problema-oportunidad`, `diferenciador`, `validacion`, `impacto`, `proximos-pasos` |
| Technology | `problema-tecnico`, `funcionamiento`, `diferenciador-tecnico`, `estado`, `stack` |

The model never sees an id: the server assigns the id by index and the prompt
only carries the visible names of the chosen language.

### History and continuity

Each session stores the **id** of each point and the **idioma** it was practiced
in. Entries from before bilingual mode (Spanish name, no `idioma`) are read
without breaking: the name is mapped to its id and the language is assumed to
be Spanish, which is the only one that existed. A value that matches no point
is kept as-is and shown that way.

Continuity — which points were left uncovered on the previous attempt — only
looks at sessions of the **same pitch type and the same language**, so a
practice in English does not condition one in Spanish. An id in `puntosCerrados`
is not reminded: the second take covered it, and the retake text is not stored.

### API contract

Every route receives `idioma` (`'es' | 'en'`); absent means `'es'` and any other
value is a **400**. Generic messages, 413s, and the 429 are returned in that
language. On `/api/transcribir` the language goes as a **FormData field**,
because its body is multipart and not JSON.

The **429** is the only special case: the rate limit builds it, and the rate
limit runs *before* reading the body (on purpose: 20 MB of audio are not parsed
under abuse), so it takes the language from the `X-Idioma` header the client
sends on every request. When the body can be read, the body wins.

`/api/enriquecer` accepts `idioma` and uses it. The search goes out with
`language` and `filter_by_language`, and the visible pitch-type name comes from
the session dictionary. The transcript is still never sent to Tavily.

### Voice

The verdict and the Resolve findings questions go through `/api/tts`. Gender
(`male` / `female` / `random`) belongs to the session and does not change when
the language changes; the language chooses the Voice ID pair. If the language's
variables are missing, the client falls back to SpeechSynthesis.

Scribe (`POST /v1/speech-to-text`) accepts an optional `language_code` (ISO 639-1
or 639-3). If it is omitted, Scribe autodetects. Pitch Coach sends the session
language (`es` or `en`) because it is already known and the hint can improve
the transcription. `ELEVENLABS_SCRIBE_MODEL` only chooses the model (default
`scribe_v2`). `no_verbatim` is left off: that flag deletes filler words.

### Out of this phase

- Live STT (Scribe Realtime). This phase transcribes the full clip after stop.
- A talking-head or 3D coach.
