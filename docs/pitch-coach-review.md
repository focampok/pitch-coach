# Pitch Coach — review for the Nebius x NVIDIA Global AI Hackathon

Review of **4 Oct 2026** (America/Guatemala). Code read on the local machine, path `/home/focampo/Proyectos/pitch-coach`, HEAD `48519996` (`feat(ui): propuesta de valor en masthead y pie con atribución`, 2 Oct 2026 20:37 GT). That tree was not modified, nothing was committed, nobody was registered, and nothing was deployed.

Live pages for this pass: [overview](https://nebiusglobalaihackathon.devpost.com/), [official rules](https://nebiusglobalaihackathon.devpost.com/rules), [dates](https://nebiusglobalaihackathon.devpost.com/details/dates), [resources](https://nebiusglobalaihackathon.devpost.com/resources) (the fetch returned little markdown; the credit detail is checked against the same day's extract), [kickoff](https://nebiusglobalaihackathon.devpost.com/updates/46203-kickoff-tips), forum thread with no visible reply [45215](https://nebiusglobalaihackathon.devpost.com/forum_topics/45215-can-one-project-win-an-overall-award-and-best-use-of-tavily). Jobs primitive: [docs.nebius.com/serverless/overview](https://docs.nebius.com/serverless/overview) and [docs.nebius.com/serverless/jobs/manage](https://docs.nebius.com/serverless/jobs/manage). Earlier notes from the same event: `/workspace/hackathon-scout/nebius-global-ai-hackathon/extract.md` (4 Oct ~08:10 GT) and `/workspace/hackathon-scout/nebius-nvidia-2026/` (28 Sep–3 Oct). If a sentence on the resources page contradicts the rules, the rules win (§11.4).

## 1. Verdict

Pitch Coach is an anonymous, bilingual (es/en) coach for spoken pitches. The user picks a type (capital, education, innovation, technology) and a duration, records or pastes text, and receives a score, a five-point rubric, filler words, a listenable verdict and, if a point is missing, a cited figure. It fits **Best Apps and Agents**, not Coding (it does not write or test code), not Personal AI (the history is `localStorage` for this browser session, not an assistant that acts), and not Physical AI.

The hard runtime rule **is in the code**: with `MODEL_PROVIDER` empty or `nebius`, the server calls `https://api.tokenfactory.nebius.com/v1/chat/completions` and the defaults are three Nemotron 3 models (Super, Ultra, Nano). Tavily is also a real call, not a mock, but only for at most two points. The demo [pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/) responded on 4 Oct with the home page. It was not verified that this deploy has `NEBIUS_API_KEY` or `TAVILY_API_KEY`: `.env.local` was not read and no pitch was sent.

The public fetch without login of `https://github.com/focampok/pitch-coach` now returns 200: the 404 is fixed and the page marks the repository as public. The public HTML also shows the `MIT license` label; the MIT license must stay visible in About. The repo is no longer the blocker the previous review described. The improvement that changes the product the most, and not only the hosting, is a **Serverless Job** (VM without a GPU) that builds a committee record on the five points and exits. An Endpoint that rehosts the current Next app does not add that.

## 2. Rules that matter for this repo

Primary source: [official rules](https://nebiusglobalaihackathon.devpost.com/rules), read on 4 Oct 2026. The overview widget says the same about the close: "Oct 30, 2026 @ 10:00am PDT" and "October 30 at 1:00pm EDT". Guatemala does not change clocks (UTC-6).

| Milestone | Official time | GT |
|---|---|---|
| Opening | Wed 26 Aug 2026, 9:00am PDT | Wed 26 Aug 2026, 10:00 |
| Submission close | Fri 30 Oct 2026, 10:00am PDT | **Fri 30 Oct 2026, 11:00** |
| Judging | Tue 1 Dec 2026 9:00am PST → Tue 15 Dec 2026 12:00pm PST | 1 Dec 11:00 → 15 Dec 14:00 |
| Winners | "on or around" Mon 11 Jan 2027, 12:00pm Pacific | ~11 Jan 2027, 14:00 |
| Devpost maintenance (banner on /details/dates) | 7 Oct 2026, 6:00 UTC / 2:00am ET | Wed 7 Oct 2026, 00:00 |

From Sunday 4 Oct 2026 there are 26 days until that Friday at 11:00. Judging does not ask for more build.

**Cash prizes, as they stand in the rules and in the overview.** Grand $20,000, 2nd $10,000, 3rd $6,000, the four tracks one Jetson Orin Nano each (no USD value in the rules), Best Use of Tavily **$3,000**, City Winner $500 × 20, Most Valuable Feedback $100 × 10 plus "NVIDIA swag pack". The overview says "$50,000 in cash" and "$50,000+ in prizes". The sum 20+10+6+3+20×500+10×100 gives 50,000; the "+" is the Jetsons and the swag. There is no other purse published on those pages.

**One prize, not several.** Rules text: "Each Project is eligible for one (1) Overall Award OR one (1) Track Award and one (1) Bonus Award." Tavily, City, and Feedback are in the table under Bonus Awards. Thread 45215 asks whether an Overall can still carry Tavily and whether Feedback counts as a bonus; the fetch showed no organizer reply. Until there is one, read the table: a single bonus, and Feedback is on that list. For this repo the bonus the code already pursues is Tavily. City does not apply from Guatemala: the rules require having **attended** a Builders & Brews and the list does not include Guatemala (it does include Mexico City). The resources page says it is enough to associate the submission with a city; §11.4 says the rules win.

**Hard platform rule.** "A working software application that runs on either Nebius Token Factory or Nebius AI Cloud and uses at least one NVIDIA open source model." "Runs on…" means a **runtime** call to the Token Factory inference API, **or** deploy/execution on AI Cloud (Serverless Jobs, Serverless Endpoints, or DevPods). The kickoff names Nemotron, GR00T, Cosmos, or Sonic. The Best Apps track asks for Nemotron on Token Factory: Ultra for heavy reasoning, Nano or Super for the fast path, and it **encourages** (it does not require) Serverless Endpoints or Jobs.

**Tavily.** The $3,000 bonus is for "a functional, runtime call to the Tavily API as part of its solution". It does not ask for an SDK with a name other than that API. A key in the README without the call is not enough. This repo already calls `search` and `extract` from the server (`src/lib/tavily.ts`, `src/lib/tavily-extract.ts`, `src/app/api/enriquecer/route.ts`).

**Eligibility.** Age of majority in the country of residence; Guatemala is not on the exclusion list (Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, and comprehensive OFAC sanctions). The project cannot have received funding or a commercial license from the sponsor or from Devpost. Submission materials in English, or with a translation of the video, the description, and the instructions. Several submissions only if they are substantially different.

**Prior project.** If it existed before the Submission Period, it "must have been significantly updated" after 26 Aug 2026, 9:00am PDT, and the submission must explain in writing what changed. The rules do not define a minimum diff. The git on this machine does show that the clause applies: the first commit is `6409d7c`, 18 Aug 2026 16:52 GT, author Francisco Ocampo. The last commit before the period is `416c873`, 25 Aug 2026 08:46 GT, message `pre-evento`. From `dc555e3` (27 Aug, Gemini client) the history is inside the period: Tavily and dashboard (30 Aug), Nebius provider (25 Sep, `ea1c55e`), sparring and Ultra (27 Sep), bilingual mode (28 Sep), Tavily with extract and validation (1 Oct), STT with time marks and the Acta redesign (2 Oct). That is more than a rebrand. History was not rewritten.

**Criteria, equal weight, after a stage 1 pass/fail** (real fit to the track and the APIs; a superficial rebrand does not pass): Technological Implementation, Design, Potential Impact, Quality of the Idea. Tie-break in that order.

The public Token Factory catalog was not downloaded again in this pass. This morning's extract (4 Oct ~08:10 GT) listed only Nemotron 3 Nano 30B, Super 120B, Ultra 550B, and Nemotron 3.5 Lightning, and did not see GR00T, Cosmos, or Sonic. The code does not use Lightning.

## 3. What the code does today

Real stack of this tree, not a guess for new ideas: **Next.js 16.3.1** (App Router), **React 19.2.8**, **TypeScript**, **Tailwind CSS 4**, **Vitest 3**. No database. No Nest. `package.json` does not declare a Nebius, Tavily, or ElevenLabs client: the calls are its own `fetch`.

Inference does **not** run on a Nebius GPU or on an Endpoint. It runs in the Node process of the Next server (local with `npm run dev`, or the Railway container). The `Dockerfile` is production-only (Node 24 Alpine, standalone output) and `railway.toml` points that Dockerfile at a healthcheck `/`. The browser does not see the API key.

| What | Where | Who it calls |
|---|---|---|
| Standard analysis | `src/app/api/analizar-pitch/route.ts` → `src/lib/analisis-modelo.ts` → `src/lib/modelo.ts` → `src/lib/proveedor-nebius.ts` | Token Factory, default `nvidia/nemotron-3-super-120b-a12b`, `enable_thinking: false`, timeout 20 s |
| Ultra analysis | same route, `nivel=ultra` | default `nvidia/Nemotron-3-Ultra-550b-a55b`, thinking left on, timeout 90 s, trace of 4–8 steps |
| Sparring, entities, query, and figure validation | `src/app/api/sparring/*/route.ts`, `src/lib/entidades-tavily.ts`, `src/lib/query-tavily.ts`, `src/lib/validar-sugerencia.ts` | tier `rapido`, default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` |
| STT | `src/app/api/transcribir/route.ts`, `src/lib/elevenlabs.ts` | ElevenLabs Scribe, default `scribe_v2` |
| TTS | `src/app/api/tts/route.ts` | ElevenLabs; the client falls back to SpeechSynthesis |
| Figures | `src/app/api/enriquecer/route.ts`, `src/lib/tavily.ts` | `https://api.tavily.com` search and extract, plus Nano |
| Contingency | `src/lib/proveedor-gemini.ts` | Gemini only if `MODEL_PROVIDER=gemini` |

`src/lib/proveedor-nebius.ts` sets the base `https://api.tokenfactory.nebius.com/v1` if `NEBIUS_BASE_URL` comes in empty, asks for `response_format.json_schema` with `strict: true`, and retries once if `finish_reason` is `length`. The score and the point names are not invented by the model: the rubric lives in `src/lib/rubricas.ts` (4 types × 5) and the server recomputes filler words in `src/lib/muletillas.ts`.

Tavily is capped on purpose. `MAX_PUNTOS_ENRIQUECIDOS = 2` in `src/lib/tavily.ts`. The transcript is not sent to Tavily; only short entities and the point name. Without `TAVILY_API_KEY` the route responds 200 with `sugerencias: []`. In-memory rate limit: 5 requests / 10 min on `/api/enriquecer`, 10 / 10 min on the rest (`src/lib/rate-limit.ts`). There is no queue and no work that survives the request.

There is no Serverless Endpoint, Job, DevPod, or Sandbox in the tree. There is no call to `api.nebius.cloud`. The history (`src/lib/historial-sesiones.ts`) stores at most 20 practices in `localStorage` and does not store the transcript, the verdict, or audio.

The product loop is closed in `docs/status.md` (snapshot 2 Oct 2026) and in the UI: `src/app/page.tsx`, `src/components/GrabadorVoz.tsx`, `src/components/DashboardResultado.tsx`, `src/components/SparringCoach.tsx`, `src/components/PanelProgreso.tsx`. API tests with mocked fetch; the microphone has no UI test.

## 4. Strengths

- It meets the Token Factory minimum with three Nemotron sizes in the same product, which is exactly the split the Best Apps track describes (Super on every recording, Ultra only if asked, Nano on the cheap path). The restricted schema and the server-side score make the implementation less fragile than a single prompt.
- It is a usable product, not a notebook: selectors, recording with a cutoff, fallback text, dashboard, voice on demand, bilingual, local history, and a demo that loads.
- Tavily does not show the first hit. Extract plus a Nano validator that requires a figure, a citation, and relevance, and if there is no datum there is no suggestion. That is real use of the API, not a badge.
- Privacy is thought through: keys only server-side, transcript kept out of Tavily, Sentry with scrub (`src/lib/sentry-scrub.ts`), history without the pitch text.
- The update inside the period can be shown with git dates.

## 5. Weaknesses

Against the four criteria, not against a feature list.

**Implementation.** The Token Factory call is correct and tested with mocks (`test/proveedor-nebius.test.ts`), but the whole "agent" fits inside the request timeout: 20 s standard, 90 s Ultra. There is no workflow that continues when the user closes the tab. AI Cloud does not appear. A judge looking for Jobs or Endpoints does not find them; the rule does not require them, and the track brief does point at them as the next step.

**Product vs demo.** The experience of one practice is closed. What is missing is the second pass: today "Resolve findings" asks up to three questions (`SparringCoach.tsx`) and Tavily covers two points. There is no rewritten script fitted to the chosen duration and no record that can be read without recording again. The visual coach is still text; `docs/status.md` marks it as temporary. That does not fail stage 1, but the Design criterion compares against a complete product.

**Impact.** The audience is stated (someone practicing a capital, education, innovation, or technology pitch, LATAM, with no account). The demo shows feedback from one take. It does not show someone arriving at a meeting with the gap closed. In an overview that this fetch marked at 17,291 participants — the same morning's extract already warned that counter is not stable across fetches — one more voice coach is easy to file away if the judge does not see the cited figure and the model id.

**Non-obviousness.** A fixed rubric plus STT plus an LLM is a crowded genre. The least obvious thing that already exists is the contract (the model does not set the score, Tavily does not receive the monologue, the figure is thrown out if it is from another sector). That is in the code and almost invisible on the surface. The model id does not come back to the client; it lives in server logs.

**Production configuration.** The Railway deploy's keys are not checked: if production were on `MODEL_PROVIDER=gemini`, the Nebius runtime would not be exercised even though the code default is Nebius. The home page loaded; an analysis was not run.

## 6. Prioritized improvements (~26 days)

Another product and another stack are not proposed. The tree stays on Next. What is new is work the current request cannot finish.

### 1. "Committee record" job on Nebius Serverless AI

A **Job**, not an Endpoint.

An Endpoint serves a URL while it is on and, according to [the Serverless AI overview](https://docs.nebius.com/serverless/overview), the container disk is erased when it stops. Railway already serves the app. Rehosting it does not change what the user receives and it does add a VM that stays on. Hosting another Nemotron on a GPU of one's own duplicates what Token Factory already serves (`proveedor-nebius.ts`) and is not in the budget of these days.

A Job runs until it finishes and then releases the VM. It fits a record that does not fit in 20–90 s or in `MAX_PUNTOS_ENRIQUECIDOS = 2`. The jobs console lets you choose a VM **without a GPU** ("VMs without GPUs only support the regular type", in [Managing jobs](https://docs.nebius.com/serverless/jobs/manage)). The worker is an HTTP client in Python. The CUDA image from that page's example is not needed (`gpu-l40s-a`, `1gpu-8vcpu-32gb`); copying that example would mean paying for a GPU to do `fetch`.

What it would do that today's app does not:

1. The dashboard sends the session already analyzed (transcript, type, language, duration, ids of unmet points). Cap 64 KiB: that is the limit of an injected file.
2. `POST https://api.nebius.cloud/ai/v1/jobs` creates the job. The AI Cloud token is not the Token Factory `NEBIUS_API_KEY`. Timeout `3600s`, the minimum that page documents (the maximum is 168 h; the default is 24 h). The worker has to exit on its own: if it hangs, the VM can live until that hour.
3. Inside the container, one Super call drafts a JSON record: one objection per unmet point (up to five, not two) and a spoken script that fits the chosen duration. Each objection that needs a datum goes through Tavily search + extract. Nano accepts or rejects the figure. Ultra does not enter this job: the Ultra button and its 90 s timeout already exist. Putting Ultra here burns credit and lengthens the video.
4. The transcript goes to Token Factory, the same as today. Only short entities and the point name go to Tavily, the same rule as `src/lib/tavily.ts`. The record is written to a mounted volume (`spec.volumes` or `s3://…` in the CLI). The job disk is erased when it finishes; without a volume there is no record.
5. The UI does not block the practice. It shows the job id. The manage page documents logs in the console and the CLI (`nebius ai job logs`), not a GET of logs in the REST fragment that was read. Do not invent a log poller. Reading the record is the object in the bucket.

The Job is the implementation and product argument, not the entry ticket: if the AI Cloud project, the quota, or the registry are not ready, the hard rule is already met with Token Factory. It should exist before the last day; the close is still Friday 30 Oct 2026 at 11:00 GT, not the moment the project is created.

### 2. Close the coach's second pass without blocking the practice

The product should keep the first quick practice and add the step that is missing today: turn unmet points into objections and into a script that fits the chosen duration. The Job above is the place for the long record; the UI shows its `jobId` and does not replace the live analysis. Keep the Tavily limit and the transcript separation described in `src/lib/tavily.ts`.

**Leave out of these 26 days:** accounts, sync across devices, live STT, coach animation, editable rubrics, moving Railway to an Endpoint, Token Factory Sandboxes (they go to the Coding track and are still in beta), NemoClaw / OpenShell / Hermes, and serving Nemotron on a GPU of one's own. Also do not reimplement all of `tavily.ts` inside the worker: the worker validates with a short schema; the fine quality of entities still lives on the Next server, which is what builds the injected JSON.

## 7. Proposed diff, not applied

Review proposal. **It is not applied** in `/home/focampo/Proyectos/pitch-coach`. It does not replace existing files; it adds four files. Platform and preset come from variables: the doc's GPU example is not copied.

```diff
diff --git a/jobs/comite/Dockerfile b/jobs/comite/Dockerfile
new file mode 100644
--- /dev/null
+++ b/jobs/comite/Dockerfile
@@ -0,0 +1,8 @@
+# Job image. HTTP client, no CUDA.
+# The VM preset is chosen when the job is created, not here.
+FROM python:3.12-slim
+WORKDIR /app
+COPY worker.py .
+# /output is the volume mounted when the job is created.
+# Without that volume the job disk is erased on exit.
+CMD ["python", "worker.py"]
diff --git a/jobs/comite/worker.py b/jobs/comite/worker.py
new file mode 100644
--- /dev/null
+++ b/jobs/comite/worker.py
@@ -0,0 +1,112 @@
+"""Committee record. One run, then exit.
+
+Reads /mnt/files/sesion.json (injected file, 64 KiB cap in the jobs docs).
+Calls Token Factory. Does not send the transcript to Tavily.
+Writes /output/acta.json and exits. If a key is missing, exits with code 1
+so the VM is not left hanging until the 1 h minimum timeout.
+"""
+import json, os, sys, urllib.request
+from pathlib import Path
+
+ENTRADA = Path(os.environ.get("COMITE_ENTRADA", "/mnt/files/sesion.json"))
+SALIDA = Path(os.environ.get("COMITE_SALIDA", "/output/acta.json"))
+BASE = os.environ.get("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1").rstrip("/")
+SUPER = os.environ.get("NEBIUS_MODEL_SUPER", "nvidia/nemotron-3-super-120b-a12b")
+NANO = os.environ.get("NEBIUS_MODEL_NANO", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B")
+
+def post(url, payload, headers):
+    req = urllib.request.Request(
+        url, data=json.dumps(payload).encode(), headers=headers, method="POST"
+    )
+    with urllib.request.urlopen(req, timeout=60) as res:
+        return json.load(res)
+
+def chat(modelo, system, user):
+    clave = os.environ["NEBIUS_API_KEY"]
+    cuerpo = post(
+        f"{BASE}/chat/completions",
+        {
+            "model": modelo,
+            "messages": [
+                {"role": "system", "content": system},
+                {"role": "user", "content": user},
+            ],
+            "temperature": 0.2,
+            "max_tokens": 1500,
+            "chat_template_kwargs": {"enable_thinking": False},
+            "response_format": {
+                "type": "json_schema",
+                "json_schema": {
+                    "name": "acta_comite",
+                    "strict": True,
+                    "schema": {
+                        "type": "object",
+                        "additionalProperties": False,
+                        "required": ["objeciones", "guion"],
+                        "properties": {
+                            "objeciones": {
+                                "type": "array",
+                                "items": {
+                                    "type": "object",
+                                    "additionalProperties": False,
+                                    "required": ["punto", "pregunta", "query"],
+                                    "properties": {
+                                        "punto": {"type": "string"},
+                                        "pregunta": {"type": "string"},
+                                        "query": {"type": "string"},
+                                    },
+                                },
+                            },
+                            "guion": {"type": "string"},
+                        },
+                    },
+                },
+            },
+        },
+        {"Authorization": f"Bearer {clave}", "Content-Type": "application/json"},
+    )
+    return json.loads(cuerpo["choices"][0]["message"]["content"])
+
+def cifra_o_nada(query, idioma):
+    """search + extract. Nano only says whether a figure is citable.
+    The Next server built the query from short entities, not this file.
+    """
+    tavily = os.environ.get("TAVILY_API_KEY")
+    if not tavily or not query:
+        return None
+    busqueda = post(
+        "https://api.tavily.com/search",
+        {"query": query, "max_results": 3, "topic": "general"},
+        {"Authorization": f"Bearer {tavily}", "Content-Type": "application/json"},
+    )
+    hits = busqueda.get("results") or []
+    if not hits:
+        return None
+    top = hits[0]
+    # Nano gives the relevance verdict, not Tavily's ranking.
+    veredicto = chat(
+        NANO,
+        "Acepta la fuente solo si contiene una cifra concreta y del mismo tema. Responde JSON.",
+        json.dumps({"query": query, "idioma": idioma, "titulo": top.get("title"), "url": top.get("url"), "recorte": (top.get("content") or "")[:1500]}, ensure_ascii=False),
+    )
+    # chat() above requires the record schema. In the real file this
+    # call uses another json_schema (aceptada, cifra, cita). The gap is
+    # left marked so the diff does not pretend to include a second parser.
+    return {"url": top.get("url"), "titulo": top.get("title"), "nota": "validar con esquema propio de Nano"}
+
+def main():
+    sesion = json.loads(ENTRADA.read_text())
+    acta = chat(
+        SUPER,
+        "Eres un comité de tres lectores. Una objeción por punto no cumplido. El guion debe caber en la duración. La query de cada objeción usa solo las entidades dadas, nunca una frase del pitch.",
+        json.dumps(sesion, ensure_ascii=False),
+    )
+    for objecion in acta["objeciones"]:
+        objecion["fuente"] = cifra_o_nada(objecion.get("query", ""), sesion.get("idioma", "es"))
+    SALIDA.parent.mkdir(parents=True, exist_ok=True)
+    SALIDA.write_text(json.dumps(acta, ensure_ascii=False, indent=2))
+
+if __name__ == "__main__":
+    try:
+        main()
+    except Exception as exc:
+        print(f"comite: {exc}", file=sys.stderr)
+        sys.exit(1)
diff --git a/src/lib/comite-job.ts b/src/lib/comite-job.ts
new file mode 100644
--- /dev/null
+++ b/src/lib/comite-job.ts
@@ -0,0 +1,78 @@
+// Creates a Serverless Job. It does not call Token Factory: the container does.
+// API: POST https://api.nebius.cloud/ai/v1/jobs
+// (docs.nebius.com/serverless/jobs/manage, read on 4 Oct 2026).
+
+const TOPE_BYTES = 64 * 1024; // injected file, documented limit
+
+export interface SesionComite {
+  idioma: "es" | "en";
+  tipoPitch: string;
+  duracionMaximaMin: number;
+  transcripcion: string;
+  /** Rubric ids, not free text from the client. */
+  puntosSinCumplir: string[];
+  /** Entities already extracted in Next. The worker does not redo that step. */
+  entidades: string[];
+}
+
+export function payloadCabe(sesion: SesionComite): boolean {
+  return Buffer.byteLength(JSON.stringify(sesion), "utf8") <= TOPE_BYTES;
+}
+
+export async function crearJobComite(sesion: SesionComite): Promise<{ id: string }> {
+  const token = process.env.NEBIUS_CLOUD_TOKEN;
+  const projectId = process.env.NEBIUS_PROJECT_ID;
+  const image = process.env.NEBIUS_JOB_IMAGE;
+  const platform = process.env.NEBIUS_JOB_PLATFORM;
+  const preset = process.env.NEBIUS_JOB_PRESET;
+  const volume = process.env.NEBIUS_JOB_VOLUME;
+  if (!token || !projectId || !image || !platform || !preset || !volume) {
+    throw new Error("Falta configuración de AI Cloud. El análisis en Token Factory sigue disponible.");
+  }
+  if (!payloadCabe(sesion)) {
+    throw new Error("La sesión supera 64 KiB y no cabe en un injected file.");
+  }
+
+  const respuesta = await fetch("https://api.nebius.cloud/ai/v1/jobs", {
+    method: "POST",
+    headers: {
+      Authorization: `Bearer ${token}`,
+      "Content-Type": "application/json",
+    },
+    body: JSON.stringify({
+      metadata: { parentId: projectId, name: `pitch-acta-${Date.now()}` },
+      spec: {
+        image,
+        containerCommand: "python",
+        args: "worker.py",
+        timeout: "3600s",
+        platform,
+        preset,
+        preemptible: false,
+        volumes: [{ source: volume, containerPath: "/output", mode: "READ_WRITE" }],
+        injectedFiles: [{
+          containerPath: "/mnt/files/sesion.json",
+          content: Buffer.from(JSON.stringify(sesion), "utf8").toString("base64"),
+        }],
+        // NEBIUS_API_KEY and TAVILY_API_KEY go through SecretStash
+        // (secret environmentVariables in the same doc), not in this JSON.
+      },
+    }),
+  });
+
+  if (!respuesta.ok) {
+    throw new Error(`AI Cloud respondió ${respuesta.status}`);
+  }
+  const cuerpo = (await respuesta.json()) as { metadata?: { id?: string } };
+  const id = cuerpo.metadata?.id;
+  if (!id) throw new Error("AI Cloud no devolvió metadata.id");
+  return { id };
+}
diff --git a/src/app/api/comite/route.ts b/src/app/api/comite/route.ts
new file mode 100644
--- /dev/null
+++ b/src/app/api/comite/route.ts
@@ -0,0 +1,55 @@
+import { NextResponse } from "next/server";
+import { crearJobComite, payloadCabe, type SesionComite } from "@/lib/comite-job";
+import { limitar } from "@/lib/rate-limit";
+import { extraerEntidades } from "@/lib/entidades-tavily";
+import { excedeLimiteTranscripcion } from "@/lib/limites";
+
+export const runtime = "nodejs";
+
+/**
+ * POST /api/comite
+ * Does not analyze the pitch. Analysis stays on /api/analizar-pitch.
+ * If AI Cloud is not configured, it responds 501 and the dashboard does not break.
+ */
+export async function POST(request: Request): Promise<NextResponse> {
+  const bloqueo = limitar(request, "comite");
+  if (bloqueo) return bloqueo as NextResponse;
+
+  let body: Partial<SesionComite>;
+  try {
+    body = (await request.json()) as Partial<SesionComite>;
+  } catch {
+    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
+  }
+
+  if (!body.transcripcion || excedeLimiteTranscripcion(body.transcripcion)) {
+    return NextResponse.json({ error: "Transcripción ausente o demasiado larga" }, { status: 413 });
+  }
+  if (body.idioma !== "es" && body.idioma !== "en") {
+    return NextResponse.json({ error: "Idioma inválido" }, { status: 400 });
+  }
+
+  const sesion: SesionComite = {
+    idioma: body.idioma,
+    tipoPitch: body.tipoPitch ?? "",
+    duracionMaximaMin: body.duracionMaximaMin ?? 3,
+    transcripcion: body.transcripcion,
+    puntosSinCumplir: (body.puntosSinCumplir ?? []).slice(0, 5),
+    entidades: body.entidades?.length
+      ? body.entidades
+      : await extraerEntidades(body.transcripcion, body.idioma),
+  };
+
+  if (!payloadCabe(sesion)) {
+    return NextResponse.json({ error: "La sesión no cabe en el job" }, { status: 413 });
+  }
+
+  try {
+    const { id } = await crearJobComite(sesion);
+    return NextResponse.json({ jobId: id });
+  } catch (error) {
+    const mensaje = error instanceof Error ? error.message : "No se pudo crear el job";
+    const sinNube = mensaje.startsWith("Falta configuración");
+    return NextResponse.json({ error: mensaje }, { status: sinNube ? 501 : 502 });
+  }
+}
```

The `cifra_o_nada` hunk is incomplete on purpose: it reuses `chat()` with the record schema, and that does not work for a yes/no. In the real implementation that function has its own `json_schema` (`aceptada`, `cifra`, `cita`) and does not call Super. The dashboard button is not in this diff: it is a `POST` to `/api/comite` from `DashboardResultado.tsx` that shows `jobId` or the 501, without replacing the live analysis.

`extraerEntidades` is internal to the Tavily flow today; if its signature does not accept `(transcripcion, idioma)` as written, the route uses the helper that already exists in `src/lib/entidades-tavily.ts` instead of inventing another. `limitar()` needs a `"comite"` scope in `LIMITES_POR_AMBITO` (the enrich one, 5/10 min, is the right ceiling). Those two lines are not expanded here.

## 8. Risks

- **The job is not the rules pass.** If AI Cloud (project, registry, quota, `editor` role) is not ready, the submission is still valid with Token Factory. Presenting an empty Endpoint or a GPU job that only does `curl` reads as a checklist.
- **Minimum timeout of 1 h and disk erasure.** A worker that does not exit can bill up to the timeout. Without a volume, the record disappears with the VM. The no-GPU preset and the price were not verified on an account; the doc only states that the VM without a GPU exists and that it is billed as Compute, per second, while it runs.
- **Distinct keys and tokens.** The Job needs the AI Cloud token; it is not the Token Factory `NEBIUS_API_KEY`. `TAVILY_API_KEY` also has to be injected without putting secrets in the JSON. Railway's production configuration (`NEBIUS_API_KEY`, `TAVILY_API_KEY`, `MODEL_PROVIDER=nebius`) was not checked.
- **Project from before 26 Aug.** Git shows it (first commit 18 Aug 2026 16:52 GT; `pre-evento` baseline on 25 Aug). The later work (Nebius on 25 Sep, Tavily hardened on 1 Oct, UI on 2 Oct) is the argument; a judge can still say the genre was already there on 25 Aug. History was not touched.
- **A single bonus.** If the entry also competes in Feedback, the rules as written do not allow also taking Tavily's $3,000. Thread 45215 had no reply in this fetch.
- **Credits.** The Builder Program terms page was not opened again in this pass. The $3,000 Tavily prize is in the rules. A credit balance is not claimed here.

### Facts this pass could not close

- Whether the Railway container has `NEBIUS_API_KEY`, `TAVILY_API_KEY`, and `MODEL_PROVIDER=nebius`. The home page loaded; an analysis was not run.
- Official reply to thread 45215.
- Dollar amount of the Builder Program's Tavily credits.
- Platform id and preset name of a VM without a GPU. The doc says "without GPU" can be chosen and the only example preset is `1gpu-8vcpu-32gb`.
- Token Factory catalog re-downloaded today. This morning's extract is cited for Lightning / the absence of GR00T, Cosmos, and Sonic.
- Whether Francisco has already clicked Join Hackathon. No session was opened.

## 9. Deliverables checklist

This is done at the end, when the product is no longer going to be touched. Close: Friday 30 Oct 2026, 11:00 GT.

- [ ] Leave `https://github.com/focampok/pitch-coach` public and the MIT license visible in About.
- [ ] Publish a public YouTube video of up to 3 minutes. It has to show a recording, the dashboard with the Token Factory model id, and a Tavily figure with its URL or the explicit discard.
- [ ] Complete the Devpost form in English: description, instructions, and written feedback on Token Factory, AI Cloud, and NVIDIA.
- [ ] Paste into the form the prior-project paragraph from `docs/formulario-devpost.md` §6 (what changed after 26 Aug 2026).
- [ ] Put the demo `https://pitch-coach-production-1c0c.up.railway.app/` on the submission.
- [ ] Check that the setup README is enough to run the demo without asking.
- [ ] Check that the video, the repo, and the demo are still reachable on 30 Oct at 11:00 GT.
