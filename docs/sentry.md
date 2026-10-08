# Sentry in Pitch Coach — record of what was done

> **2026-09-27** (updated with the repo on `main`). Decision document: what
> was integrated, why, what is verified, and what is not. Operational summary in
> `docs/status.md` §5; the detail and the reason for each decision are here.

---

## 1. Goal

Error monitoring on server and client, with the same privacy guarantee
already applied to the local history: **the user's text does not leave the
process**.

The app handles the pitch transcript and the rubric content. Sentry
is a third party. The rule that orders the whole design is that none of that arrives
there, even if it costs functionality.

---

## 2. What was integrated

| Runtime | File | Contents |
|---|---|---|
| Node | `src/sentry.server.config.ts` | API routes, Server Components, Server Actions |
| Edge | `src/sentry.edge.config.ts` | middleware and edge handlers |
| Browser | `src/instrumentation-client.ts` | client bundle |
| Registration | `src/instrumentation.ts` | loads the config according to `NEXT_RUNTIME` |

Version: `@sentry/nextjs@11.0.0` on Next 16.3.1 with Turbopack. It uses the
Next 16 pattern (`instrumentation-client.ts`) and not `sentry.client.config.ts`,
which is the name from earlier versions.

**Session Replay is not installed.** It records DOM interactions — including
typed and read text — which is exactly the kind of capture this project
does not want.

### Shared options

`src/lib/sentry-options.ts` centralizes what the three configs share:
environment, master switch, sampling, and `tracePropagationTargets`. It lives in
`src/lib/` so it can be tested with Vitest, like the rest of the logic.

Trace propagation targets (the two production domains):

```
https://pitch-coach.focampo.com
https://pitch-coach-production-1c0c.up.railway.app
```

Sampling: 100% in development, 10% in production.

---

## 3. Privacy — the part that matters

### 3.1 Centralized filter

`src/lib/sentry-scrub.ts`. Pure function, testable, applied as `beforeSend` and
`beforeSendTransaction` in the three configs. It recursively redacts every
property whose **name** is in this list, regardless of depth or whether
it hangs off an array:

```
transcripcion, comentario, traza, pregunta, respuesta,
veredicto, veredicto_corto, audio
```

It covers the real shapes of the domain because sensitive content always hangs
off one of those keys: `rubrica` is an array of objects with `comentario`, and
`turnos` is an array of objects with `pregunta`, `respuesta`, and `comentario`.

It is applied to `request.data`, `request.headers`, `extra`, `contexts`, `user`, and
`breadcrumbs`. Of the breadcrumbs, **console ones are dropped entirely** (§3.7).

### 3.2 Sanitizing the provider error

The filter does **not** cover this, and it is the most important finding of the work.

`src/lib/proveedor-nebius.ts` builds the error message by appending the provider's
raw response body:

