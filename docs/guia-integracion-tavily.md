# Tavily integration guide (extracted from Pitch Coach)

How to reuse this repo's Tavily web-search logic in another project: API key, REST calls to `/search` and `/extract`, figure-oriented query building, a **mandatory validation step** so a source that does not carry the figure is never shown, and **silent degradation** so enrichment never breaks the main flow.

The official Tavily SDK is not required. Pitch Coach talks to the REST API at `api.tavily.com` with native `fetch`, always on the server.

---

## 0. Scope: what "Tavily logic" means here (and what it does not)

In Pitch Coach, Tavily does not feed the main analysis: it is **optional enrichment** (scope §12). When the AI analysis finds that a rubric point was missed *for lack of a concrete figure*, it searches the web for a real statistic/figure the user could cite to reinforce that point, and shows it as a suggestion with its source on the dashboard.

The same server call also asks for one public-room objection on the first missed point and checks one figure the speaker already said. The transcript is never sent to Tavily.

| Use | In this repo | Engine | Extract it? |
|---|---|---|---|
| Search for real figures for suggestions | Yes | Tavily `POST /search` | **Yes, this guide** |
| Check that the figure is in the source | Yes | Tavily `POST /extract` | **Yes, this guide** |
| Pitch analysis (what decides *what* was missing) | Yes | Gemini | No (see `guia-integracion-gemini.md`) |
| Speech transcription | Yes | MediaRecorder + ElevenLabs Scribe | Does not use Tavily |

Important point: Tavily **does not produce text**; it produces sources. The decision of *what* to search is made by another layer (in this repo, the missed points that Gemini returns). If your other project has no layer that tells you "what to reinforce", the piece you extract shrinks to the HTTP client in section 8.1.

And there is a second point, learned the hard way: **a high-score source is not a figure.** Tavily returning a relevant result does not guarantee that the result contains a citable figure. That is why Phase B adds Extract + validation before anything is shown (see §2.1).

---

## 1. What is reusable and what is not

| Piece | File in this repo | Copy as-is? |
|---|---|---|
| Tavily HTTP client (`buscarEnTavily`) | `src/lib/tavily.ts` | Yes, it is the core. Rename it if you want. |
| Best-effort enrichment logic (parallel + isolated) | `src/lib/tavily.ts` | Yes, it is the most valuable pattern. Adapt `query` and the contract to your domain. |
| API route that hides the key and degrades | `src/app/api/enriquecer/route.ts` | The pattern yes; validate the body against your contract. |
| Isolated fetch from the client | `src/components/DashboardResultado.tsx` | The pattern yes (an effect that does not block, and that tolerates `[]`). |
| Environment variable | `.env.example` | Yes (`TAVILY_API_KEY`). |
| Rubric points / what gets reinforced | types in `src/types/pitch.ts` | No. That is Pitch Coach domain. |
| Query text ("recent figure …") | `src/lib/query-tavily.ts` | The pattern yes; the wording is your domain. |
| Source-content extraction | `src/lib/tavily-extract.ts` | Yes, it is the portable core of the check. |
| "Does it contain a figure?" validation | `src/lib/validar-sugerencia.ts` | Yes; change the schema to your idea of a "useful figure". |
| Spoken sentence that includes the figure | `src/lib/validar-sugerencia.ts` | The pattern yes; the TTS is yours. |

**Dependencies:** none extra. `package.json` does not include a Tavily SDK. `fetch`, TypeScript, and environment variables are enough.

---

## 2. Principles you should not break

