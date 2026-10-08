# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four profiles, **deliberately with no primary user**: builders/founders
(capital pitch), teachers and students (education pitch), technical profiles
(technology pitch), and anyone presenting a proposal (innovation pitch).

The situation is the same for all of them: **they are about to present to a real
audience and want to practice out loud first**, with objective feedback instead of
the mirror, an unanalyzed recording, or someone's unstructured opinion.

The **only segmentation is the pitch type**, which the user chooses at the start.
There is no segmentation by role, plan, or experience level, and the four types
weigh the same: no profile can become the product's main path.

Market: **LATAM**, with interface and feedback in Spanish and English.

The **submission narrative** (Devpost video and text) shows a single case,
end to end: someone in LATAM rehearsing a capital pitch out loud, the night
before, without a coach. That does not change the segmentation: the four types
still weigh the same in the interface. The detail is in Hackathon.

## Product Purpose

**Pitch Coach** is a pitch-practice tool. The user speaks out loud into the
microphone; the system transcribes, evaluates the content against the rubric of
the chosen type, counts filler words, and shows a dashboard with the detail.
The short verdict can be heard when the user asks for it.

The central idea:

> Practice out loud. Get concrete feedback — written first, spoken if you ask
> for it — as if a coach were listening.

Success is that someone can **practice and know what is missing** in a minute,
with no prior ceremony and with something actionable at the end.

## Positioning

**The main differentiator: the rubric is tied to the pitch type.** Each type
— capital, educacion, innovacion, tecnologia — has five fixed points the
evaluation looks for. A generic coach evaluates "communication"; this one
evaluates whether you actually covered the problem, the market, the ask.

**Second differentiator: immediacy without an account.** Out-loud practice with
an objective result in a minute. No sign-up, no file upload, no ceremony.

A neighboring product — something like Yoodli — cannot honestly copy this
without adopting the same model: a rubric per type as the contract with the
user, and an immediate result with no access friction.

## Operating Context

**Main loop:** choose language, pitch type, and maximum duration (presets from 1
to 7 minutes) → record out loud → the recording **stops itself** at the limit →
the server transcribes (ElevenLabs Scribe) → filler words are counted on the
transcript → the model evaluates against the rubric → dashboard with score,
covered and missing points, highlighted transcript, and verdict.

**The same session, in a chain — these are not decorations:** listen to the
verdict (TTS); **cited figure** (Tavily, only if a rubric point was missed);
**Ultra analysis** (re-analysis with extended reasoning and a trace, on
request); **Resolve findings** (up to 3 follow-up questions on missed points,
answered by voice or text); **downloadable script** with a time mark per
sentence, if it was recorded; **Your progress** (local history).

**Result visibility contract.** On the first view, with no click, three things
sit together: the score, the rubric point that was missed, and the cited figure
that can be said out loud, with its source. Ultra stays a deliberate step — it
is slower and is reserved for serious reasoning — but the request is obvious,
and once it has run the trace sits next to the score. Model names are short
provenance, not the headline. Why this contract exists is in Hackathon.

**Real environment of use:** a modern browser with a microphone, HTTPS outside
localhost. **Anonymous** session. The ritual is speaking out loud, not typing.

## Capabilities and Constraints

**Implemented:** type selector (4 fixed options) and duration selector (1–7 min);
recording with automatic stop; transcription (MediaRecorder + Scribe) with a
**fallback text field** if there is no microphone or permission is denied;
filler-word detection by count (21 LATAM public-speaking patterns in Spanish; a
separate English list, which avoids marking "like"/"so"/"right" from the bare
word); evaluation against the rubric through the active provider (Nebius by
default, Gemini as contingency), with structured JSON; score calculated on the
server (the model does not set the score); verdict TTS with SpeechSynthesis as
a mandatory fallback; dashboard; cited figure with Tavily on missed points;
public-room objection for the type; check of one figure already spoken; timeline
of covered points; 45-second second take; Ultra analysis; Resolve findings;
local history of the last 20 practices, with the coverage delta.

**Model routing on Nebius Token Factory** (the fact the result must be able to
show as provenance, and that the video and the README have to narrate):

| Level | Model | What it is for |
|---|---|---|
| `estandar` | Nemotron 3 Super | Analyzes every take: the minute's score, against the rubric |
| `ultra` | Nemotron 3 Ultra | Re-analysis on request, with a 4-to-8-step trace |
| `rapido` | Nemotron 3 Nano | Sparring, short entities, search-query writing, citation checks and the spoken phrase for the figure, the public-room objection, the check on one figure the speaker already said, the timeline, and the 45-second retake |