```ts
detalle = await respuesta.text();
throw new ErrorModelo(
  `El modelo ${args.modelo} respondió con error ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
  respuesta.status,
);
```

That body, on validation errors, usually repeats the request — and the request
contains the transcript. The filter decides by property **name** and does not look
inside a string, so `captureException(error)` would have sent the pitch to
Sentry in the issue title.

Solution: `src/lib/sentry-reporte.ts` **never sends the raw error**. It builds
a summary (error type, HTTP code, provider, tier) and keeps the stack
while discarding its first line, which is the one that carries the original message. The
full detail still goes to the console logs.

### 3.3 What does NOT reach Sentry

- The pitch transcript.
- The `comentario` field of any rubric (main, Ultra, or a
  "Resolve findings" turn).
- The `traza` field of the Ultra analysis.
- The `pregunta` and the `respuesta` of a findings turn.
- The `veredicto` and the `veredicto_corto`.
- Audio in any form.
- The raw `ErrorModelo` message.
- The **client IP**, through the four channels it used to arrive on (§3.6).
- The **console breadcrumbs**, and with them the raw provider detail they
  carried (§3.7).

### 3.4 Known limit, stated plainly

The filter decides by **name**, not by content. Sensitive text that travels
as the **value** of a property with an allowed name is not detected. That is why:

- The routes never attach user text as context.
- The provider error is summarized instead of being forwarded.
- Console breadcrumbs, which are free text by construction, are dropped
  (§3.7) — that was exactly the hole the pitch leaked through once.

There is a test that pins this limit on purpose
(`test/sentry-reporte.test.ts`, "LÍMITE CONOCIDO"), so nobody assumes
coverage that does not exist. If a new `extra` is added on some route, it has to
be checked against this section.

**The limit is still alive for the rest of the breadcrumbs.** A `fetch`
breadcrumb whose `data` carried user text in a string would still go
undetected. It does not happen today — `http`/`fetch` ones carry method, url, and status
(verified in the envelope) — but the rule does not prevent it.

### 3.5 Other privacy decisions

- **`includeLocalVariables` is not active.** Local variables in the stack
  frames of the analysis pipeline contain the pitch text.
- **The client IP is NOT reported** (since the commit `fix(sentry): stop
  reporting client IP to align with anonymous-session design`). The app is an
  anonymous session: with no accounts, the IP was the only client identifier that
  could slip in, and it is not wanted. How it is turned off is in §3.6.
- **`dataCollection` IS defined** (`userInfo: false` + denial of IP
  headers). See §3.6: leaving it absent was NOT conservative.
- **`traceLifecycle` is `"static"`, explicit.** Without that, `beforeSendTransaction`
  does not run and the "transaction" half of the filter is dead code. See §3.8.

### 3.6 The client IP: why it was leaving and how it is turned off

**Correction of a previous assumption.** This document claimed that omitting
`dataCollection` kept the behavior of `sendDefaultPii: false` and that
passing the object — even `{}` — turned on permissive categories. Both
things are false in `@sentry/nextjs@11.0.0`, and that was checked by reading the SDK:

- `sendDefaultPii` **does not exist** in v11: it does not appear in the code of
  `@sentry/core`, `@sentry/node`, or `@sentry/nextjs`. It protects nothing.
- The `dataCollection` defaults are **permissive** and depend on nothing:
  `resolveDataCollectionOptions` sets `userInfo: true`, `cookies: true`,
  `httpHeaders.request/response: true`, the four `httpBodies`, and `genAI`.
  Omitting the option is equivalent to `dataCollection: {}`: each field resolves
  as `dc.field ?? DEFAULTS.field`, so passing a partial object does not "turn on"
  anything new. (That the `genAI` default is permissive does not mean it captures
  anything here: without an AI SDK there is nothing to read it. See §3.6.2.)

**The IP left through four channels**, not one. Verified with a local DSN that
captures the real envelope (without sending anything to Sentry):

| # | Channel | Where |
|---|---|---|
| 1 | `event.user.ip_address` | error event |
| 2 | `event.request.headers["x-forwarded-for"]` | error event |
| 3 | `items[].attributes["user.ip_address"]` | span envelope |
| 4 | `items[].attributes["http.request.header.x-forwarded-for"]` | span envelope |

**Why TWO pieces are required** (and one is not enough):

1. `dataCollection.userInfo: false`. `RequestData.extractNormalizedRequestData`
   does two things when `include.ip` is false — and `include.ip` comes from
   `userInfo` —: it does not set `user.ip_address` and it **deletes** from `request.headers` every
   header on its IP list. That closes 1, 2, and 3.
2. `httpHeaders.request.deny` with the IP header list. Point 1 **is not
   enough for 4**: the `http.request.header.*` attributes are built by
   `httpHeadersToSpanAttributes`, which filters by
   `dataCollection.httpHeaders.request` and does not look at `include.ip`. With `deny`, the
   attribute value becomes `"[Filtered]"`.

> **Why the §3.1 filter was not enough.** Span envelopes are exported WITHOUT
> passing through `beforeSend`, so `src/lib/sentry-scrub.ts` does not see them. For
> them the only possible barrier is the collection one. That is why piece 1 is the
> important one and the header denial in `sentry-scrub.ts` is deliberate
> redundancy, not the main defense.

**Accepted side effect:** `deny` matches by substring, so
`x-forwarded-host`, `x-forwarded-port`, and `x-forwarded-proto` also become
`[Filtered]`. They do not carry the IP and they are lost as debugging data; that was accepted in
exchange for not letting a bare `X-Forwarded` header through, which can
carry it. `host` and `user-agent` stay intact.

**Decision still pending, not resolved here:** the switch turns off the IP, but the
other permissive defaults stay active. `httpBodies` **was already audited** (§3.6.1) and
`genAI` turned out **inert by construction** (§3.6.2); `cookies`,
`urlQueryParams`, and `httpHeaders.response` **are still unaudited** (§3.6.3).

### 3.6.1 `httpBodies` audit: no leak

**Question:** does `httpBodies` at its permissive default have a leak path that
skips `beforeSend`, the way the IP did in spans?

**Answer: no, and it is verifiable.** A real POST was made with the transcript
in the body to `/api/analizar-pitch` (the provider pointed at a local server
that returned an echo, so nobody else was called), and the envelopes were audited:

| Where the body could travel | What was found |
|---|---|
| `event.request.data` | **absent** — the SDK does not attach the incoming request body on these routes |
| `http.request.body.data` (span attribute) | **does not exist** |
| Span attributes of the outgoing call to the provider | only the name (`POST 127.0.0.1`); no body and no `authorization` header |
| `http` breadcrumb of the outgoing call | only `http.request.method`, `status_code`, `url` |
| Console breadcrumb | **this one did leave** — but it is not `httpBodies`: see §3.7 |

**Why there is no leak, and why that does not depend on luck.** The attribute
`http.request.body.data` is built by `addNormalizedRequestDataToSpan`
(`@sentry/core/.../integrations/requestdata.js`) from
`normalizedRequest.data` — the same object that feeds `event.request.data` —
and on these routes that field arrives empty: Next.js does not populate it for route handlers.
It is not that the filter redacts it: there is **nothing to redact**. That is why the
conclusion holds until the SDK starts populating `normalizedRequest.data`; if
it ever does, the body would enter as `http.request.body.data` on a
span attribute, which **does not pass through `beforeSend`** in stream mode. See §3.8.

### 3.6.2 `genAI`: inert by construction (verified)

**Question:** does `genAI` capture anything when raw `fetch` is used, as
`proveedor-nebius.ts` and `proveedor-gemini.ts` do?

**Answer: no. It only instruments recognized AI SDKs.** This project uses
none, so the category is inert and there is nothing to audit.

**How `genAI` hooks in** (read in the installed SDK, not inferred): the
provider integrations that read `dataCollection.genAI` instrument
**modules by package name, version range, exact file path, and
class/method**:

```
@google/genai          >=0.10.0 <3    dist/node/index.js      Models.generateContent
openai                 >=4.0.0 <8     resources/chat/completions/completions.js   Completions.create
groq-sdk               >=0.3.0 <2
@mistralai/mistralai   >=2.0.0 <3
```

**There is no matching by URL or by host anywhere.** Grep of
`api.openai.com`, `anthropic.com`, `generativelanguage`, `api.mistral`, and
similar across all of `@sentry/**`: **zero matches**. The configs of the
providers that do come registered by default have **zero** references to
URLs or hosts.

**The module that could have been the exception is not.**
`openAiCompatibleConfig` — and Nebius **is** OpenAI-compatible, so the doubt
was legitimate — does not match endpoints: it is a **factory parameterized by a module
descriptor** (`{ name, versionRange, filePath }`). There is no "compatible
endpoint" detection, and `openAICompatibleIntegration` is not on the default lists.

**Empirical confirmation, with the envelopes already captured.** The real call to the
provider through raw `fetch` was traced as `sentry.origin =
auto.http.node_fetch` / `sentry.op = http.client`, **with no
`gen_ai.*` attribute**. Across every captured envelope: **0 files** with `gen_ai.*` or
`auto.ai.*`. A detail that strengthens the case: the simulated provider had the path
`/fake-provider/chat/completions` — a path that *looks like* the OpenAI API — and even
so it triggered nothing.

**The project has no AI SDK installed.** Grep of `openai`,
`@google/genai`, `@google/generative-ai`, `@anthropic-ai/sdk`, `langchain`, `ai`,
`groq-sdk`, `@mistralai/mistralai`, `together-ai`: none present.
`dependencies` is exactly `@sentry/nextjs, next, react, react-dom`.

> **⚠️ Latent trap, for the future.** The AI integrations **are
> registered by default** — they are in `getTracingIntegrations()` of the Node
> runtime —; they are simply **no-ops while the vendor package does not exist**. If
> someone replaces the raw `fetch` in `src/lib/proveedor-nebius.ts` with the
> **official `openai` package** (plausible, because Nebius is compatible with that
> API), `genAI` turns on with its **permissive defaults** (`inputs: true`,
> `outputs: true`) and the prompt — which contains the pitch transcript — starts
> traveling to Sentry **without anyone touching the privacy configuration**. The
> §3.1 filter does not stop it: `genAI` records prompts and completions as
> span attributes, and spans do not pass through `beforeSend`. If that happens,
> set `dataCollection.genAI: { inputs: false, outputs: false }` **before**
> changing the provider.

### 3.6.3 What is still unaudited

`cookies`, `urlQueryParams`, and `httpHeaders.response` keep their permissive
defaults and **were not audited**. There is no evidence of a leak, and there is also no
evidence of the opposite: do not claim they are covered. What is known: the app does not use
`setContext`, `setExtra`, or `addBreadcrumb` in `src/`, and its URLs do not carry user
text in the query string (the pitch goes in the body of a POST).

### 3.7 Real leak through a console breadcrumb (reproduced and closed)

**This was a live hole, not a theoretical one.** Finding it is the most
important result of this phase after the IP.

**The chain:**
1. `src/lib/proveedor-nebius.ts` puts the provider's raw response body
   into the `ErrorModelo` message (§3.2).
2. Each route's `catch` does `console.error("[/api/…] fallo …", error)`.
3. The SDK's `Console` integration records that `console.error` as a breadcrumb
   `category: "console"` with the arguments serialized in `data.arguments` —
   **including the Error with its full `message` and `stack`**.
4. Breadcrumbs travel on the event. The §3.1 filter processes them, but
   it decides by property **name** and the pitch is **inside a string**.
5. Result: the transcript was reaching Sentry.

**Reproduction.** With a simulated provider that returned `400` and a body with
an echo of the request, the sentinel appeared in the envelope, exactly at:

```
breadcrumbs[4].data.arguments[1].message
breadcrumbs[4].data.arguments[1].stack
```

**Why `reportarFallo` was not enough.** It sanitizes the **exception** (§3.2), but
the breadcrumb is generated by the `console.error`, which is another path. And it is not fixed
by removing the log: the full detail in the console is deliberate; it is the maintainer's
debugging path.

**Fix applied:** `beforeSend` and `beforeSendTransaction` **drop** console
breadcrumbs (they do not redact them: their content is arbitrary, and there is no
stable property name to mark). The other breadcrumbs continue
with `scrub` — verified that an `http` breadcrumb survives with its method,
status, and url.

**Note on the alternative that was discarded.** `consoleIntegration` accepts a
pattern `filter`, but it drops the call **before** instrumenting it and
it also silences it from the real console (`if (!isFiltered || debug) log(...)`). That
would kill the local log, which is exactly what should be kept. The filter in
`beforeSend` cuts only the output toward the third party.

### 3.8 `traceLifecycle: "static"`: why the default is not used

With the SDK default (`"stream"`), **`beforeSendTransaction` does not run**.
The SDK says so in its types:

> `@deprecated` This option only has an effect if `traceLifecycle` is set to
> `'static'`. With span streaming (`traceLifecycle: 'stream'`, the default), the
> SDK ignores it. Use `beforeSendSpan` instead […]. `beforeSendTransaction` will
> be **removed in v12** of the SDK.
> — `@sentry/core/build/types/types/options.d.ts`

That is: the "transaction" half of the filter was dead code. It was set to
`traceLifecycle: "static"` — documented as the official way out — for a
concrete reason, not out of nostalgia for the old model: **transaction events carry
breadcrumbs**, and breadcrumbs can carry user text (§3.7). Moving to
`static` creates that surface; `beforeSendTransaction` is what filters it.

**What is lost, and why it does not matter here:**

| Benefit of `"stream"` | Why it does not apply |
|---|---|
| No cap of 1000 spans per trace | The measured traces have 1–40 spans (the home: 36 in the browser) |
| Less memory | The data is retained for the length of a request: a render or an API call |
| Partial data if the process dies | There are no long-running processes, queues, or cron |
| Faster visibility | Operational, not privacy |

**Verified, not assumed:** with `"static"` there is still the same number of
spans — the browser sends a `platform=javascript` transaction with 36 spans, and
the servers send `platform=node` transactions — and there is no longer any envelope
`application/vnd.sentry.items.span.v2+json`. Telemetry is not lost: the envelope
changes.

**Dated debt.** `beforeSendTransaction` is removed in v12 of the SDK. This
decision buys the filter today at the price of migrating to `beforeSendSpan` before
upgrading to v12. It is not urgent, but it is a date, and the migration should be
deliberate and not a side effect of an upgrade. See §9.7 and §10.

---

## 4. Environment variables

All optional: without `SENTRY_DSN` the app works the same and the SDK sends nothing.

| Variable | Default | Purpose |
|---|---|---|
| `SENTRY_DSN` | — | server and edge runtime |
| `NEXT_PUBLIC_SENTRY_DSN` | — | browser (same value; a DSN is a public ingest key) |
| `SENTRY_ENVIRONMENT` | `production` | environment tag |
| `SENTRY_ENABLED` | `true` | turn sending off without touching code |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | — | mirror for the browser |
| `NEXT_PUBLIC_SENTRY_ENABLED` | — | mirror for the browser |
| `SENTRY_AUTH_TOKEN` | — | **build-time**, source map upload |
| `SENTRY_ORG` / `SENTRY_PROJECT` | — | build-time, source map upload |

Details that are not obvious:

- **The `NEXT_PUBLIC_*` mirrors are necessary.** Next.js only replaces, in the
  client bundle, *static* references to `NEXT_PUBLIC_*`; the browser
  cannot read `SENTRY_ENVIRONMENT`. They were not in the original brief; they were
  added because without them the client does not report an environment.
- **The environment falls back to `NODE_ENV` before `production`.** Without that fallback,
  local development would be tagged as `production` and would mix with the
  real events.
- **`SENTRY_AUTH_TOKEN` goes in `.env.sentry-build-plugin`** locally (gitignored),
  not in `.env.local`. That file is created by hand and its absence is silent.

---

## 5. Capture

### Server — 5 routes

`analizar-pitch`, `sparring/pregunta`, `sparring/evaluar`, `tts`, `enriquecer`.
All five already had the pattern "generic message to the client, detail in the logs";
Sentry reporting was added. **No HTTP code and no
message the client sees was changed.**

### Client — error boundaries

`src/app/error.tsx` (new) and `src/app/global-error.tsx`.

Before this **there was no `error.tsx` at all**, so render errors
in `GrabadorVoz`, `DashboardResultado`, and `PanelProgreso` did not reach Sentry
at all: Next catches them to show the fallback UI and they never reach the
SDK's global handler. `global-error.tsx` only fires if the root layout fails.

Only the error is reported. Props and component state are not attached.

### Tags

On every server event: `proveedor` and `nivel`. Operational data, not private.

- `analizar-pitch` → `nebius`/`gemini` according to `MODEL_PROVIDER`, and the real `nivel`
  (`estandar`/`ultra`/`rapido`, with `estandar` by default).
- `sparring/pregunta` and `sparring/evaluar` → tier `rapido`.
- `tts` → `elevenlabs`; `enriquecer` → `tavily`. The real provider of
  each route is used, not the language model.

### Sentry: where the project is

- Organization `focampo`, project `pitch-coach`, **EU region** (`de.sentry.io`).
- DSN in `.env.local` (gitignored).

---

## 6. Source maps

Configured and **verified end to end**, not only "the build says OK".
`next.config.ts` uses `withSentryConfig` with `authToken`,
`widenClientFileUpload`, and `tunnelRoute: "/monitoring"`.

> **Note:** the original brief said not to configure this yet ("my decision").
> It was kept by a later explicit decision, because it was already working and
> verified. If it should come out of the merge, revert `next.config.ts`,
> the `ARG`s in the `Dockerfile`, and the associated variables in `.env.example`.

Empirical verification: in a production build, the same error showed this in
the local terminal (without source maps)

```
at t (.next/server/chunks/[root-of-the-server]__1kd39kw._.js:2:943)
```

and this in Sentry, from the same minified binary

```
../../../src/app/api/sentry-prod-test/route.ts:4:9 (GET)
    3 │ export async function GET() {
  → 4 │     throw new Error(
```

With the original comments and the correct line.

### Production: the build `ARG`s

**Verified on a real deploy** (issue `PITCH-COACH-5`, 2026-09-27): the stack
trace arrived with the original code (`../../../src/lib/modelo.ts:255`).

**How it is known that Railway passes the variables as build args** (the correct
evidence, which is not the previous paragraph's): artifacts that exist only at
build time reach the browser. Two independent proofs:

1. `NEXT_PUBLIC_SENTRY_DSN` appears **inlined** in the client chunks. Without
   the `ARG`, the reference stayed as a runtime read and there was no DSN.
2. The client release appears **injected as a literal** in the chunks
   (`release:"90fa3e5…"`).

> **Correction of an earlier line of reasoning in this document:** it had been written
> that the server `release` proved the `ARG` mechanism. **That was false.** The
> server gets its release at **runtime**, not at build: Railway injects
> `RAILWAY_GIT_COMMIT_SHA` into the container and `getSentryRelease()` reads it. That is why
> the server had a release from the first deploy, when the client had
> none.

Declared in the `builder` stage:

1. **`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE`** —
   for the source map upload. Without the token, the build warns *"No auth token
   provided. Will not upload source maps"* and production stack traces
   come out minified.
2. **`SENTRY_RELEASE` has to be passed explicitly** as
   `${{RAILWAY_GIT_COMMIT_SHA}}`. The `.dockerignore` excludes `.git`, so
   automatic detection by git SHA finds nothing and every event
   would fall into an unknown release. For the same reason, commits are not
   linked to the release in production (locally they are).
3. **`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENABLED`,
   `NEXT_PUBLIC_SENTRY_ENVIRONMENT`** — the browser mirrors. They were added
   after the hole described below was found.

#### The hole this closed (found in production)

On the first deploy, **the client reported nothing**: no `POST /monitoring` in
DevTools and no browser events. The cause, read in the deployed chunks:

```js
{ dsn: _.default.env.NEXT_PUBLIC_SENTRY_DSN, ... }
```

**With no DSN inlined.** Next.js replaces `process.env.NEXT_PUBLIC_*` with
its literal at build time, but **only if the value is present**; if it is not, it leaves
a read of an `env` object at runtime, which in the browser does not have the value.
Because `.dockerignore` excludes `.env.local` and the Dockerfile did not declare those
`ARG`s, the build never saw the variable.

Verified locally with a sentinel build: with `NEXT_PUBLIC_SENTRY_DSN`
defined at build time, the bundle contains the literal
(`dsn:"https://…@o1.ingest.de.sentry.io/1"`); without it, the runtime read.

> **Scope:** this affects **any** `NEXT_PUBLIC_*` the
> project adds. If a new one is added, it also has to be declared as an `ARG` or it will not
> reach the browser.

**Confirmed in production on 2026-09-27:** with the new variables and `ARG`s,
the client reports. Verified by two independent paths: `POST
/monitoring` visible in DevTools, and browser spans arriving at Sentry with
`environment: production`, `transaction: "/"`, and
`auto.pageload.nextjs.app_router_instrumentation`.

---

## 7. The branch commits

| Commit | What it does |
|---|---|
| `46a5e29` | Integration + shared options + environment schema |
| `c2b80eb` | Privacy filter + 32 tests |
| `05b8092` | Capture on the 5 server routes, with a sanitized summary |
| `6b42d9b` | Client error boundaries |
| `2a8148f` | Verification of the operational tags |
| `1816d3a` | Documentation in `docs/status.md` |
| `dc30f50` | **The client IP stops being reported** (§3.6) + verification of the filter on the real pipeline |
| `ff2d1d1` | Records the phase verification: the client error path and the IP |
| `5d822ea` | **`traceLifecycle: "static"`** (§3.8) + **closure of the console-breadcrumb leak** (§3.7) + `httpBodies` audit (§3.6.1) + real scope of the scrub on `extra` (§9.9) |
| *(this commit)* | Records the empirical verification of the two previous tasks |

**Transparency note:** tag emission ended up inside commit `05b8092`,
not `2a8148f`, because `reportarFallo` needed the `tags` parameter from the
start. History was not rewritten to hide that; the task
5 commit contributes the verification, which was what was actually missing.

---

## 8. Verification status

### Verified

| What | How |
|---|---|
| Server error path | Real error thrown against `npm run dev` and against a production build; it reached Sentry (`PITCH-COACH-1`, `PITCH-COACH-2`) |
| Source maps | Unminified stack trace in Sentry from a production binary |
| `onRequestError` | `mechanism: auto.function.nextjs.on_request_error` on the event |
| Release | Matches between build and runtime (`72ab2a5…`), which is why Sentry found the maps |
| Environment | `environment: production` on the production event |
| Sampling | `client_sample_rate: 0.1` in production |
| Inlining of `NEXT_PUBLIC_*` | Sentinel value in a build; it appears in the client bundle |
| Privacy filter | 40 tests, asserting by value as well as by name |
| Error sanitization | 13 tests; the provider body does not reach the SDK by any path |
| Tags | 8 tests running the 5 routes with the provider down |
| **The filter actually runs (server)** | `Sentry.setExtra` with unfiltered sentinels, on a temporary route: the real envelope came out with `transcripcion: "[Filtered]"` and `veredicto_corto: "[Filtered]"`. It is not only a unit test |
| **The CLIENT error path** | Headless Chrome 152 against `npm run dev`: a throw in `useEffect` and another in render make `error.tsx` show the fallback UI, and an event goes out with the real exception (`LanzaEnEfecto.useEffect`) toward `/monitoring` |
| **The IP is no longer reported** | Real envelope captured with a local DSN, before and after. Before: `user.ip_address` + `x-forwarded-for` on the event and on the spans. After: the four channels clean, and `settings.infer_ip: "never"` on the client envelope |
| **`beforeSendTransaction` DOES run** | It is not enough for the warning to disappear. Direct proof: with unfiltered sentinels attached to a real transaction (`GET /api/tmp-transaction-probe`), the envelope came out with `extra.analisis.transcripcion: "[Filtered]"` and `contexts.sparring.respuesta: "[Filtered]"`, keeping `score: 72`. Only the callback produces that marker |
| **`static` mode does not lose telemetry** | Same span count as before: the browser sends a `platform=javascript` transaction with 36 spans; the servers, `platform=node` transactions. Zero `span.v2` envelopes (before they were all like that) |
| **`httpBodies` does not leak the body** | Real POST with the transcript to `/api/analizar-pitch`: the body does not appear in `event.request.data`, nor in `http.request.body.data`, nor in the outgoing-call spans, nor in the `http` breadcrumbs. Detail in §3.6.1 |
| **The console-breadcrumb leak is closed** | Before: with a provider that returned an echo, the pitch appeared in `breadcrumbs[].data.arguments[1].message`. After: the sentinel reaches no envelope, and an `http` breadcrumb still survives with method, status, and url |
| **`genAI` captures nothing with raw `fetch`** | By code: it instruments modules by exact package + version + file, with no matching by URL/host (grep of provider hosts: 0 matches). Empirically: the call to the provider goes out as `auto.http.node_fetch` / `http.client` with no `gen_ai.*` attributes, and 0 captured files contain `gen_ai.*` or `auto.ai.*` |
| Full suite | 181 tests green (175 previous + 6 new) |
| Lint / types / build | `npm run lint`, `npx tsc --noEmit`, `next build` — all clean |

**The test issues these verifications generated were all left
`resolved`** (`PITCH-COACH-1` through `PITCH-COACH-5`), each with a comment that
explains what the test was. None remains open.

### How the client part was verified (reproducible)

1. `npm run dev` and open `http://localhost:3000/…` in Chrome. **Use `localhost`,
   not `127.0.0.1`**: the Next 16 dev server responds **403** to development
   assets requested at `127.0.0.1`, so the page does not hydrate, no effect
   runs, and the test fails for a reason that has nothing to do with the code.
   It took one failed attempt to discover that.
2. A client component that throws in `useEffect` (not in render: effects do not
   run on the server, so the failure is unambiguously the browser's).
3. With Playwright: wait for `text=Algo salió mal`, intercept the POST to
   `/monitoring`, and read the envelope.

The tunnel (`tunnelRoute`) returned **HTTP 200** on every send, so Sentry's
ingest accepted the envelopes. The test events remained as real issues
in the project (EU region); they should be closed.

### NOT verified

- **None of this ran on Railway.** The Dockerfile `ARG`s are validated
  by documentation and by the plugin's behavior locally, not by a
  real deploy.
- **The client error path was NOT tested on a production build** (only
  against `npm run dev`). The client *transport* in production is
  verified (§6), but firing a render error in production would require
  shipping a page that fails; there is no way to provoke it on demand.
- **Unminifying client stack traces.** The client already carries
  `release` (see §10), and the maps are uploaded under that release, so it should
  resolve. But **it was not checked with a real error in production**, and
  provoking it requires bundle code to fail: there is no way from the
  DevTools console, because those errors are born outside the chunks.

  Watch the sampling when testing: in production the client samples traces at
  **10%** (`tracesSampleRate: 0.1`), so loading the page once
  probably does **not** generate a transaction. Error events, by contrast, are not
  subject to that sampling: they are the deterministic probe.
- **Three `dataCollection` categories are still unaudited**: `cookies`,
  `urlQueryParams`, and `httpHeaders.response`. `httpBodies` was audited with no leak
  (§3.6.1) and `genAI` turned out inert by construction, verified (§3.6.2). See
  §3.6.3.
- **The cap of 1000 spans per trace with `static`** was not exercised: there are no traces
  that come close. If some day a route generates hundreds of spans, that is the first
  place to look.
- **The nested-array branch of `scrub()` on `extra` is inert today** (§9.9):
  a path that no call site produces cannot be verified.

---

## 9. Findings

1. **There was no `error.tsx` at all.** Client render errors did not
   reach Sentry at all.
2. **The provider-body leak.** Real, not theoretical. Resolved.
3. **The `/api/enriquecer` `catch` is practically unreachable** on Tavily
   failures: `enriquecerConTavily` isolates each point with its own `try/catch`
   by "best effort" design. The report there is defensive, not a live path.
4. **A sensitive key redacts the whole value**, not element by element:
   `traza: [a, b]` becomes `"[Filtered]"`. Deliberate — not even how many
   steps the reasoning had remains.
5. **`.dockerignore` excludes `.git`**, which breaks automatic
   release detection and commit linking in production. Hence point 6.
6. **The "experimental" Turbopack flag for source maps no longer applies.** Since
   `@sentry/nextjs@10.13.0` it is the default behavior. Verified against the
   documentation and against the real build log.
7. **`beforeSendTransaction` was not running** (with the `"stream"` default), and
   now it does. **Resolved** by setting `traceLifecycle: "static"`; the full
   trade-off analysis and what is lost are in §3.8. Verified with a real
   transaction and sentinels, not by the absence of the warning.
   **Declared debt:** `beforeSendTransaction` is removed in **v12** of the SDK,
   so this solution has a date. Migrating to `beforeSendSpan` (which in
   `"stream"` receives `StreamedSpanJSON`) is pending work, before upgrading to
   v12. It is a decision for the maintainer, not an implementation detail.
8. **The IP left through four channels and two different mechanisms**, not one.
   See §3.6 — it is the central finding of this phase.
9. **Real scope of the recursive scrub on `extra`: the nested-array branch is
   INERT today, not an active defense.** It was audited in depth and there are two
   independent reasons:

   - **No call site produces it.** The project's five `reportarFallo` calls
     pass flat contexts (`{ proveedor }`, `{ proveedor, nivel }`), and `src/` does not
     use `setContext`, `setExtra`, or `addBreadcrumb`.
   - **Even if it existed, Sentry normalizes it first.** Verified on the real path
     (`captureException` with a hint, the one `reportarFallo` uses): an
     `extra.analisis.rubrica` with `{ comentario }` inside arrives at the envelope as
     `["[Object]"]`. That is, `scrub()` does not receive the nested objects: it receives an
     array with the string `"[Object]"`.

   **What it does protect for real in `extra`, and that should not be discounted:**
   recursion on **flat objects** works and is what acts. Verified on the
   same envelope: `extra.analisis.transcripcion` and `veredicto_corto` came out
   `[Filtered]` while `score` survived. That is what cuts the user's text
   at the level where it actually travels.

   **Where the array branch IS a live load:** in `breadcrumbs`. There, arrays
   are NOT normalized — the §3.7 leak traveled precisely inside
   `data.arguments`, an array whose inner object kept `message` and `stack`
   complete all the way to the envelope. That branch is what processes those breadcrumbs (and
   that is why dropping the console ones is a separate rule and not an effect of the
   scrub). For `request.data` and `contexts` the branch is still theoretical: the
   first arrives empty on these routes (§3.6.1) and the second are not used.

   Honest conclusion: the filter's array branch **is not superfluous** (it is what
   covers breadcrumbs), but **it is not what protects `extra`**. The previous
   documentation implied the second.
10. **Real, reproduced leak through a console breadcrumb.** The pitch reached
    Sentry inside `breadcrumbs[].data.arguments[1].message` and `.stack`, because of the
    `console.error` in the `catch` blocks, which records the full `ErrorModelo` — and that
    message carries the provider body. **Closed** by dropping console
    breadcrumbs in `beforeSend`/`beforeSendTransaction`. Detail in
    §3.7. It is the most important finding of this phase after the IP.
11. **The Next 16 dev server responds 403 to development assets if they are
    requested via `127.0.0.1`.** That is what made the first attempt to
    verify the client error fail: without assets there is no hydration, without hydration
    no effect runs, and the result looks like a broken boundary when it is not. With
    `localhost` it works. Noted in §8.
12. **`consoleIntegration` has a `filter`, but it does not serve this.** It filters
    by pattern on the first argument and, in addition, **silences the call on the
    real console** (`if (!isFiltered || debug) log(...)`). Using it would have killed the
    local log the project wants to keep. That is why the cut is in
    `beforeSend`. Noted so nobody "simplifies" it in that direction.
13. **`genAI` is inert today, but with a latent trap.** It only instruments AI
    SDKs by exact package/version/file, not by URL, and the project calls
    the providers with raw `fetch` — so it captures nothing. But the
    AI integrations **are still registered by default**: if
    `proveedor-nebius.ts` is migrated to the `openai` package (plausible; Nebius is
    OpenAI-compatible), `genAI` turns on with permissive defaults and the prompt
    travels to Sentry as a span attribute, without passing through `beforeSend`. See §3.6.2.
14. **The production client did not carry `release`, and the cause was asymmetric.**
    Symptom: 50 server spans with a release and 240 browser spans without one.

    Cause: the client release is resolved at **build time**
    (`releaseName = release.name ?? getSentryRelease() ?? getGitRevision()`). In
    a Dockerfile build there is no `.git`, and `getSentryRelease()` — in
    `@sentry/node/build/cjs/sdk/api.js` — looks first for `SENTRY_RELEASE` and then
    a long list of CI variables that includes
    **`RAILWAY_GIT_COMMIT_SHA`**. Neither reached the build: the first
    did not exist as a variable, and the second was not declared as an `ARG`.

    **Why the server did have it:** it resolves it at **runtime**, where Railway
    does inject `RAILWAY_GIT_COMMIT_SHA` into the container. The server never
    needed configuration, and that made the problem look like "the client
    is broken" instead of "the `ARG` was not declared".

    **Fix (commit `90fa3e5`):** `ARG RAILWAY_GIT_COMMIT_SHA` in the
    `builder` stage. That was chosen instead of creating a `SENTRY_RELEASE` variable with
    a `${{RAILWAY_GIT_COMMIT_SHA}}` reference, which in the Railway editor
    came out empty; the SDK recognizes the Railway variable directly.

    **Verification:** the deployed bundle contains `release:"90fa3e56…"` as a
    literal (before it was a read with no definition behind it), and Sentry shows a
    release with that name created by the plugin at build time.

    **Transferable lesson:** any value the SDK needs at
    **build time** has to arrive through `ARG`, and the server's values are not
    evidence that it arrived — the server may be resolving it at runtime.

---

## 10. What is still pending

- **Migrate to `beforeSendSpan` before upgrading to v12 of the SDK** (§9.7). Today the
  transaction filter works via `beforeSendTransaction` + `static`, but
  that option is removed in v12. In `"stream"` the callback receives
  `StreamedSpanJSON` (another data shape) and **cannot drop spans
  by returning `null`**. That is the design decision left open.
- **Audit the three `dataCollection` categories that are still active**
  (`cookies`, `urlQueryParams`, `httpHeaders.response`). `httpBodies` was already
  audited with no leak (§3.6.1) and `genAI` is inert as long as an AI SDK is not used
  (§3.6.2). See §3.6.3 — do not claim they are covered.
- **If `proveedor-nebius.ts` is ever migrated to the `openai` package**, set
  `dataCollection.genAI: { inputs: false, outputs: false }` **before** the change:
  it is the only thing that stops prompts — with the transcript — from traveling to Sentry
  as span attributes, which do not pass through `beforeSend`. See §3.6.2.
- **Decided: `docs/sentry.md` goes on the branch.** It is the decision record of
  the phase; the short, stable summary lives in `docs/status.md` §5. If they
  ever diverge, `status.md` wins.

---

## 11. What to look at before the merge

In order of risk:

1. **`src/lib/sentry-scrub.ts`** — the full filter, line by line. It is the
   piece that keeps something sensitive from leaking to a third party. Look in particular
   at the dropping of console breadcrumbs (§3.7) and its regression test.
2. **`src/lib/sentry-options.ts`, `TRACE_LIFECYCLE`** — the decision with an expiration
   date (§3.8). It is the only thing on this branch that has to be reviewed before a
   major SDK upgrade.
3. **`src/lib/sentry-reporte.ts`** — sanitization of the provider error. If
   someone replaces it with a direct `captureException(error)`, the leak returns.
   Note: it sanitizes the exception, **not** the breadcrumbs — the
   filter does that.
4. **`next.config.ts` + `Dockerfile`** — the source map config, which the brief
   asked to leave out. Decide whether it stays.
5. **`NODE_ENV` as the environment fallback** — a deviation from the brief; the documented
   default is still `production`.
6. **The `elevenlabs`/`tavily` tags** on `tts`/`enriquecer` — a deviation from the
   brief, which asked for `nebius`/`gemini`.

### Commands to verify on your own

```bash
git log --oneline main..feature/sentry
npm run lint && npx tsc --noEmit && npm test && npm run build
npx vitest run test/sentry-scrub.test.ts test/sentry-reporte.test.ts test/sentry-tags.test.ts
```