1. **The API key lives only on the server.** It is read from `process.env.TAVILY_API_KEY`. Never `NEXT_PUBLIC_TAVILY_API_KEY`, and never a hardcode in the client.
2. **The browser never calls Tavily.** The frontend posts to your API route; the route calls Tavily with the key.
3. **Tavily is best-effort: it never breaks the main flow.** This is the philosophical difference from Gemini/ElevenLabs in this repo (those fail in the open with a **502**). Tavily is an *optional* dashboard section, so with no key, on failure, or on timeout, the route responds **200 with `sugerencias: []`** and the UI simply hides the section. That is not an error in your app: it is "no figure today".
4. **Isolate each search with its own `try/catch`.** They run in parallel with `Promise.all`, but if one query fails it must not take down the others or the whole response.
5. **Ask for little, and cheap.** `search_depth: "basic"`, `max_results: 6`, and `include_answer: false`. You do not need Tavily's LLM-written answer or a deep crawl: you want 1–6 real sources to link.
6. **Do not expose the raw text.** Tavily returns `content` (already truncated) and `raw_content` (the whole page, only if you ask for it). In this repo the extracted `content` is capped and is **never** sent to the client: the client only sees the validated figure, the trimmed quote, and the link.
7. **Extract is not enough: validate before you show.** On the chosen source, `POST /extract` runs and then a model call with a constrained schema that requires a concrete figure **quoted verbatim** and **relevant to the topic searched** (the pitch entities are passed as comparison context). If there is no plausible figure, or the figure is from another sector, the suggestion is discarded. That filter is what avoids showing "how to calculate the market" when the user asked for the market, and also "what market capitalization is" when the user asked for the market size of a tea salon.
8. **The diagnostic log carries no PII.** It records the final query and whether validation passed (and why not), never the transcript and never the extracted content. **The transcript is never sent to Tavily.**

In the Next.js App Router, `.env.local` feeds the server. On Railway (or another host), copy the same key into the variables panel.

### 2.1 Why the validation exists (real evidence, not a hypothesis)

Before Phase B, the suggestion was "first search result + trimmed `content`". In manual tests with **3 real pitches**, **every** result shown was useless. These are not hypotheses: this is what a real person was shown.

1. **"Traction" for a Mexican tea salon** → a blog in **English** about ERP integration (Microsoft/Odoo). Irrelevant, and in another language **despite `language: "es"`** (which is why Phase B also uses `filter_by_language`).
2. **"Market"** → a **FasterCapital** article on the **generic methodology** "how to calculate market size". Zero figures: it explained *how*, not *how much*.
3. **"Market" for a pitch about a gift-wrap paper cutter called "Little ELF"** → a **Quora** question on "how to calculate TAM/SAM/SOM". Zero figures.
4. Same pitch, **"Traction"** → a **real financial news item about "e.l.f. Beauty"** (cosmetics, ticker ELF). A name collision between the product "ELF" and an unrelated brand: a real figure, the wrong topic.
5. A **fourth pitch** returned no suggestion for 3 missed points, **with no visibility into why** (hence the diagnostic log in §6).
6. **"Market" for a Mexican tea salon** → a generic article on **"what stock-market capitalization is"**, with the range **"$2-10 mil millones"** (sample wording on that page for a mid-cap company). Extract and figure validation were already in place: the number and the quote existed, but they **had nothing to do with the sector**. The gap was that validation approved *any* figure, without checking that it belonged to the topic searched.

**None** of the results the user saw contained a citable figure with a source and a date. The lesson: searching better is not enough; you have to **verify the source's content before showing it**. Each piece of Phase B answers one of these cases:

| Case | Phase B response |
|---|---|
| Wrong language (1) | `language` + `filter_by_language: true` on the search |
| Methodology with no figure (2, 3) | `exclude_domains` + mandatory validation (no figure → discard) |
| Name collision (4) | an ambiguous entity never travels alone; validation requires the figure to cohere |
| Unexplained silence (5) | diagnostic log with the final query and the validation verdict |
| A real figure from another sector (6) | validation requires the `relevante` field: the figure must match the pitch entities, not merely exist |

**Scope decision:** validation is done with the model (`rapido` tier), not with regex heuristics. A regex for "is there a number?" accepts "TAM = SAM + SOM" and rejects the sample figure string "USD 320 millones"; the model, with the constrained schema, tells them apart better. It is an extra call per point, which is why the route's rate limit went down (see §5).

---

## 3. Environment variables

Copy this into the other project's `.env.example` (no real values) and into `.env.local` / the deploy host (with the value):

```bash
# Tavily key (web search). Server-side only. Never a NEXT_PUBLIC_ prefix.
# Without it, the suggestions feature simply does not appear (silent degradation).
TAVILY_API_KEY=
```