Gemini is a manual contingency and **ignores the level**. It is not the story
of the submission. Tavily runs on missed points (a statistic and, on the first
one, the room objection) and also checks a figure the pitch already said.
**The transcript is never sent to Tavily.** If there is no key or it fails, the
rest of the result continues.

**Constraints the design must respect:**

- **Rubric-point ids are a contract.** They travel through the API and stay
  stored in history: renaming one breaks data already persisted. Five stable
  ids per type.
- **No server persistence.** History lives in that browser's `localStorage` and
  does not store the transcript, comments, the Ultra trace, questions, answers,
  or audio.
- **Audio is processed in memory and discarded.** It is not written to disk and
  is not attached to logs, breadcrumbs, or Sentry.
- **Bilingual by contract.** A single `idioma` value (`'es' | 'en'`) governs
  the interface, rubrics, prompts, error messages, the voice pair, the STT hint,
  and filler words. Adding a language must mean adding data, not touching
  components. Absent means `'es'`; any other value is 400.
- **Never depend on a single channel.** If an external service fails, the loop
  does not stop: TTS falls back to SpeechSynthesis, and without a microphone
  there is fallback text.
- **No live STT.** The flow is record → stop → transcribe the full clip.
- **Out of scope in this version:** accounts/login, sync across devices,
  comparing two attempts in the same session, custom rubrics, languages beyond
  es/en, video or body-language analysis, a separate backend.
- **No decided business data:** price, business model, and usage metrics are
  undefined and must not be invented.

## Brand Commitments

- **Name:** Pitch Coach.
- **Open source, MIT license.** The project can be used, forked, and matured.
- **Humor lives in the copy, not in the drawing.** (§5.1) The tone can be
  conversational and with a wink — "that 'you know' landed hard — that's 12" —
  but that lives in the text, not in the visual language.
- **Bilingual is identity, not a translation pass.** Latin American Spanish is a
  first-class case, not a later localization.
- **Committed visual direction.** The direction and the palette are recorded in
  `docs/referencias-ui/README.md` as working evidence. The **only formal home**
  of the approved tokens is `DESIGN.md`; on any visual discrepancy, `DESIGN.md`
  wins. This document registers that **as a pointer, without expanding it**:
  the visual world belongs to `DESIGN.md` and to the new-work flow, not to this
  document.
- **Anti-orb.** The visual direction explicitly discards the glowing
  sphere/orb as the representation of the coach; the replacement is a live
  indicator that reacts to the audio, with a single hue.
- **No logo wall.** Model names (Nebius/Nemotron, Tavily) are provenance, not
  the dashboard headline.

## Evidence on Hand

**Real and available:**

- Product and contract documentation: `docs/alcance.md`, `docs/status.md`,
  `docs/README.md`.
- Working live demo:
  `https://pitch-coach.focampo.com`.
- Screenshots of the current state in `public/screenshots/` (`01.png` selection,
  `02.png` coach, `03.png` dashboard) — **of the current visual world (the
  Record redesign)**; they feed the README and the submission material.
- Visual-direction material and references in `docs/referencias-ui/`.
- **The submission video does not exist.** It is a requirement (public YouTube,
  ≤3 min, English, with audio). Do not invent a link.
- **The submission-period delta is not written.** The project predates August
  26, 2026; the explanation is mandatory and does not exist yet.

**Absences future work must NOT fabricate:** there are no testimonials,
customers, case studies, usage metrics, benchmarks, press, or a price. Any
social proof or traction number would be invented.

## Hackathon

Pitch Coach is submitted to the **Nebius x NVIDIA Global AI Hackathon**
(Devpost). This section is delivery context, in force until close. It does not
rewrite the product principles: the four pitch types still weigh the same in
the interface.

**Confirmed track:** Best Apps and Agents. Build an app or an agent that
someone would actually use, with Nemotron models on Nebius via Token Factory.
Ultra for serious reasoning; Nano or Super for the fast path, so the app keeps
responding. Serverless Endpoints and Serverless Jobs are encouraged and **are
not a requirement**. Do not migrate hosting to tick that box: inference already
runs on Token Factory and the demo lives on Railway.

**Dates:**

- Submission: August 26, 2026, 9:00 PT – **October 30, 2026, 10:00 PDT**.
- Judging: December 1–15, 2026. Winners around January 11, 2027.
- The project **predates** August 26. What changed during the period has to be
  explained in writing. The redesign is part of that explanation. Do not
  present the app as if it had been born in the hackathon.

**Stage one** is pass/fail: real fit with the track, not a superficial rebrand.
**Stage two** scores 1–5, equal weight, in this order (the same order breaks
ties):

1. **Technological Implementation** — how well it is built and how effectively
   it uses Token Factory (or AI Cloud) and Nemotron.
