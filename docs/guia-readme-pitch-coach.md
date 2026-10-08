# Guide for updating the Pitch Coach README

Use this once the committee-minutes Serverless Job already works end to end: it is created, it finishes, and the dashboard shows the minutes. Not before. If the job is absent, do not name it in the README.

Keep the root README in English.

This is not a landing page or a pitch deck. The README stays the setup sheet. The technical pieces (NVIDIA, Nebius, Tavily, the job) go in two places: a short section in this README and the detail that already lives in `docs/`. Record the video after this pass.

Leave the product tone of the opening lines as it is. Do not add a market, a team, or a second page.

When the product loop includes them, the README names four things in the session description: the public-room objection, the spoken-figure check, the timeline, and the 45-second retake. Section 1 says where.

## What to edit, in this order

### 1. Main loop

In **What it does** (the live heading may be **What a session does**), after the dashboard, one sentence and nothing more for the job:

The server can request committee minutes. A job on Nebius runs outside the request, writes one objection for each missed point and a script that fits the chosen duration, and the dashboard shows it once the file is there.

Do not say the job replaces the analysis. Analysis of the recording is still Token Factory inside the Next process (Super by default, Ultra only when asked, Nano for the cheap calls).

When they are part of the product loop, the same session description also names:

- **Public-room objection** — one objection on the first missed point. The room follows the pitch type.
- **Spoken-figure check** — one figure the speaker already said.
- **Timeline** — where the covered points sit on the recording.
- **45-second retake** — a second take on one missed point.

The transcript is never sent to Tavily.

### 2. New section: How it runs

Place it after **Stack** and before **Local setup**. Four blocks, each with the real file. Fill the gaps with what landed in the code, not with this guide.

**Token Factory (NVIDIA, on every practice).** The server calls `https://api.tokenfactory.nebius.com/v1/chat/completions` from `src/lib/proveedor-nebius.ts`. Default models:

- Take analysis: `nvidia/nemotron-3-super-120b-a12b` (Super).
- Ultra analysis, only if the user asks: `nvidia/Nemotron-3-Ultra-550b-a55b`.
- Sparring, entities, and figure validation: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`.

When the product loop includes them, the Nano line also names the room objection, the spoken-figure check, the timeline, and the 45-second retake.

The model does not set the score. The rubric lives in `src/lib/rubricas.ts` and the server recounts filler words. Detail: `docs/guia-integracion-nebius.md`.

**Tavily (only when a point is missing).** Search and extract from the server. The transcript is not sent. At most two points in the practice request (`MAX_PUNTOS_ENRIQUECIDOS`). If there is no usable figure, there is no suggestion. The same server call also asks for one public-room objection on the first missed point and checks one figure the speaker already said. Detail: `docs/guia-integracion-tavily.md`.

**Committee-minutes job (Nebius Serverless AI, no GPU).** It is not an Endpoint and it does not rehost the app. Railway still serves Next. The job is a VM that starts, writes the minutes, and exits. The AI Cloud token is not `NEBIUS_API_KEY`.

Complete this list with the values from the job you actually ran:

- Image and worker: the real path (the proposal was `jobs/comite/`).
- Create the job: the real method and URL (the jobs docs use `POST https://api.nebius.cloud/ai/v1/jobs`).
- VM: the platform and the preset without a GPU, the ones you chose in the console. Do not copy a preset that includes a GPU.
- Input: a file injected with the session already analyzed. Documented cap: 64 KiB.
- Output: the volume or bucket where `acta.json` lands. Without that, the job disk is wiped when the job ends.
- The timeout you configured. The documented minimum is 1 hour; the worker has to exit on its own.
- Which model the worker uses. The proposal was Super for the minutes and Nano to accept or reject the figure. Ultra does not enter the job.
- The same Tavily rule: the job does not receive the transcript, only short entities and the point name.

**What the hackathon rule does not require.** The app already calls Token Factory at runtime. The job is the minutes, not the entry requirement. Gemini stays a manual fallback (`MODEL_PROVIDER=gemini`) and is not the demo path.

### 3. Stack

Add one line, only if the code is already there:

- **Nebius Serverless Job** — committee minutes, a VM without a GPU, one process that exits.

Do not list an Endpoint.

### 4. Local setup

In the variables step, split the two keys:

- `NEBIUS_API_KEY` — Token Factory. It is still the analysis key.
- The job's AI Cloud key — the real variable name in `.env.example`. Do not give it the same name as the Token Factory key if the code does not.

The job does not have to run for `npm run dev`. Say how it is triggered from the dashboard and what happens if the key is missing (take analysis continues; the minutes do not).

### 5. Limits

Remove or rewrite the line that says there is no work outside the request, if the job already is that work. Keep the lines that are still true: history in `localStorage`, STT is not live, tests have no UI.

Add only real job limits you have seen (for example: the minutes do not appear if the volume did not mount, or the dashboard does not poll logs).

### 6. Documentation

One new row in the table:

| `docs/guia-integracion-job.md` | Committee minutes: image, variables, volume, how to read the result |

That file is written in the same pass as the README. Do not duplicate the content in both places: the README summarizes, the guide has commands and variables.

### 7. Screenshots

Replace or add a dashboard screenshot where a reader can see, without opening DevTools:

- the Token Factory model id for that take
- a Tavily figure with its URL, or the discard
- the job id and the minutes (objections and script)

Those three are what the video will show. If one does not fit in the UI, do not invent it in the README.

## What to leave out

- A landing page, a market, a team, or a "why now".
- Jobs, Endpoints, or AI Cloud as if they were already there, if the trial job did not finish.
- A GPU preset copied from the Nebius documentation.
- Keys, tokens, or the contents of `.env.local`.
- Another hackathon, another calendar, or another track.

## Once the README is done

Only then prepare the video. Under 3 minutes, public on YouTube, and in this order: a short recording, the dashboard with the model id, the Tavily figure or its discard, the job id and the minutes. The Devpost form and the prior-project paragraph (`docs/formulario-devpost.md`, section 6) come after the video. Submission closes Friday 30 Oct 2026, 11:00 GT.
