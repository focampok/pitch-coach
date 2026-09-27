# Guía de integración Tavily (extraída de Pitch Coach)

Cómo reutilizar en otro proyecto la lógica de búsqueda web de Tavily de este repo: API key, llamada REST a `/search`, armado de queries para encontrar datos reales, aislamiento por punto y **degradación silenciosa** para que el enriquecimiento nunca rompa el flujo principal.

No hace falta el SDK oficial de Tavily. Pitch Coach habla con la API REST de `api.tavily.com` usando `fetch` nativo, siempre en servidor.

---

## 0. Alcance: qué es "lógica Tavily" aquí (y qué no)

En Pitch Coach, Tavily no alimenta el análisis principal: es un **enriquecimiento opcional** (§12 del alcance). Cuando el análisis de IA detecta que un punto de la rúbrica no se cumplió *por falta de una cifra concreta*, se busca en la web una estadística/dato real que el usuario podría citar para reforzar ese punto, y se muestra como sugerencia con su fuente en el dashboard.

| Uso | En este repo | Motor | ¿Se extrae? |
|---|---|---|---|
| Búsqueda de datos reales para sugerencias | Sí | Tavily `POST /search` | **Sí, esta guía** |
| Análisis del pitch (lo que decide *qué* faltó) | Sí | Gemini | No (ver `guia-integracion-gemini.md`) |
| Transcripción del discurso | Sí | MediaRecorder + ElevenLabs Scribe | No usa Tavily |

Punto importante: Tavily **no produce texto**, produce fuentes. La decisión de *qué* buscar la toma otra capa (en este repo, los puntos no cumplidos que devuelve Gemini). Si tu otro proyecto no tiene una capa que te diga "qué reforzar", la pieza que extraes se reduce al cliente HTTP de la sección 8.1.

---

## 1. Qué es reutilizable y qué no

| Pieza | Archivo en este repo | ¿Se copia tal cual? |
|---|---|---|
| Cliente HTTP de Tavily (`buscarEnTavily`) | `src/lib/tavily.ts` | Sí, es el núcleo. Cambia el nombre si quieres. |
| Lógica de enriquecimiento best-effort (paralelo + aislado) | `src/lib/tavily.ts` | Sí, es el patrón más valioso. Adapta `query` y el contrato a tu dominio. |
| API route que oculta la key y degrada | `src/app/api/enriquecer/route.ts` | El patrón sí; valida el body con tu contrato. |
| Fetch aislado desde el cliente | `src/components/DashboardResultado.tsx` | El patrón sí (efecto que no bloquea, tolera `[]`). |
| Variable de entorno | `.env.example` | Sí (`TAVILY_API_KEY`). |
| Puntos de rúbrica / qué se refuerza | tipos de `src/types/pitch.ts` | No. Es dominio de Pitch Coach. |
| Texto de la query ("estadística reciente …") | `src/lib/tavily.ts` | El patrón sí; la redacción es de tu dominio. |

**Dependencias:** ninguna extra. `package.json` no incluye SDK de Tavily. Bastan `fetch`, TypeScript y variables de entorno.

---

## 2. Principios que no debes romper

1. **La API key vive solo en el servidor.** Se lee de `process.env.TAVILY_API_KEY`. Nunca `NEXT_PUBLIC_TAVILY_API_KEY` ni hardcode en el cliente.
2. **El navegador nunca llama a Tavily.** El frontend pega a tu API route; la route llama a Tavily con la key.
3. **Tavily es best-effort: nunca rompe el flujo principal.** Esta es la diferencia filosófica con Gemini/ElevenLabs en este repo (que fallan en claro con **502**). Tavily es una sección *opcional* del dashboard, así que sin key, con fallo o con timeout, la route responde **200 con `sugerencias: []`** y la UI simplemente oculta la sección. No es un error de tu app: es un "no hay dato hoy".
4. **Aísla cada búsqueda con su propio `try/catch`.** Se corren en paralelo con `Promise.all`, pero si una query falla no debe tumbar a las demás ni al response completo.
5. **Pide poco y barato.** `search_depth: "basic"`, `max_results: 3` e `include_answer: false`. No necesitas la respuesta redactada del LLM de Tavily ni un crawl profundo: quieres 1–3 fuentes reales para enlazar.
6. **No expongas el texto crudo.** Tavily devuelve `content` (ya truncado) y `raw_content` (la página entera, solo si la pides). En este repo el resumen se corta a 280 caracteres antes de mandarlo al cliente.

