# Nebius Token Factory integration guide

How Pitch Coach talks to Nebius Token Factory through an
**OpenAI-compatible** endpoint. It is the **default** analysis provider; Gemini
stays as a manual fallback.

- Adapter: [`src/lib/proveedor-nebius.ts`](../src/lib/proveedor-nebius.ts).
- Neutral layer (retries, timeout, parsing) and factory: [`src/lib/modelo.ts`](../src/lib/modelo.ts).
- Constrained schema: [`src/lib/validar-analisis.ts`](../src/lib/validar-analisis.ts).

No SDK is used: native `fetch` is enough.

---

## 1. Provider selection

`MODEL_PROVIDER` decides which adapter `proveedorActivo()` uses:

| `MODEL_PROVIDER` | Adapter | Required key |
|---|---|---|
| `nebius` (default) | `proveedor-nebius.ts` | `NEBIUS_API_KEY` |
| `gemini` | `proveedor-gemini.ts` | `GEMINI_API_KEY` |

Any other value throws `ErrorModelo` with the message that lists the valid values. If the
variable is missing, `nebius` is assumed.

---

## 2. Environment variables

```bash
# Active provider: "nebius" (default) or "gemini"
MODEL_PROVIDER=nebius

# Required when MODEL_PROVIDER=nebius. Server-side only.
NEBIUS_API_KEY=

# OpenAI-compatible base URL. Default:
# https://api.tokenfactory.nebius.com/v1
NEBIUS_BASE_URL=

# Model for "Ultra analysis" mode (button on the dashboard).
# Default: nvidia/Nemotron-3-Ultra-550b-a55b
NEBIUS_MODEL_ULTRA=

# Neutral settings, shared with the other providers:
MODEL=                        # Nebius default: nvidia/nemotron-3-super-120b-a12b
MODEL_FALLBACK_MODELS=        # comma-separated
MODEL_MAX_TOKENS=             # default 1024
MODEL_TEMPERATURE=            # default 0.7
MODEL_RETRY_ATTEMPTS=         # default 3
MODEL_RETRY_DELAY_MS=         # default 1000
MODEL_RETRY_MAX_DELAY_MS=     # default 8000
```

`NEBIUS_BASE_URL` is normalized (the trailing slash is removed) before appending
`/chat/completions`.

Without `NEBIUS_API_KEY`, the adapter throws a clear `ErrorModelo` **before**
any `fetch`; the API route turns that into a 502 with a generic message for the
client, and the detail stays in server logs only.

---

## 3. HTTP contract

```
POST {NEBIUS_BASE_URL}/chat/completions
Authorization: Bearer {NEBIUS_API_KEY}
Content-Type: application/json
```

Body (standard mode, the one used in the deployment):

```json
{
  "model": "nvidia/nemotron-3-super-120b-a12b",
  "messages": [
    { "role": "system", "content": "<system de prompts.ts>" },
    { "role": "user", "content": "<user de prompts.ts>" }
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "analisis_pitch",
      "strict": true,
      "schema": { }
    }
  },
  "chat_template_kwargs": { "enable_thinking": false }
}
```

The two `content` strings in that body are unchanged placeholders for the
system and user text that [`src/lib/prompts.ts`](../src/lib/prompts.ts) builds.

Points that should stay as they are until you test again against the real API:

- **The schema wrapper is required.** `response_format.json_schema`
  must carry `{ name, strict, schema }`. An unwrapped schema returns **422**.
- **`messages` is split** into `system` and `user` (the same split
  [`src/lib/prompts.ts`](../src/lib/prompts.ts) produces).
- **`chat_template_kwargs: { enable_thinking: false }`** is valid and drops
  reasoning tokens to 0 while the JSON stays valid. It is added by default
  in standard mode.
- With `finish_reason: "stop"`, the full JSON is in `choices[0].message.content`.
  There is no need to read `reasoning_content`.

The text is taken from `choices[0].message.content`.

---

## 4. Standard mode and ultra mode

