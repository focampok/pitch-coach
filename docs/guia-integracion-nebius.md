# Guía de integración Nebius Token Factory

Cómo Pitch Coach habla con Nebius Token Factory usando un endpoint
**OpenAI-compatible**. Es el proveedor **por defecto** del análisis; Gemini queda
como contingencia manual.

- Adaptador: [`src/lib/proveedor-nebius.ts`](../src/lib/proveedor-nebius.ts).
- Capa neutra (reintentos, timeout, parseo) y fábrica: [`src/lib/modelo.ts`](../src/lib/modelo.ts).
- Esquema restringido: [`src/lib/validar-analisis.ts`](../src/lib/validar-analisis.ts).

No se usa ningún SDK: basta `fetch` nativo.

---

## 1. Selección de proveedor

`MODEL_PROVIDER` decide qué adaptador usa `proveedorActivo()`:

| `MODEL_PROVIDER` | Adaptador | Key requerida |
|---|---|---|
| `nebius` (default) | `proveedor-nebius.ts` | `NEBIUS_API_KEY` |
| `gemini` | `proveedor-gemini.ts` | `GEMINI_API_KEY` |

Un valor distinto lanza `ErrorModelo` con el mensaje de valores válidos. Si la
variable falta, se asume `nebius`.

---

## 2. Variables de entorno

```bash
# Proveedor activo: "nebius" (default) o "gemini"
MODEL_PROVIDER=nebius

# Requerida con MODEL_PROVIDER=nebius. Solo server-side.
NEBIUS_API_KEY=

# Base URL OpenAI-compatible. Default:
# https://api.tokenfactory.nebius.com/v1
NEBIUS_BASE_URL=

# Modelo del modo ultra (capacidad en la librería; aún sin ruta ni botón).
# Default: nvidia/Nemotron-3-Ultra-550b-a55b
NEBIUS_MODEL_ULTRA=

# Neutras, compartidas con el resto de proveedores:
MODEL=                        # default Nebius: nvidia/nemotron-3-super-120b-a12b
MODEL_FALLBACK_MODELS=        # separadas por comas
MODEL_MAX_TOKENS=             # default 1024
MODEL_TEMPERATURE=            # default 0.7
MODEL_RETRY_ATTEMPTS=         # default 3
MODEL_RETRY_DELAY_MS=         # default 1000
MODEL_RETRY_MAX_DELAY_MS=     # default 8000
```

`NEBIUS_BASE_URL` se normaliza (se le quita la barra final) antes de concatenar
`/chat/completions`.

Sin `NEBIUS_API_KEY`, el adaptador lanza un `ErrorModelo` claro **antes** de
cualquier `fetch`; la API route lo convierte en 502 con mensaje genérico al
cliente y el detalle queda solo en logs del servidor.

---

## 3. Contrato HTTP

```
POST {NEBIUS_BASE_URL}/chat/completions
Authorization: Bearer {NEBIUS_API_KEY}
Content-Type: application/json
```

Cuerpo (modo estándar, el del despliegue):

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

Puntos que no se deben cambiar sin volver a probar contra la API real:

- **El envoltorio del esquema es obligatorio.** `response_format.json_schema`
  debe llevar `{ name, strict, schema }`. Un esquema sin envolver devuelve **422**.
- **`messages` va separado** en `system` y `user` (igual que produce
  [`src/lib/prompts.ts`](../src/lib/prompts.ts)).
- **`chat_template_kwargs: { enable_thinking: false }`** es válido y baja los
  tokens de razonamiento a 0 sin perder validez del JSON. Se agrega por defecto
  en modo estándar.
- Con `finish_reason: "stop"`, el JSON completo está en `choices[0].message.content`.
  No hace falta leer `reasoning_content`.

Se extrae el texto de `choices[0].message.content`.

---

## 4. Modo estándar y modo ultra

`crearProveedorNebius(nivel)` acepta un parámetro interno:

| Nivel | Modelo | `chat_template_kwargs` | Lista de modelos |
|---|---|---|---|
| `estandar` (default) | `MODEL` (o `nvidia/nemotron-3-super-120b-a12b`) | Se envía `{ enable_thinking: false }` | principal + `MODEL_FALLBACK_MODELS` |
| `ultra` | `NEBIUS_MODEL_ULTRA` | **Se omite** (deja el razonamiento activo) | solo ese modelo, sin fallbacks |

El nivel `ultra` es **capacidad de librería**: en esta fase no hay ruta, botón ni
llamador que lo use. `proveedorNebius` (el que usa la fábrica) es el de nivel
`estandar`.

---

## 5. Reintento por `finish_reason: "length"`

Una respuesta truncada no es éxito ni error genérico: es señal de que faltó
presupuesto de tokens. El adaptador **reintenta esa misma llamada una vez** con
`max_tokens` duplicado (tope `8192`) antes de devolver el control al bucle de
reintentos/modelos de `modelo.ts`.

- Si el segundo intento vuelve a truncarse → `ErrorModelo` (sin `codigoHttp`, es
  decir reintentable por la capa neutra).
- Si el primer `max_tokens` ya está en `8192` y sigue truncando → error claro, no
  se reintenta con menos.

---

## 6. Esquema restringido (una sola generación)

En modo estricto conviene que el esquema declare el número exacto de ítems y sus
nombres. `construirEsquemaAnalisisRestringido(puntos)` deriva de
`ESQUEMA_ANALISIS` un esquema con:

- `minItems === maxItems === puntos.length` en `rubrica`;
- `enum` con los nombres exactos de los puntos en `punto` (el modelo no puede
  inventarlos);
- `required` + `additionalProperties: false` donde corresponde.

Se genera **una sola vez por conjunto de puntos** (caché por nombres en orden).
El llamador aporta los nombres vía `SolicitudModelo.puntosRubrica` (opcional).
Gemini **no** lo usa: su prompt pide no devolver el nombre del punto, así que el
esquema restringido queda específico de Nebius.

---

## 7. Prueba de humo real (manual, fuera de vitest)

Los tests automatizados usan `fetch` mockeado y **nunca** pegan a la red. Para
verificar contra la API real con tu clave:

```bash
# Con NEBIUS_API_KEY en el entorno o en .env.local
NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs

# Para probar también el modelo ultra (omite chat_template_kwargs)
NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs --ultra
```

El script imprime status HTTP, `finish_reason`, si el `content` parsea como JSON
y el uso de tokens (para confirmar que el razonamiento queda en 0 en modo
estándar).

---

## 8. Resiliencia (compartida con Gemini)

La política vive en `modelo.ts`, no en el adaptador:

- Recorre `[principal, ...fallbacks]`; por modelo, hasta `MODEL_RETRY_ATTEMPTS`
  intentos con backoff `min(delayBase * 2^(n-1), delayMax)`.
- Reintenta 408/429/5xx, timeout y errores de red; un error permanente
  (400/404…) salta al siguiente modelo.
- Timeout por intento: 20 s (`AbortSignal.timeout`).
- El error del proveedor se clasifica con `ErrorModelo` y `codigoHttp`, así que
  el backoff se reutiliza: el adaptador **no** duplica lógica de reintentos.