The API key is created in the [Tavily dashboard](https://app.tavily.com/) → *API Keys*. It is a `tvly-...` string.

---

## 4. HTTP contract with Tavily

```
POST https://api.tavily.com/search
Content-Type: application/json
Authorization: Bearer {TAVILY_API_KEY}     ← the form Tavily documents today
```

> **Authentication — known trap.** This repo's original code sends `api_key` **in the body** (`{ api_key: "tvly-…", query, … }`), a variant that was official for years and that still returns 200 on accounts like this project's. Current Tavily documentation only describes the `Authorization: Bearer` header and says explicitly that the key does not go in the body. If you see a **401** while porting, change a single header from `{ "api_key": key }` in the body to `Authorization: Bearer {key}` — the rest of the contract does not change. The generic code in section 8 already uses Bearer.

Body (the one in this project). The `query` string is a Spanish search query, left as the request sends it:

```json
{
  "query": "cifra reciente <entidades> <punto>",
  "search_depth": "basic",
  "max_results": 6,
  "include_answer": false,
  "language": "es",
  "filter_by_language": true,
  "topic": "general",
  "time_range": "year",
  "exclude_domains": ["fastercapital.com", "quora.com", "reddit.com", "medium.com", "translate.goog"]
}
```

- `query` — what you search for. This is the only required field. Here the model writes it (`rapido` tier) from the entities + the point, **without the negative comment** from the analysis (see §2.1).
- `search_depth` — `basic` (1 credit, enough for suggestions) vs `advanced` (2 credits). Do not raise it without a reason.
- `max_results` — `6` in this repo; the API default is 10 and the cap is 20. Several are requested so the best one can be **chosen** (see "How the result is chosen", below).
- `include_answer` — `false` in this repo. If you set it to `true`, Tavily writes an answer (with an LLM, more expensive). It is unused here because we want **linkable sources**, not generated text.
- `language` — the session language (`es` / `en`).
- `filter_by_language` — **this is the hard language filter.** `language` only **biases** the ranking; `filter_by_language: true` actually **filters** (it can return zero results). Without it, a pitch in Spanish receives sources in English (case 1 in §2.1).
- `topic` — `finance` if the pitch type is `capital`, `general` otherwise.
- `time_range: "year"` — recency of the figure: the search looks for a figure from the last year, not a classic from 2015.
- `exclude_domains` — a **hard exclusion** (max 150 domains) of the sites that returned methodology with no figures in the manual tests (`fastercapital.com`, `quora.com`, plus aggregators such as `reddit.com`, `medium.com`, and so on) **and of automatic-translation proxies** (`translate.goog` from Google, `microsofttranslator.com`, `translator.microsoft.com`, `bing.com`). Proxies are a back door to the language problem that `filter_by_language` already closed: they serve the same page in another language with the domain wrapped, so a filter on the real content's domain does not see them. Defined in `DOMINIOS_EXCLUIDOS` (`src/lib/tavily.ts`).

Parameters that are useful when porting:

| Parameter | What it does | When to use it |
|---|---|---|
| `language` + `filter_by_language` | `language` biases, `filter_by_language` filters | Almost always together if your audience is monolingual |
| `country` | **Only biases** toward a country; it does not filter | As a soft preference, never as a guarantee |
| `topic: "news"` | Restricts to recent news | If you are looking for figures / current events |
| `time_range` | Recency (`day` / `week` / `month` / `year`) | Statistics that change quickly |
| `include_domains` / `exclude_domains` | Allows (soft, unless you set a hard filter like `filter_by_language`) / blocks (hard) | Avoid sources already known to carry no figures |
| `include_raw_content: true` | Brings the full page text | Almost never: `/extract` exists for that, and it also lets you ask for `query` and `chunks_per_source` |

### 4.1 Extract: verify the source's content

`POST https://api.tavily.com/extract` (same `Authorization: Bearer` header) receives the URLs and returns the page text. The `query` below is a Spanish search query, left as the request sends it:

```json
{
  "urls": ["https://fuente.example/informe"],
  "query": "cifra reciente mercado solar",
  "chunks_per_source": 3,
  "extract_depth": "basic",
  "format": "markdown"
}
```

- `query` (optional but recommended) — reorders the returned chunks by relevance to what you are looking for, so the figure shows up at the top.
- `chunks_per_source` — how many chunks per URL (1–5).
- `format: "markdown"` — the text arrives with headings and lists, easier to quote.
- `extract_depth` — `basic` (1 credit) vs `advanced` (2, for difficult pages). Here, `basic`.
- `timeout` — seconds Tavily waits for the page (here `10`), on top of the client's `AbortSignal.timeout(12 s)`. Two layers of defense so a slow page does not hang the analysis.

Watch the response: it has **two** traps:

- `raw_content` is the real page text. In this repo `results[0].raw_content` is read, trimmed to `MAX_CONTENIDO_EXTRAIDO` (6000 characters), and passed to the validator: **it never reaches the client**.
- **A 200 does not mean it extracted.** Each entry in `failed_results` is a URL that could not be extracted. Check **both** arrays, not only the HTTP status.

**How the result is chosen.** It used to take `results[0]` blindly. Now `elegirCandidatos` (in `src/lib/tavily.ts`) filters by `estaExcluido(url)` (domains in `DOMINIOS_EXCLUIDOS`), drops those with no URL, requires a minimum `score` (`SCORE_MINIMO`), and sorts by score descending; then **up to `MAX_CANDIDATOS`** are tried per point (if the chosen one fails validation, the next one is tried). A simple rule, documented and tested: it is not "the first one Tavily returned"; it is "the first one with a high enough score and a domain that is not excluded".

> **Cost note.** Extract does **not** replace Search's `content`: it goes deeper. Search gives a short excerpt that may not include the figure; Extract brings the section where the figure lives. That is why both run, and why the route's rate limit is lower (§5).

### What the response looks like

```jsonc
{
  "query": "…",
  "results": [
    {
      "title": "…",
      "url": "https://…",
      "content": "…",          // truncated excerpt of the page
      "score": 0.982           // relevance 0–1
    }
  ]
  // "answer" appears only if you asked for include_answer: true
}
```

The code reads `data.results`, filters them by excluded domain, sorts them by `score`, and does **not** keep `results[0]` blindly: it tries up to `MAX_CANDIDATOS` per point and uses only the one that passes validation. Also, Search's `content` is only an excerpt: the figure is usually further down, on the full page — that is what `/extract` on the chosen URL is for (§4.1).

### Typical Tavily error codes

| HTTP | Meaning |
|---|---|
| 400 | Malformed body or invalid parameter |
| 401 | Invalid or missing key (see the auth callout above) |
| 429 | Plan rate limit / quota |
| 5xx | Service outage |

**This matters:** because Tavily is best-effort, in this repo **no** status is propagated to the user. Any failure is recorded with `console.warn`/`console.error` and the client receives `sugerencias: []`. The symptom of a broken key is silent for the user (the section does not appear) and visible only in the server logs.

---

## 5. The API route (Next.js App Router)

The frontend **never imports** the Tavily client. It `POST`s to the route; the route reads the key and calls Tavily. `runtime = "nodejs"` (needed for `process.env` and server-side fetch).

Route contract (the one in this repo):

```
POST /api/enriquecer
body: { tema: string, puntosSinCumplir: { punto: string, comentario?: string }[] }
      (only the first 2 points, in RUBRIC ORDER, run the full pipeline)
→ 200 { sugerencias: [{ punto, query, cifra, cita, fecha, titulo, url, frase }] }
→ 400 { error }   only if the body is not valid JSON
→ 429 { error }   per-IP rate limit (5 req / 10 min, in memory) + Retry-After
```

The same `POST /api/enriquecer` call also asks for one public-room objection on the first missed point and checks one figure the speaker already said. The transcript is never sent to Tavily.

The only case where this route is not best-effort: the **429**, which is decided before calling Tavily and protects your quota. It is in memory, so the effective limit multiplies by the number of instances.

This route's ceiling is **half the global one** (5 against 10 per 10-minute window). That is not arbitrary: each invocation fires a **full chain per missed point** — 1 model query (`rapido`), 1 Tavily search (1 credit), up to 2 `extract` calls (1 credit each), and 1 validation (`rapido`) — plus 1 entity extraction and 1 sentence (`rapido`) if something passed. That 5 is not multiplied by every point: the full pipeline stops at the **first 2 rubric points** of the type (`MAX_PUNTOS_ENRIQUECIDOS`), chosen in the order they appear; the remaining missed points **generate no external call**. The real ceiling per invocation is 1 + 2 × 6 = **~13 external calls**, not ~31. That is why the global ceiling of 10 is not enough: the worst case per IP and window would empty Tavily's free tier (~1000 credits/month) in hours. If you take this feature to another repo, adjust the number to your budget, but do not leave it on the global ceiling without looking at the cost per invocation.

Details worth copying (this is where the "optional" philosophy shows):

- **400 only for invalid JSON.** Business validation is not a 400: if `tema` is missing or there are no `puntosSinCumplir`, it responds **200 with `[]`** because there is simply nothing to enrich.
- **No key → 200 with `[]`**, not 502. Tavily is not in the critical loop; its absence is not a failure of your app.
- **Any internal failure → 200 with `[]`** + `console.error`. The dashboard never breaks because of this.
- The request body maps 1:1 onto what `enriquecerConTavily` expects (or the generic version in section 8).

---

## 6. Use from the client (where to find the pattern)

The UI part is the least portable (it belongs to the Pitch Coach dashboard), but the fetch pattern is worth keeping:

- It fires in a one-shot `useEffect`, **without blocking** the render of the rest of the dashboard.
- It has a `cancelado` flag so it does not `setState` after unmount.
- The response is handled with `res.ok ? res.json() : { sugerencias: [] }` — it never assumes the route returned something.
- Conditional render: `sugerencias.length === 0` shows "No verified suggestions for now." and not the section; each suggestion renders as `punto` + `cifra` + `fecha` + `cita` + a "Source" link (`target="_blank" rel="noreferrer"`), and a **"Listen to the figure"** button that sends the `frase` through the session's same TTS API (`ReproductorVeredicto`, no autoplay).

---

## 7. How to port it to another project (steps)

### Step 1 — Variables

Create `.env.local` (gitignored) and `.env.example` (committable) with the key from section 3. Get the key in the [Tavily dashboard](https://app.tavily.com/).

### Step 2 — Generic client

Copy the block from section 8.1. Change the `SugerenciaFuente` type, the text you use to build the `query`, and which field you use as the "key" (here it was a rubric point; in your product it might be a missing section, an unsupported claim, and so on). Leave these alone: env reading, headers, `!res.ok` handling, and the **Extract → validation → sentence** pattern (that is what avoids showing sources that lack the figure).

### Step 2 bis — Verification (Extract + validation)

Copy the block from section 8.1 bis. Change the validation schema to your idea of a "useful figure" (here: a concrete figure quoted verbatim). If you are not going to use a model to validate, at least require a deterministic check before showing the source: the most expensive mistake is presenting as a "figure" a page that only explains methodology.

### Step 3 — API route

Copy the block from section 8.2. Change the body field names if your contract uses others. Keep the philosophy: **this route must never 502** if Tavily fails; it responds `[]`.

### Step 4 — Client

Do the `fetch` from an effect/action that does not block your render and that tolerates `[]` in the response (or a `catch` that treats it the same way).

### Step 5 — Test it without the UI

The request bodies below are unchanged. Each `query` is a Spanish search query, not pitch speech.

```bash
# from the server (or curl directly with the key set in the environment)
curl -sS -X POST "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"cifra reciente mercado LATAM 2026","search_depth":"basic","max_results":6,"language":"es","filter_by_language":true,"time_range":"year"}'

# and extract on the chosen URL
curl -sS -X POST "https://api.tavily.com/extract" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://fuente.example/informe"],"query":"cifra reciente mercado LATAM","chunks_per_source":3,"format":"markdown"}'
```

If you see a `results` array with `url` and `content`, the contract is right. Then try with `$TAVILY_API_KEY=` empty (or an invalid value) and confirm that your route responds `{ "sugerencias": [] }` and that your UI does not crash.

---

## 8. Generic code to copy

### 8.1 Server client (`src/lib/tavily.ts`, adapted)

Uses `Authorization: Bearer` (see the callout in section 4). `buscarEnTavily` is the 100% portable core; `sugerirFuentes` is the "parallel + isolated" pattern with your domain's query and **validates before showing**.

```ts
export interface SugerenciaFuente {
  /** What you wanted to reinforce (your "key": point, section, claim…). */
  clave: string;
  query: string;
  /** The concrete figure, quoted verbatim from the source. */
  cifra: string;
  cita: string;
  fecha: string;
  titulo: string;
  url: string;
  /** Sentence ready to say aloud, with the figure and the source. */
  frase: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/** Domains that in practice return methodology with no figures. */
const DOMINIOS_EXCLUIDOS = ["fastercapital.com", "quora.com", "reddit.com"];

/** Searches Tavily and returns the results already ordered by relevance.
 *  Throws if there is no key or the API responds badly — the caller decides
 *  whether that matters (in this pattern: no, it is best-effort). */
export async function buscarEnTavily(
  query: string,
  opts: { maxResults?: number; idioma?: "es" | "en" } = {}
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY no configurada");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: opts.maxResults ?? 6,
      include_answer: false,
      language: opts.idioma ?? "es",
      // Hard language filter: `language` only biases the ranking.
      filter_by_language: true,
      time_range: "year",
      exclude_domains: DOMINIOS_EXCLUIDOS,
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(
      `Tavily respondió ${res.status}${detalle ? `: ${detalle.slice(0, 200)}` : ""}`
    );
  }

  const data = (await res.json()) as { results?: TavilyResult[] };
  return data.results ?? [];
}

/** Fetches the chosen source's content, prioritizing the chunks
 *  relevant to what you are looking for. `/search` only returns an excerpt;
 *  the figure is usually further down. */
export async function extraerContenido(
  url: string,
  query: string
): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls: [url],
      query,
      chunks_per_source: 3,
      extract_depth: "basic",
      format: "markdown",
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { raw_content?: string }[] };
  return data.results?.[0]?.raw_content ?? null;
}

/** Selection rule: drop excluded domains, require a minimum score,
 *  and sort by score. It is not a blind `results[0]`. */
export function elegirCandidatos(
  resultados: readonly TavilyResult[],
  scoreMinimo = 0.35,
  max = 2
): TavilyResult[] {
  const utiles = resultados.filter(
    (r) => r.url && !DOMINIOS_EXCLUIDOS.some((d) => r.url.includes(d))
  );
  const ordenados = (utiles.length > 0 ? utiles : [...resultados]).sort(
    (a, b) => b.score - a.score
  );
  return ordenados.filter((r) => r.score >= scoreMinimo).slice(0, max);
}

/** For each "gap" (something your analysis failed to back up), build a
 *  query, pick a source, verify its content, and only then suggest.
 *  Best-effort: if something fails for one gap, that gap brings no
 *  suggestion — it does not take down the rest. */
export async function sugerirFuentes(
  brechas: { clave: string; detalle?: string }[],
  tema: string
): Promise<SugerenciaFuente[]> {
  const sugerencias: SugerenciaFuente[] = [];

  await Promise.all(
    brechas.map(async ({ clave }) => {
      // Without the analysis's negative comment: ask for the figure, not the gap.
      const query = `cifra reciente ${tema} ${clave}`.trim();
      try {
        const candidatos = elegirCandidatos(await buscarEnTavily(query));

        for (const candidato of candidatos) {
          const contenido = await extraerContenido(candidato.url, query);
          if (!contenido) continue;

          // Mandatory check: does it contain a citable figure AND one relevant
          // to the topic? The topic and the key are comparison context; a
          // real figure from another sector must be rejected.
          const validacion = await validarConModelo(contenido, [tema, clave]); // "rapido" tier
          if (!validacion.util) continue;

          sugerencias.push({
            clave,
            query,
            cifra: validacion.cifra,
            cita: validacion.cita,
            fecha: validacion.anio,
            titulo: candidato.title,
            url: candidato.url,
            frase: await generarFrase({ clave, ...validacion }), // "rapido" tier
          });
          break;
        }
      } catch (err) {
        console.warn(`[tavily] sin fuente para "${clave}":`, err);
      }
    })
  );

  return sugerencias;
}
```

`validarConModelo` is a model call with a **constrained schema** (`additionalProperties: false`) that returns `{ util, relevante, cifra, cita, anio }`: `util` is `true` only if `cifra` and `cita` come back non-empty **and** `relevante` is `true` (the model confirms that the figure matches the pitch entities). `relevante` is required: if it is missing, it is treated as `false`. If the model fails, it is treated as `util: false` (degradation, not an exception). `generarFrase` produces the spoken sentence; if the model fails, there is a **deterministic fallback sentence** built from the figure and the source. The schema detail is in `src/lib/validar-sugerencia.ts`.

If you prefer to keep the repo's original shape (key in the body), change only the headers:

```ts
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ api_key: apiKey, query, /* …rest unchanged… */ }),
```

### 8.2 Generic API route (Next.js App Router)

```ts
import { NextRequest, NextResponse } from "next/server";
import { sugerirFuentes } from "@/lib/tavily";

export const runtime = "nodejs";

/**
 * POST /api/enriquecer
 * body: { tema: string, brechas: { clave: string, detalle?: string }[] }
 *
 * Optional, best-effort feature: it must never break the UI of whoever consumes it.
 * Without TAVILY_API_KEY, without a topic, without gaps, or if Tavily fails → 200 { sugerencias: [] }.
 */
export async function POST(req: NextRequest) {
  let body: {
    tema?: string;
    brechas?: { clave: string; detalle?: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tema = body.tema?.trim();
  const brechas = body.brechas ?? [];

  if (!tema || brechas.length === 0) {
    return NextResponse.json({ sugerencias: [] });
  }

  if (!process.env.TAVILY_API_KEY) {
    // Silent degradation: Tavily is optional.
    return NextResponse.json({ sugerencias: [] });
  }

  try {
    const sugerencias = await sugerirFuentes(brechas, tema);
    return NextResponse.json({ sugerencias });
  } catch (err) {
    console.error("[/api/enriquecer] fallo Tavily:", err);
    // Not critical: 200 with an empty list instead of breaking the consumer.
    return NextResponse.json({ sugerencias: [] });
  }
}
```

### 8.3 Fetch from the client (pattern, not a component)

```ts
// Tolerant: any failure is treated as "no suggestions".
const res = await fetch("/api/enriquecer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tema, brechas }),
});
const data = (await res.json().catch(() => ({ sugerencias: [] }))) as {
  sugerencias?: SugerenciaFuente[];
};
const sugerencias = res.ok ? data.sugerencias ?? [] : [];
```

---

## 9. Flow in Pitch Coach (where to find the code)

```
DashboardResultado.tsx
  useEffect (once, does not block render, cancelado flag)
  POST /api/enriquecer { tema: tipoPitch, puntosSinCumplir }
        │  if 200 → data.sugerencias ?? []   if !ok → []
        ▼
route.ts (/api/enriquecer)
  invalid JSON → 400
  no topic / no points → 200 { sugerencias: [] }
  no TAVILY_API_KEY → 200 { sugerencias: [] }   ← optional, not 502
  enriquecerConTavily(...)  → 200 { sugerencias }
        │
        ▼
tavily.ts  (TAVILY_API_KEY only here)
  1) entidades-tavily.ts: extracts ≤3 short entities ("rapido" tier)
  2) elegirPuntosAEnriquecer: only the first 2 rubric points
     of the type, in their order (the rest generate no calls)
  3) for each chosen point (in parallel, each with its own try/catch):
       query-tavily.ts   → figure-oriented query ("rapido" tier),
                           WITHOUT the negative comment; an ambiguous entity
                           never travels alone; deterministic fallback
       buscarEnTavily    → /search (language + filter_by_language,
                           exclude_domains, topic, time_range=year)
       elegirCandidatos  → filters/sorts by score (not a blind results[0])
       tavily-extract.ts → /extract on the candidate
       validar-sugerencia.ts → mandatory validation ("rapido" tier)
                           does it contain a citable figure AND one relevant to the topic?
                           (receives the pitch entities as context)
                           if not → discard
       generarFraseHablada   → 8–12 s sentence ("rapido" tier)
       diarioPunto       → console.info: final query + passed/reason
                           (NEVER the transcript or the extracted content)
        │
        ▼
DashboardResultado → section "Figures that could reinforce your pitch"
  render: punto + cifra + fecha + cita + <a href={url}>Source</a>
          + "Listen to the figure" (the session's same TTS voice)
```

The same server call also asks for one public-room objection on the first missed point and checks one figure the speaker already said. The transcript is never sent to Tavily.

What does **not** go through Tavily in this project: detecting *what* is missing (Gemini, see `guia-integracion-gemini.md`) and filler words (local regex). Tavily only comes in at the end to look for a citable backing. If your product has an analysis layer that tells you what to reinforce, this pattern fits the same way: call your analysis first and pass the route only the detected "gaps".

---

## 10. Checklist for taking it to another repo

- [ ] `.env.local` with `TAVILY_API_KEY` (not committed).
- [ ] `.env.example` with `TAVILY_API_KEY=` empty and a comment that it is server-side.
- [ ] Tavily client imported **only** from API routes / server actions / server components.
- [ ] Auth checked: if you send the key in the body and get a 401, switch to `Authorization: Bearer` (a single header).
- [ ] Route with `runtime = "nodejs"`.
- [ ] No key / Tavily failure → `200 { sugerencias: [] }`, never a 502 or a crash.
- [ ] Each search isolated in its own `try/catch` (one failure does not drop the batch).
- [ ] `search_depth: "basic"` and a `max_results` high enough to choose (does 6 work?).
- [ ] `include_answer: false` unless you want the LLM-written answer.
- [ ] `language` + `filter_by_language` together if you need the language for real (with `language` alone, sources arrive in another language).
- [ ] `exclude_domains` with the domains that already gave you methodology and no figures.
- [ ] Result chosen by score/domain, not a blind `results[0]`.
- [ ] `POST /extract` on the chosen source and **mandatory validation** before showing (no quoted figure **or a figure unrelated to the topic** → discard; pass the pitch entities as context).
- [ ] Validation also confirms **relevance** (the figure belongs to the topic/sector, not merely "there is a number").
- [ ] Extracted `content` is **not** sent to the client; only the figure, the trimmed quote, and the link.
- [ ] A spoken sentence that can be replayed with your session TTS (or a deterministic fallback).
- [ ] Diagnostic log (query + verdict) with no transcript and no extracted content. The transcript is never sent to Tavily.
- [ ] The client tolerates `[]` and does not block the main render.
- [ ] Nothing with a `NEXT_PUBLIC_` prefix for the key.

---

## 11. Quick reference

| Concept | Value in this repo |
|---|---|
| SDK | None (`fetch` + REST) |
| Base URL | `https://api.tavily.com` |
| Methods | `POST /search` and `POST /extract` |
| Auth | Repo: key in the body. **Today**: `Authorization: Bearer` |
| `search_depth` | `basic` |
| `max_results` | `6` |
| `include_answer` | `false` |
| Language | `language` (session) + `filter_by_language: true` |
| All results | `elegirCandidatos`: domain not excluded + `score ≥ SCORE_MINIMO`, sorted, up to `MAX_CANDIDATOS` |
| `exclude_domains` | `DOMINIOS_EXCLUIDOS` (FasterCapital, Quora, Reddit, aggregators…, translation proxies such as `translate.goog`) |
| Extract | `/extract` with `query` + `chunks_per_source: 3`, `format: "markdown"` |
| Validation | mandatory, `rapido` tier, constrained schema `{ util, relevante, cifra, cita, anio }`; no quoted figure **or no confirmed relevance** → discard |
| Spoken sentence | `rapido` tier, 8–12 s, with a deterministic fallback |
| Suggestion shape | `{ punto, query, cifra, cita, fecha, titulo, url, frase }` |
| Diagnostics | `console.info` with query + verdict; never the transcript or the content |
| Point ceiling | `MAX_PUNTOS_ENRIQUECIDOS` = 2 (rubric order); the rest make no call |
| Isolation | `Promise.all` + `try/catch` per point |
| No key / failure | `200 { sugerencias: [] }` (silent degradation) |
| Invalid JSON only | `400` |
| Privacy | The transcript is never sent to Tavily |
| Same call | One public-room objection on the first missed point, and one check of a figure the speaker already said |

Source of truth for the client: [`src/lib/tavily.ts`](../src/lib/tavily.ts), [`src/lib/query-tavily.ts`](../src/lib/query-tavily.ts), [`src/lib/tavily-extract.ts`](../src/lib/tavily-extract.ts), [`src/lib/validar-sugerencia.ts`](../src/lib/validar-sugerencia.ts), and [`src/app/api/enriquecer/route.ts`](../src/app/api/enriquecer/route.ts).