2. **Design** — a complete, coherent product experience, not a proof of
   concept.
3. **Potential Impact** — a credible, specific case of a real problem for a
   real audience, and that what is demonstrated actually attacks it.
4. **Quality of the Idea** — creative, non-obvious use of the models, and a
   genuine understanding of the problem.

What the track asks to see beyond the basics: **a multi-step flow that chains
tools**, not a single model call. Pitch Coach already is that chain (voice →
transcription → rubric with Super → cited figure and room objection with
Tavily → check of a spoken figure → trace with Ultra if requested → sparring
with Nano → second take on one point → spoken verdict). The redesign has to
make that chain legible. Hiding it competes as "an LLM that gives feedback."

**Judges are not required to open the app.** They can score from the text, the
images, and the video alone. What appears on screens and in the video is
evaluation surface. The video cannot show a trace or a figure the app does not
actually produce.

**Judging package, in English.** Video, description, and test instructions are
in English, or include a translation. The app stays bilingual; Latin American
Spanish stays a first-class case. The submission video and screenshots use the
English interface.

**Video (does not exist yet):** public YouTube, **≤3 minutes** (they do not
watch more), with the app working. Treat it as a pitch, not a tutorial:
problem, solution running, who it is for, and **out loud** how it uses Nebius
Token Factory and Nemotron — a passing mention is not enough. It shows a single
type end to end (capital pitch, LATAM, the night before). The other three types
stay in the app and in one sentence of the text.

**README and description** have to say which Nemotron model does what, where
Token Factory speeds the flow, and which other Nebius services are involved.
The MIT license is already visible and the setup README already exists.

**Tavily is part of the solution, not a hidden extra.** Best Use of Tavily is
USD 3,000. Eligibility is a real API call inside the solution (already there).
Winning it depends on the use being obvious and carrying weight: the missed
rubric point receives a figure that can be said, with a source. It can be won
**together with the track prize** (a Jetson Orin Nano) and not together with a
general prize (USD 20,000 / 10,000 / 6,000): it is a general prize, or track
plus a bonus.

**Written feedback, mandatory, and it is not a screen.** For Token Factory and
each model: what it was used for, what worked, what did not, what zero to the
first call was like, and whether you would build with them again. There is a
separate small prize (USD 100, 10 winners) for specific feedback. Do not design
a feedback widget inside the product.

**City prize (USD 500): not a design input.** The official rules require having
attended a Builders & Brews; the resources page says it is enough to be
associated with a city, and where they conflict the rules win. Attendance is
not on record. Mexico City already happened (September 23, 2026).

**What the redesign must not do:**

- Collapse the cited figure, or the Ultra trace once it has run.
- Turn the dashboard into a wall of Nebius or Tavily logos. Model names are
  provenance, not the headline. That protects the Design criterion.
- Reduce the product to a single pitch type in pursuit of Potential Impact.
- Invent traction, testimonials, price, or metrics.
- Add accounts, Serverless, or a hackathon feedback form.

**Sources (the official rules win if a post contradicts them):**

- https://nebiusglobalaihackathon.devpost.com/rules
- https://nebiusglobalaihackathon.devpost.com/updates/46204-here-s-how-judging-works
- https://nebiusglobalaihackathon.devpost.com/updates/46205-how-to-build-a-winning-project
- https://nebiusglobalaihackathon.devpost.com/resources

The local excerpts in `oficina-agente/salidas/md/` cut those two updates.
`perks.md` in that folder is from Shipaton / RevenueCat and does not apply here.

## Product Principles

1. **The pitch type is the only segmentation, and the four weigh the same.** No
   profile or type can become the main path of the design.
2. **The evaluation is specific, never generic.** Each rubric point is concrete
   and auditable; feedback that would serve any pitch does not serve.
3. **Friction near zero.** Practice out loud and get a result with no account,
   nothing to upload, and no prior ceremony.
4. **Never a single channel.** Voice and visual hold each other up; if an
   external service fails, the loop continues.
5. **Nothing leaves the browser by default.** Audio discarded, local history,
   anonymous session.

## Accessibility & Inclusion

**Adopted standard: WCAG 2.2 AA** — contrast, visible focus, keyboard
navigation, and touch-target size, verifiable in an audit.

Product needs already established:

- **Bilingual es/en** with automatic selection from the browser and a saved
  preference; the language also governs what is heard.
- **Voice first, with a real alternative.** The flow depends on speaking out
  loud, so the fallback text field and the alternatives to audio are part of
  the design, not a patch.
- **The interface shows and also says.** The result never depends on audio
  alone: the dashboard is the main channel and TTS is on request.
