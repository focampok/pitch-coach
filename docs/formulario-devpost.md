# Pitch Coach — Additional info (Devpost)

Ficha para copiar y pegar en **Additional info** del [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/). Esa sección la leen jueces y organizadores; no sale en la página pública del proyecto.

Cada bloque bajo **Pegar** es el texto completo del campo, en inglés. Cópialo tal cual. Las notas en español no se pegan.

Premios bono: Tavily (3.000 USD), ciudad (500 USD) y feedback (100 USD) son premios distintos. Las [reglas](https://nebiusglobalaihackathon.devpost.com/rules) permiten **un** premio bono por proyecto, además de un premio general o uno de track. Completa Tavily y el feedback: el feedback es requisito de todo envío, y Tavily es el bono al que apunta este proyecto. No hubo Builders & Brews en Guatemala, así que el premio de ciudad no aplica.

---

## 1. Submitter type

**Pegar**

```
Individual
```

## 2. Organization name

**Pegar**

```
N/A
```

## 3. Submitter country of residence

Aparece en la galería del proyecto.

**Pegar**

```
Guatemala
```

## 4. Canadian province

**Pegar**

```
N/A
```

## 5. Track

**Pegar**

```
Best Apps and Agents Track
```

## 6. New or existing prior to August 26, 2026

**Selección:** Existing (el proyecto ya existía antes del 26 de agosto de 2026).

**Pegar** en el campo que pide cómo lo actualizaste con herramientas de Nebius:

```
Pitch Coach already existed before the submission period. The first commit is 18 August 2026, and through the pre-Nebius baseline the pitch was analyzed only with the Gemini API: one prompt string, a model-assigned score, and rubric point names invented by the model.

During the submission period the analysis path was rebuilt on Nebius Token Factory. NVIDIA Nemotron is now the default runtime, called from the Next.js server at https://api.tokenfactory.nebius.com/v1/chat/completions. Three sizes share one API key. Nemotron 3 Super (nvidia/nemotron-3-super-120b-a12b) scores every recording against a fixed five-point rubric. Nemotron 3 Ultra (nvidia/Nemotron-3-Ultra-550b-a55b) runs only when the user asks for Ultra analysis, with thinking left on and a 4–8 step trace. Nemotron 3 Nano (nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B) handles the fast calls: follow-up questions, search-query writing, and citation checks.

The same period changed the contract around the model. System and user messages are separate. The transcript is delimited as untrusted data. Nebius strict json_schema fixes the rubric length, and the server assigns point names and computes the score. The product also became bilingual (Spanish and English), replaced browser speech recognition with server-side transcription, and added an optional Ultra pass plus a short coaching loop on missed rubric points.

Tavily is part of that update and runs in production, not as a mock. When a rubric point fails, POST /api/enriquecer calls https://api.tavily.com/search and then https://api.tavily.com/extract. Nano accepts the suggestion only when the page contains a quoted figure that matches the pitch topic. The dashboard shows the figure, the source link, and a sentence the user can say aloud. Earlier manual tests had shown the first search hit was often a how-to article, the wrong language, or a real number from another industry, so the app discards those results instead of displaying them.
```

## 7. Public code repository

El remoto es `https://github.com/focampok/pitch-coach`, con licencia MIT en el repositorio. Hoy el repo está **privado**. Las reglas exigen un repositorio público con la licencia visible en la página. Hazlo público antes de enviar y pega esta URL.

**Pegar**

```
https://github.com/focampok/pitch-coach
```

## 8. Working demo

**Pegar**

```
https://pitch-coach-production-1c0c.up.railway.app
```

## 9. Which models, and why that size

**Pegar**

```
Three NVIDIA Nemotron 3 models on Nebius Token Factory, one size per job.

nvidia/nemotron-3-super-120b-a12b is the default analysis. Every recording needs one structured judgment: which of five rubric points were covered, a short verdict, and a clarity score. Super is large enough for that domain judgment and, with thinking disabled, returns inside the 20-second budget of the main request. A 550B-class model on every take would make practice feel slow and would spend the credits the fast path is meant to save.

nvidia/Nemotron-3-Ultra-550b-a55b (Nemotron 3 Ultra, 550B) is opt-in. The dashboard button "Ultra analysis" resends the same transcript with thinking left on and asks for a 4–8 step trace. The timeout for that call is 90 seconds. Ultra is reserved for the pass where extended reasoning is the feature, which matches the track guidance to reach for Ultra only when the task needs it.

nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B (Nemotron 3 Nano, 30B) is the fast tier. It writes the Tavily search query, checks that an extracted page really contains an on-topic quoted figure, drafts the sentence the user can speak, and runs the follow-up questions on missed rubric points. Those calls are short, schema-bound, and numerous (a failed pitch can trigger several of them). Nano keeps that loop responsive. Thinking is disabled on this tier as well.

No other NVIDIA model is on the request path. Gemini remains a manual contingency behind MODEL_PROVIDER and is not the default.
```

## 10. Output quality (1–10)

**Pegar**

```
8

What worked: strict json_schema on Token Factory. With the envelope { name, strict, schema }, additionalProperties false, and minItems equal to maxItems, Super returns a rubric array of the exact length the pitch type requires, as { cumplido, comentario } pairs. Point names stay on the server, so the model cannot rename a criterion. The same pattern holds in Spanish and English, because each language has its own system prompt and its own schema descriptions. Ultra, with thinking left on, adds a trace of four to eight steps that the dashboard can show next to the standard result. Nano follows a small closed schema for citation checking: it must return a quoted figure, a verbatim snippet, a year, and an explicit relevance flag.

What fell short: a model-written score was not stable enough to show a founder. On the previous Gemini path the same transcript could change number between runs at temperature 0.7. The score is now computed in the server from how many points passed plus a clarity value clamped to 0–20. Clarity is still a model judgment. Nano will quote a real number from the wrong industry unless the schema forces a relevance check against the pitch entities; a bare "is there a number?" check is not enough. Truncated answers (finish_reason length) still happen, and the adapter retries once with max_tokens doubled, up to 8192. An unwrapped json_schema returns HTTP 422, which is easy to ship by accident and hard to diagnose from the status alone.
```

## 11. Fine-tune, prompt engineering, or out of the box

**Pegar**

```
Prompt engineering on the hosted models. No fine-tune and no local weights.

Each call is a normal Token Factory chat completion. The system message carries the rubric instructions and the output language. The user message carries the pitch type, the time limit, and the transcript inside delimiters treated as untrusted data. response_format is json_schema with strict true. The schema fixes the array length and forbids extra properties. The model does not emit the numeric score or the rubric labels; the server maps items by index and computes the score.

Thinking is a per-call switch, not a trained behavior. Super and Nano send chat_template_kwargs { enable_thinking: false } so reasoning tokens stay at zero and the JSON still validates. Ultra omits that field so the trace is actually reasoned. Temperature stays at 0.7. The default max_tokens is 1024, with one truncation retry. Transient HTTP errors retry with backoff across the standard-tier fallback list. Ultra and Nano do not fall back to a different size, so a fast call cannot silently become an Ultra call.

The prompts were rewritten per language (Spanish and English) rather than translated after the fact. Schema field descriptions are part of the instruction, because that is where the model is told which language to write.
```

## 12. Comparison with other models

**Pegar**

```
The comparison is the same product before and after the migration, not a separate benchmark suite.

Before, every analysis went to Gemini (default gemini-2.0-flash) through generateContent. One prompt string mixed instructions and the transcript. The API key traveled in the query string. The model returned the score and the rubric point names. Validation accepted a short or shifted rubric and filled gaps with empty strings, so a bad completion could still reach the dashboard. There was one quality tier, so a citation check cost the same class of call as the full critique.

Nemotron on Token Factory is stricter at the contract. System and user are separate. Strict json_schema rejects a rubric of the wrong length instead of padding it. The key is an Authorization header. Three sizes sit behind one key, so the critique stays on Super, the optional deep pass goes to Ultra, and the Tavily query, the citation check, and the coaching questions stay on Nano. Ultra's step trace is something the single Flash tier did not return. Gemini is still in the repo as a manual switch for outages; day-to-day traffic uses Nemotron.

Where Gemini was easier: its schema dialect was already familiar, and a Flash call did not need a 90-second Ultra budget. Token Factory cost a debugging cycle on the json_schema wrapper (422 if name, strict, and schema are not nested) and on when to omit enable_thinking. I would not go back to a single hosted model for this app. The split across Super, Ultra, and Nano is the reason the citation loop is affordable.
```

## 13. Nebius platform capabilities

**Pegar**

```
The valuable capability was Token Factory's OpenAI-compatible inference API, not a GPU cluster I operated.

Pitch Coach is a Next.js app. The browser never sees the Nebius key. API routes on the server call POST https://api.tokenfactory.nebius.com/v1/chat/completions with Authorization: Bearer. The base URL is configurable and defaults to that host. There is no DevPod, no Serverless Endpoint, and no Serverless Job in this project, and no GPU instance type to name: inference is Nebius-hosted, and the app process only sends one completion at a time. The app itself is deployed on Railway so judges have a public URL. The Nemotron calls in that deployment go to Token Factory.

What that API made practical:

- One key and one endpoint for Super, Ultra, and Nano, chosen in code by a level flag (standard, ultra, fast) rather than by standing up three deployments.
- Strict structured output. response_format.type is json_schema, and json_schema must be { name, strict, schema }. That envelope is what keeps a five-point rubric at five items.
- A per-request thinking switch. chat_template_kwargs.enable_thinking false on Super and Nano holds latency to a 20-second client timeout. Omitting it on Ultra enables the reasoning trace, with a 90-second timeout.
- The same retry policy as the rest of the app: 408, 429, and 5xx back off; a truncated completion retries once with a higher max_tokens.

Tavily is separate from Nebius and is also a live server-side call. /api/enriquecer posts to https://api.tavily.com/search and https://api.tavily.com/extract, then asks Nano whether the extracted page contains a quoted, on-topic figure. Search results are not shown raw.

I did not use Nebius to train, to batch jobs, or to autoscale a model I host. The win was API access to three Nemotron sizes with structured output, from the same Node process that already served the coach.
```

## 14. Recommend Nemotron on Nebius (1–10)

**Pegar**

```
8

I would recommend it to a developer shipping an app that needs structured JSON and more than one model size, and who would rather call an API than run weights. Token Factory behaved as an OpenAI-compatible HTTPS endpoint: a fetch, a bearer token, and a model id were enough to leave Gemini's generateContent behind. Routing Super, Ultra, and Nano through that single endpoint is the part I would tell someone else to copy.

I would not score it a 10 yet. An unwrapped json_schema fails with 422, and the status alone does not say that name, strict, and schema are required. Turning thinking off depends on chat_template_kwargs, which is easy to miss; leaving it on for a short rubric call spends reasoning tokens the product never displays. Success logs in this app record the provider and the model id, not usage, so reasoning-token cost is still a surprise unless you capture the usage object yourself. Those are documentation and API-shape issues, not a reason to avoid the platform.
```

## 15. Experience versus previous environments (1–10)

**Pegar**

```
8

The previous environment for this same app was the Gemini API in the cloud, not a local GPU box. I have not run Nemotron weights on my own machine. The move was an adapter swap inside the Next.js server: from generateContent to Token Factory chat completions. Setup stayed an environment variable (NEBIUS_API_KEY) plus the model ids. No CUDA install, no instance type, no container dedicated to inference.

Compared with that earlier cloud API, Token Factory was the better fit once the request shape was right. Separate system and user roles, the bearer token, and strict json_schema removed failure modes the Gemini path allowed (a shifted rubric, a model-invented score, the key in the query string). Having Ultra and Nano on the same account meant the opt-in reasoning pass and the citation checks did not require a second vendor.

The rough edges were model-specific, not account or quota setup. The schema envelope and the thinking flag are extra fields a Gemini developer does not already know, and a wrong envelope fails the call. Ultra needs a much longer timeout than the Flash calls this app used to make, so it stays behind a button instead of on the default path. I kept the Gemini adapter as a manual fallback for that reason. As a hosted inference API it is a clear step up from the single-model setup I had; it is not a local-dev experience, because I never left the HTTP API.
```

## 16. What would have made Nemotron on Nebius more effective

**Pegar**

```
Seven changes, in the order they cost me time:

1. A 422 body that names the missing json_schema wrapper. The working shape is response_format.json_schema = { name, strict, schema }. A bare schema fails, and the status code does not point at those three fields.

2. One documented thinking switch for every Nemotron 3 size on Token Factory. enable_thinking false inside chat_template_kwargs works for Super and Nano. Ultra expects the field to be omitted. A single boolean, with the same meaning on all three ids, would have avoided that split.

3. Usage on every success response, including reasoning tokens, documented next to the model id. This app's success log only stores provider and model. Without usage, it is hard to tell whether a slow Ultra call was thinking tokens or queue time.

4. A short page of known-good strict-schema examples per size (Super, Ultra, Nano): exact array length, additionalProperties false, and a note on which sizes honor strict mode the same way.

5. Lower tail latency for Ultra, or streaming of the trace. The product hides Ultra behind a button because the client timeout is 90 seconds against 20 seconds for Super and Nano. A streamed trace would let the dashboard show progress instead of a spinner.

6. Multilingual notes for structured output. Spanish and English both work here, but only after the language was repeated in the system prompt and in the schema descriptions. A guide that says which of those two actually binds the output language would shorten that experiment.

7. Stronger quote-and-reject behavior on Nano. The fast tier validates web extracts. It must copy a figure verbatim and reject a real number from another industry. A tighter schema gets there; the model still accepts an off-topic figure if the relevance field is not mandatory. A small checkpoint aimed at "quote this span or refuse" would remove a lot of that schema weight.
```

## 17. What you hope to see from the Nemotron team next

**Pegar**

```
A size guide written for people who call Token Factory, not for people who pretrain. For Nano, Super, and Ultra, publish typical latency, how reliable strict json_schema is, and what to expect in Spanish and English structured output. This app's split (Super for the critique, Ultra for an optional trace, Nano for short checks) should be a documented pattern, with numbers, rather than something each team rediscovers.

Strict JSON that fails in words. When the object is truncated or the schema is wrong, the error should say which constraint broke. A 422 or a finish_reason of length, with no field-level reason, is how a rubric silently loses an item.

A small model that is good at quotation. The most common Nemotron call in this project, after the main critique, is Nano deciding whether a web page contains a figure the founder can cite. I want that model to copy a span or refuse, including refusing a true number about the wrong company. That is a product feature for Nemotron, not only a prompt trick.

Thinking as a documented request field. On, off, and "how many reasoning tokens came back" should be stable across Nemotron 3 sizes on Nebius. chat_template_kwargs was enough to ship, and it should not be the long-term contract.
```

## 18. Did you use Tavily?

**Selección:** Yes.

El desplegable no pide un párrafo. El argumento para el bono queda en las secciones 6, 9 y 13. Para calificar, el proyecto tiene que llamar a la API de Tavily en runtime. Aquí eso es `POST /api/enriquecer` → `https://api.tavily.com/search` y `https://api.tavily.com/extract`, con la clave solo en el servidor. Si la validación no encuentra una cifra citada y pertinente, la sugerencia no se muestra.

## 19. Builders & Brews city

No selecciones ninguna ciudad. No hubo evento en Guatemala, y las reglas limitan el premio de ciudad a quien asistió a una de las veinte sedes.

## 20. Declaraciones legales

Márcalas tú en el formulario solo si las dos son ciertas:

- Tú (y, si aplica, todo el equipo) tienes al menos la mayoría de edad donde vives.
- Tú (y, si aplica, todo el equipo) no son empleados, representantes ni agentes de las Promotion Entities de este hackathon (patrocinador, administrador o afiliados).

Guatemala no está en la lista de territorios excluidos de las reglas (Brasil, Quebec, Rusia, Crimea, Cuba, Irán, Corea del Norte y demás sanciones integrales de OFAC).

## 21. Antes de enviar

- Haz público `https://github.com/focampok/pitch-coach`. La licencia MIT ya está en el repo; tiene que verse en el About de GitHub.
- El README nombra Nebius Token Factory y Tavily. Las reglas piden además dejar claro el uso de NVIDIA Nemotron, dónde Token Factory aceleró el flujo y qué otros servicios de Nebius entraron. Hoy los ids de Super, Ultra y Nano no están en el README. Conviene un apartado corto antes de que un juez abra el repo.
- Video público en YouTube, de menos de 3 minutos, con el proyecto funcionando y con Token Factory y Nemotron visibles en el relato. No forma parte de esta ficha.
- No subas archivo en "Upload a File". El repo y la demo cubren el envío.
- La app en Railway llama a Token Factory en runtime. Eso cumple el requisito de "correr en Token Factory". No hace falta decir que el hosting es Nebius.