En Next.js App Router, `.env.local` alimenta el servidor. En Railway (u otro host), replica la misma key en el panel de variables.

---

## 3. Variables de entorno

Copia esto a `.env.example` del otro proyecto (sin valores reales) y a `.env.local` / al host de deploy (con valor):

```bash
# Clave de Tavily (búsqueda web). Solo server-side. Nunca prefijo NEXT_PUBLIC_.
# Sin ella, la feature de sugerencias simplemente no aparece (degradación silenciosa).
TAVILY_API_KEY=
```

La API key se crea en el [dashboard de Tavily](https://app.tavily.com/) → *API Keys*. Es un string `tvly-...`.

---

## 4. Contrato HTTP con Tavily

```
POST https://api.tavily.com/search
Content-Type: application/json
Authorization: Bearer {TAVILY_API_KEY}     ← forma que documenta Tavily hoy
```

> **⚠️ Autenticación — trampa conocida.** El código original de este repo envía `api_key` **en el body** (`{ api_key: "tvly-…", query, … }`), variante que fue la oficial durante años y que en cuentas como la de este proyecto aún responde 200. Pero la documentación actual de Tavily solo describe el header `Authorization: Bearer` y dice explícitamente que la key no va en el body. Si al portar ves un **401**, cambia un solo header de `{ "api_key": key }` en el body a `Authorization: Bearer {key}` — el resto del contrato no cambia. El código genérico de la sección 8 ya usa Bearer.

Cuerpo (el de este proyecto):

```json
{
  "query": "estadística reciente <tema> <punto>",
  "search_depth": "basic",
  "max_results": 3,
  "include_answer": false
}
```

- `query` — lo que buscas. Solo este campo es obligatorio.
- `search_depth` — `basic` (1 crédito, suficiente para sugerencias) vs `advanced` (2 créditos). No lo subas sin motivo.
- `max_results` — en este repo `3`; el default de la API es 10 y el tope 20.
- `include_answer` — `false` en este repo. Si lo pones en `true`, Tavily redacta una respuesta (con LLM, más caro). Aquí no se usa porque queremos **fuentes enlazables**, no texto generado.

Parámetros útiles que este repo **no** usa pero vale conocer al portar:

| Parámetro | Qué hace | ¿Cuándo usarlo? |
|---|---|---|
| `language: "es"` | Sesga resultados hacia un idioma | Tu público es LATAM → recomendado para mejorar el ranking en español |
| `topic: "news"` | Restringe a noticias recientes | Si buscas cifras/actualidad |
| `time_range: "month"` | Recencia | Estadísticas que cambian rápido |
| `include_domains` / `exclude_domains` | Permite/bloquea dominios | Evitar fuentes no confiables |
| `include_raw_content: true` | Trae el texto completo de la página | Solo si `content` truncado se te queda corto (y luego corta tú, no lo mandes entero al cliente) |

### Cómo se ve la respuesta

```jsonc
{
  "query": "…",
  "results": [
    {
      "title": "…",
      "url": "https://…",
      "content": "…",          // extracto truncado de la página
      "score": 0.982           // relevancia 0–1
    }
  ]
  // "answer" solo aparece si pediste include_answer: true
}
```

El código lee `data.results` y usa `results[0]` (Tavily ya ordena por relevancia/score). `content` viene truncado de fábrica, así que el `slice(0, 280)` del repo es solo para no inflar el payload de tu propia API, no para protegerte de un texto gigante.

### Códigos de error típicos de Tavily

| HTTP | Significado |
|---|---|
| 400 | Body mal formado o parámetro inválido |
| 401 | Key inválida o faltante (revisa el callout de auth arriba) |
| 429 | Rate limit / cuota del plan |
| 5xx | Caída del servicio |

**Esto importa:** como Tavily es best-effort, en este repo **ningún** status se propaga al usuario. Cualquier fallo se registra con `console.warn`/`console.error` y el cliente recibe `sugerencias: []`. El síntoma de key rota es silencioso para el usuario (la sección no aparece) y solo visible en los logs del servidor.

---

## 5. La API route (Next.js App Router)

El frontend **nunca importa** el cliente de Tavily. Hace `POST` a la route; la route lee la key y llama a Tavily. `runtime = "nodejs"` (necesario para `process.env` y fetch server-side).

Contrato de la route (el de este repo):

```
POST /api/enriquecer
body: { tema: string, puntosSinCumplir: { punto: string, comentario?: string }[] }
→ 200 { sugerencias: [{ punto, query, resumen, url }] }
→ 400 { error }   solo si el body no es JSON válido
→ 429 { error }   rate limit por IP (10 req / 10 min, en memoria) + Retry-After
```

Único caso en que esta ruta no es best-effort: el **429**, que se decide antes de llamar a Tavily y protege tu cuota. En memoria, así que el límite efectivo se multiplica por el número de instancias.

Detalles que vale copiar (aquí es donde se nota la filosofía "opcional"):

- **400 solo para JSON inválido.** La validación de negocio no es 400: si falta `tema` o no hay `puntosSinCumplir`, responde **200 con `[]`** porque simplemente no hay nada que enriquecer.
- **Sin key → 200 con `[]`**, no 502. Tavily no está en el loop crítico; su ausencia no es un fallo de tu app.
- **Cualquier fallo interno → 200 con `[]`** + `console.error`. El dashboard nunca se rompe por esto.
- El body del request se mapea 1:1 a lo que espera `enriquecerConTavily` (o la versión genérica de la sección 8).

---

## 6. Uso desde el cliente (para ubicar el patrón)

La parte de UI es la menos portable (es del dashboard de Pitch Coach), pero el patrón de fetch vale la pena:

- Se dispara en un `useEffect` de una sola vez, **sin bloquear** el render del resto del dashboard.
- Tiene un flag `cancelado` para no hacer `setState` después de desmontar.
- La respuesta se trata con `res.ok ? res.json() : { sugerencias: [] }` — nunca asume que la route devolvió algo.
- Render condicional: `sugerencias.length === 0` muestra "Sin sugerencias por ahora." y no la sección; cada sugerencia se renderiza como `punto` + `resumen` + enlace "Fuente" (`target="_blank" rel="noreferrer"`).

---

## 7. Cómo portarlo a otro proyecto (pasos)

### Paso 1 — Variables

Crea `.env.local` (gitignored) y `.env.example` (commiteable) con la key de la sección 3. Obtén la key en el [dashboard de Tavily](https://app.tavily.com/).

### Paso 2 — Cliente genérico

Copia el bloque de la sección 8.1. Cambia el tipo `SugerenciaFuente`, el texto con el que armas la `query` y qué campo usas de "clave" (aquí era un punto de rúbrica; en tu producto puede ser una sección faltante, un claim sin respaldo, etc.). No toques: lectura de env, headers, manejo de `!res.ok`, `results[0]`.

### Paso 3 — API route

Copia el bloque de la sección 8.2. Cambia el nombre de los campos del body si tu contrato usa otros. Mantén la filosofía: **esta ruta nunca debe 502** si Tavily falla; responde `[]`.

### Paso 4 — Cliente

Haz el `fetch` desde un efecto/acción que no bloquee tu render y que tolere `[]` en la respuesta (o un `catch` que lo trate igual).

### Paso 5 — Probarlo sin la UI

```bash
# desde el servidor (o curl directo con la key puesta en el entorno)
curl -sS -X POST "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"estadística reciente mercado LATAM 2026","search_depth":"basic","max_results":3}'
```

Si ves un `results` con `url` y `content`, el contrato está bien. Luego prueba `$TAVILY_API_KEY=` vacío (o un valor inválido) y confirma que tu route responde `{ "sugerencias": [] }` y que tu UI no crashea.

---

## 8. Código genérico para copiar

### 8.1 Cliente server (`src/lib/tavily.ts`, adaptado)

Usa `Authorization: Bearer` (ver callout de la sección 4). `buscarEnTavily` es el núcleo 100 % portable; `sugerirFuentes` es el patrón "paralelo + aislado" con la query de tu dominio.

```ts
export interface SugerenciaFuente {
  /** Qué querías reforzar (tu "clave": punto, sección, claim…). */
  clave: string;
  query: string;
  resumen: string;
  url: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

/** Busca en Tavily y devuelve los resultados ya ordenados por relevancia.
 *  Lanza si no hay key o si la API responde mal — el caller decide si
 *  eso importa (en este patrón: no, es best-effort). */
export async function buscarEnTavily(
  query: string,
  opts: { maxResults?: number } = {}
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
      max_results: opts.maxResults ?? 3,
      include_answer: false,
      // Sesga el ranking hacia tu idioma; ajusta a tu audiencia.
      language: "es",
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

/** Para cada "brecha" (algo que a tu análisis le faltó respaldar), arma una
 *  query y busca una fuente real. Best-effort: si Tavily falla para una,
 *  esa brecha simplemente no trae sugerencia — no tumba el resto. */
export async function sugerirFuentes(
  brechas: { clave: string; detalle?: string }[],
  tema: string
): Promise<SugerenciaFuente[]> {
  const sugerencias: SugerenciaFuente[] = [];

  // Se corren en paralelo pero cada una se aísla con su propio try/catch.
  await Promise.all(
    brechas.map(async ({ clave }) => {
      const query = `estadística reciente ${tema} ${clave}`.trim();
      try {
        const resultados = await buscarEnTavily(query);
        const mejor = resultados[0];
        if (mejor) {
          sugerencias.push({
            clave,
            query,
            resumen: mejor.content.slice(0, 280),
            url: mejor.url,
          });
        }
      } catch (err) {
        console.warn(`[tavily] sin fuente para "${clave}":`, err);
      }
    })
  );

  return sugerencias;
}
```

Si prefieres conservar la forma original del repo (key en el body), cambia únicamente los headers:

```ts
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ api_key: apiKey, query, /* …resto igual… */ }),
```

### 8.2 API route genérica (Next.js App Router)

```ts
import { NextRequest, NextResponse } from "next/server";
import { sugerirFuentes } from "@/lib/tavily";

export const runtime = "nodejs";

/**
 * POST /api/enriquecer
 * body: { tema: string, brechas: { clave: string, detalle?: string }[] }
 *
 * Feature opcional, best-effort: nunca debe romper la UI de quien la consume.
 * Sin TAVILY_API_KEY, sin tema, sin brechas o si Tavily falla → 200 { sugerencias: [] }.
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
    // Degradación silenciosa: Tavily es opcional.
    return NextResponse.json({ sugerencias: [] });
  }

  try {
    const sugerencias = await sugerirFuentes(brechas, tema);
    return NextResponse.json({ sugerencias });
  } catch (err) {
    console.error("[/api/enriquecer] fallo Tavily:", err);
    // No crítico: 200 con lista vacía en vez de romper al consumidor.
    return NextResponse.json({ sugerencias: [] });
  }
}
```

### 8.3 Fetch desde el cliente (patrón, no componente)

```ts
// Tolerante: cualquier fallo se trata como "sin sugerencias".
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

## 9. Flujo en Pitch Coach (para ubicar el código)

```
DashboardResultado.tsx
  useEffect (una sola vez, no bloquea el render, flag cancelado)
  POST /api/enriquecer { tema: tipoPitch, puntosSinCumplir }
        │  si 200 → data.sugerencias ?? []   si !ok → []
        ▼
route.ts (/api/enriquecer)
  JSON inválido → 400
  sin tema / sin puntos → 200 { sugerencias: [] }
  sin TAVILY_API_KEY → 200 { sugerencias: [] }   ← opcional, no 502
  enriquecerConTavily(...)  → 200 { sugerencias }
        │
        ▼
tavily.ts
  TAVILY_API_KEY  (solo aquí)
  por cada punto no cumplido → query "estadística reciente <tema> <punto>"
  buscarEnTavily (paralelo, cada una con su try/catch)
  results[0] → { punto, query, resumen: content.slice(0,280), url }
        │
        ▼
DashboardResultado → sección "Datos que podrían reforzar tu pitch"
  render: punto + resumen + <a href={url}>Fuente</a>
```

Lo que **no** pasa por Tavily en este proyecto: la detección de *qué* falta (Gemini, ver `guia-integracion-gemini.md`) y las muletillas (regex local). Tavily solo entra al final para buscar un respaldo citable. Si tu producto tiene una capa de análisis que te dice qué reforzar, este patrón encaja igual: llama a tu análisis primero y pásale a la ruta solo las "brechas" detectadas.

---

## 10. Checklist al llevarlo a otro repo

- [ ] `.env.local` con `TAVILY_API_KEY` (no commiteado).
- [ ] `.env.example` con `TAVILY_API_KEY=` vacía y comentario de que es server-side.
- [ ] Cliente de Tavily importado **solo** desde API routes / server actions / server components.
- [ ] Auth verificada: si envías key en el body y te da 401, cambia a `Authorization: Bearer` (un solo header).
- [ ] Route con `runtime = "nodejs"`.
- [ ] Sin key / fallo de Tavily → `200 { sugerencias: [] }`, nunca 502 ni crash.
- [ ] Cada búsqueda aislada en su `try/catch` (una caída no tira el lote).
- [ ] `search_depth: "basic"` y `max_results` bajo (¿3 es suficiente?).
- [ ] `include_answer: false` a menos que quieras la respuesta redactada del LLM.
- [ ] Resumen recortado antes de mandarlo al cliente (p. ej. `slice(0, 280)`).
- [ ] `language` / `time_range` ajustados a tu idioma y tipo de dato.
- [ ] Cliente tolera `[]` y no bloquea el render principal.
- [ ] Nada con prefijo `NEXT_PUBLIC_` para la key.

---

## 11. Referencia rápida

| Concepto | Valor en este repo |
|---|---|
| SDK | Ninguno (`fetch` + REST) |
| Base URL | `https://api.tavily.com` |
| Método | `POST /search` |
| Auth | Repo: key en el body. **Hoy**: `Authorization: Bearer` |
| `search_depth` | `basic` |
| `max_results` | `3` |
| `include_answer` | `false` |
| Cómo se elige resultado | `results[0]` (Tavily ordena por score) |
| Resumen enviado al cliente | `content.slice(0, 280)` |
| Aislamiento | `Promise.all` + `try/catch` por query |
| Sin key / fallo | `200 { sugerencias: [] }` (degradación silenciosa) |
| Solo JSON inválido | `400` |
| Parámetro útil no usado | `language`, `topic: "news"`, `time_range` |

Fuente de verdad del cliente: [`src/lib/tavily.ts`](../src/lib/tavily.ts) y [`src/app/api/enriquecer/route.ts`](../src/app/api/enriquecer/route.ts).