`crearProveedorNebius(nivel)` takes an internal parameter:

| Level | Model | `chat_template_kwargs` | Model list |
|---|---|---|---|
| `estandar` (default) | `MODEL` (or `nvidia/nemotron-3-super-120b-a12b`) | Sends `{ enable_thinking: false }` | primary + `MODEL_FALLBACK_MODELS` |
| `ultra` | `NEBIUS_MODEL_ULTRA` | **Omitted** (reasoning stays on) | that model only, no fallbacks |

The `ultra` level is invoked from the dashboard (`POST /api/analizar-pitch` with
`nivel: "ultra"`): the same Nebius provider, model `NEBIUS_MODEL_ULTRA`, without
`enable_thinking: false`, and with a `traza` field in the response. The session's
standard analysis uses `proveedorNebius` (level `estandar`). The
`rapido` level (Nano) feeds sparring, Tavily, and auxiliary checks.

---

## 5. Retry on `finish_reason: "length"`

A truncated response is neither success nor a generic error: it means the token
budget ran out. The adapter **retries that same call once** with
`max_tokens` doubled (cap `8192`) before handing control back to the
retry/model loop in `modelo.ts`.

- If the second attempt is truncated again → `ErrorModelo` (no `codigoHttp`,
  so the neutral layer may retry it).
- If the first `max_tokens` is already `8192` and the response is still truncated → a clear error;
  it is not retried with a smaller budget.

---

## 6. Constrained schema (a single generation)

In strict mode the schema should fix the exact number of items.
`construirEsquemaAnalisisRestringido(puntos)` derives from `ESQUEMA_ANALISIS` a
schema with:

- `minItems === maxItems === puntos.length` on `rubrica`;
- items shaped as `{ cumplido, comentario }`: the model does **not** name the
  points, and no name `enum` is declared (the server assigns each name by
  index from the rubric);
- `required` + `additionalProperties: false` where that applies.

It is generated **once per set of points** (cached by names in order).
The caller supplies the points through `SolicitudModelo.puntosRubrica` (optional);
they are used only for the array's exact length. Gemini does **not** use it, so the
constrained schema stays specific to Nebius.

---

## 7. Real smoke test (manual, outside vitest)

Automated tests use a mocked `fetch` and **never** hit the network. To
check against the real API with your key:

```bash
# With NEBIUS_API_KEY in the environment or in .env.local
NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs

# To also test the ultra model (omits chat_template_kwargs)
NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs --ultra
```

The script **does not duplicate logic**: it imports `construirEsquemaAnalisisRestringido()`,
`validarAnalisis()`, `RUBRICAS`, and `construirPrompt()` from `src/lib` (Node ≥ 22.6
runs the `.ts` files directly, with no runner and no build). A mismatch
between production and the smoke test makes the script fail.

It prints: the effective production schema (rubric length,
`items.required`, whether `punto` exists), HTTP status, `finish_reason`, token
usage, the **full untrimmed JSON** from `content`, the real
`validarAnalisis()` result, and the number of `rubrica` items.

On extra fields from the model: `validarAnalisis()` **ignores** surplus keys
(including a hallucinated `punto`) and **never** rejects them — the server assigns
each point's name by index from `RUBRICAS`. So a `rubrica` with
exactly `puntos.length` items and valid `{ cumplido, comentario }` always
passes, even if the model adds fields.

---

## 8. Resilience (shared with Gemini)

The policy lives in `modelo.ts`, not in the adapter:

- It walks `[primary, ...fallbacks]`; per model, up to `MODEL_RETRY_ATTEMPTS`
  attempts with backoff `min(delayBase * 2^(n-1), delayMax)`.
- It retries 408/429/5xx, timeouts, and network errors; a permanent error
  (400/404…) skips to the next model.
- Timeout per attempt: 20 s (`AbortSignal.timeout`).
- The provider error is classified with `ErrorModelo` and `codigoHttp`, so
  the backoff is reused: the adapter does **not** duplicate retry logic.
