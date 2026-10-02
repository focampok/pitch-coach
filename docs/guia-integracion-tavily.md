# Guía de integración Tavily (extraída de Pitch Coach)

Cómo reutilizar en otro proyecto la lógica de búsqueda web de Tavily de este repo: API key, llamadas REST a `/search` y `/extract`, armado de queries orientadas a cifra, **paso de validación obligatorio** para no mostrar una fuente que no trae el dato, y **degradación silenciosa** para que el enriquecimiento nunca rompa el flujo principal.

No hace falta el SDK oficial de Tavily. Pitch Coach habla con la API REST de `api.tavily.com` usando `fetch` nativo, siempre en servidor.

---

## 0. Alcance: qué es "lógica Tavily" aquí (y qué no)

En Pitch Coach, Tavily no alimenta el análisis principal: es un **enriquecimiento opcional** (§12 del alcance). Cuando el análisis de IA detecta que un punto de la rúbrica no se cumplió *por falta de una cifra concreta*, se busca en la web una estadística/dato real que el usuario podría citar para reforzar ese punto, y se muestra como sugerencia con su fuente en el dashboard.

| Uso | En este repo | Motor | ¿Se extrae? |
|---|---|---|---|
| Búsqueda de datos reales para sugerencias | Sí | Tavily `POST /search` | **Sí, esta guía** |
| Verificación de la cifra en la fuente | Sí | Tavily `POST /extract` | **Sí, esta guía** |
| Análisis del pitch (lo que decide *qué* faltó) | Sí | Gemini | No (ver `guia-integracion-gemini.md`) |
| Transcripción del discurso | Sí | MediaRecorder + ElevenLabs Scribe | No usa Tavily |

Punto importante: Tavily **no produce texto**, produce fuentes. La decisión de *qué* buscar la toma otra capa (en este repo, los puntos no cumplidos que devuelve Gemini). Si tu otro proyecto no tiene una capa que te diga "qué reforzar", la pieza que extraes se reduce al cliente HTTP de la sección 8.1.

Y hay un segundo punto, aprendido a golpes: **una fuente con score alto no es una cifra.** Que Tavily devuelva un resultado relevante no garantiza que ese resultado contenga un dato citable. Por eso la Fase B agrega Extract + validación antes de mostrar nada (ver §2.1).

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
| Texto de la query ("cifra reciente …") | `src/lib/query-tavily.ts` | El patrón sí; la redacción es de tu dominio. |
| Extracción del contenido de la fuente | `src/lib/tavily-extract.ts` | Sí, es el núcleo portable de la verificación. |
| Validación "¿trae cifra?" | `src/lib/validar-sugerencia.ts` | Sí; cambia el esquema a tu criterio de "dato útil". |
| Frase hablada con la cifra | `src/lib/validar-sugerencia.ts` | El patrón sí; el TTS es el tuyo. |

**Dependencias:** ninguna extra. `package.json` no incluye SDK de Tavily. Bastan `fetch`, TypeScript y variables de entorno.

---

## 2. Principios que no debes romper

1. **La API key vive solo en el servidor.** Se lee de `process.env.TAVILY_API_KEY`. Nunca `NEXT_PUBLIC_TAVILY_API_KEY` ni hardcode en el cliente.
2. **El navegador nunca llama a Tavily.** El frontend pega a tu API route; la route llama a Tavily con la key.
3. **Tavily es best-effort: nunca rompe el flujo principal.** Esta es la diferencia filosófica con Gemini/ElevenLabs en este repo (que fallan en claro con **502**). Tavily es una sección *opcional* del dashboard, así que sin key, con fallo o con timeout, la route responde **200 con `sugerencias: []`** y la UI simplemente oculta la sección. No es un error de tu app: es un "no hay dato hoy".
4. **Aísla cada búsqueda con su propio `try/catch`.** Se corren en paralelo con `Promise.all`, pero si una query falla no debe tumbar a las demás ni al response completo.
5. **Pide poco y barato.** `search_depth: "basic"`, `max_results: 6` e `include_answer: false`. No necesitas la respuesta redactada del LLM de Tavily ni un crawl profundo: quieres 1–6 fuentes reales para enlazar.
6. **No expongas el texto crudo.** Tavily devuelve `content` (ya truncado) y `raw_content` (la página entera, solo si la pides). En este repo el `content` extraído se acota y **jamás** se manda al cliente: el cliente solo ve la cifra validada, la cita recortada y el enlace.
7. **El Extract no basta: valida antes de mostrar.** Sobre la fuente elegida se corre `POST /extract` y luego una llamada al modelo con un esquema restringido que exige una cifra concreta **citada textualmente** y **relevante al tema buscado** (se le pasan las entidades del pitch como contexto de comparación). Si no hay cifra verosímil, o la cifra es de otro sector, la sugerencia se descarta. Es el filtro que evita mostrar "cómo calcular el mercado" cuando el usuario pedía el mercado, y también "qué es la capitalización de mercado" cuando el usuario pedía el tamaño del mercado de un salón de té.
8. **El log de diagnóstico no lleva PII.** Se registra la query final y si la validación aprobó (y por qué no), nunca la transcripción ni el contenido extraído.

En Next.js App Router, `.env.local` alimenta el servidor. En Railway (u otro host), replica la misma key en el panel de variables.

### 2.1 Por qué existe la validación (evidencia real, no hipótesis)

Antes de la Fase B, la sugerencia era "primer resultado de la búsqueda + `content` recortado". En pruebas manuales con **3 pitches reales**, **todos** los resultados mostrados fueron inútiles. No son hipótesis: es lo que se le mostró a una persona real.

1. **"Tracción" de un salón de té mexicano** → un blog en **inglés** sobre integración de ERP (Microsoft/Odoo). Irrelevante, y en otro idioma **a pesar de `language: "es"`** (por eso la Fase B usa además `filter_by_language`).
2. **"Mercado"** → un artículo de **FasterCapital** sobre la **metodología genérica** "cómo calcular el tamaño de mercado". Cero cifras: explicaba *cómo*, no *cuánto*.
3. **"Mercado" de un pitch de una cortadora de papel de regalo "Little ELF"** → una pregunta de **Quora** sobre "cómo calcular TAM/SAM/SOM". Cero cifras.
4. Mismo pitch, **"Tracción"** → una **noticia financiera real de "e.l.f. Beauty"** (cosméticos, ticker ELF). Colisión de nombres entre el producto "ELF" y una marca ajena: dato real, tema equivocado.
5. Un **cuarto pitch** no devolvió sugerencia para 3 puntos fallidos, **sin visibilidad de por qué** (de ahí el log de diagnóstico de §6).
6. **"Mercado" de un salón de té mexicano** → un artículo genérico de **"qué es la capitalización de mercado bursátil"**, con el rango **"$2-10 mil millones"** (la definición de "empresa mid-cap"). Ya había Extract y validación de cifra: el número y la cita existían, pero **no tenían nada que ver con el sector**. El hueco era que la validación aprobaba *cualquier* cifra, sin comprobar que fuera del tema buscado.

**Ninguno** de los resultados que vio el usuario contenía una cifra citable con fuente y fecha. La lección: no alcanza con buscar mejor; hay que **verificar el contenido de la fuente antes de mostrarla**. Cada pieza de la Fase B responde a uno de estos casos:

| Caso | Respuesta de la Fase B |
|---|---|
| Idioma equivocado (1) | `language` + `filter_by_language: true` en la búsqueda |
| Metodología sin cifra (2, 3) | `exclude_domains` + validación obligatoria (sin cifra → se descarta) |
| Colisión de nombres (4) | entidad ambigua nunca viaja sola; la validación exige coherencia del dato |
| Silencio inexplicable (5) | log de diagnóstico con la query final y el veredicto de validación |
| Cifra real de otro sector (6) | la validación exige el campo `relevante`: la cifra debe corresponder a las entidades del pitch, no solo existir |

**Decisión de alcance:** la validación se hace con el modelo (nivel `rapido`), no con heurísticas de regex. Un regex "¿hay un número?" acepta "TAM = SAM + SOM" y rechaza "USD 320 millones"; el modelo, con el esquema restringido, distingue mejor. Es una llamada extra por punto, y por eso el rate limit de la ruta bajó (ver §5).

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

- `query` — lo que buscas. Solo este campo es obligatorio. Aquí lo redacta el modelo (nivel `rapido`) a partir de las entidades + el punto, **sin el comentario negativo** del análisis (ver §2.1).
- `search_depth` — `basic` (1 crédito, suficiente para sugerencias) vs `advanced` (2 créditos). No lo subas sin motivo.
- `max_results` — en este repo `6`; el default de la API es 10 y el tope 20. Se piden varios para poder **elegir** el mejor (ver "Cómo se elige el resultado", más abajo).
- `include_answer` — `false` en este repo. Si lo pones en `true`, Tavily redacta una respuesta (con LLM, más caro). Aquí no se usa porque queremos **fuentes enlazables**, no texto generado.
- `language` — idioma de la sesión (`es` / `en`).
- `filter_by_language` — **este es el filtro duro de idioma.** `language` solo **sesga** el ranking; `filter_by_language: true` **filtra** de verdad (puede devolver cero resultados). Sin él, un pitch en español recibe fuentes en inglés (caso 1 de §2.1).
- `topic` — `finance` si el tipo de pitch es `capital`, `general` en el resto.
- `time_range: "year"` — recencia de la cifra: se busca un dato del último año, no un clásico de 2015.
- `exclude_domains` — **exclusión dura** (máx. 150 dominios) de los sitios que dieron metodología sin cifras en las pruebas manuales (`fastercapital.com`, `quora.com`, además de agregadores tipo `reddit.com`, `medium.com`, etc.) **y de los proxies de traducción automática** (`translate.goog` de Google, `microsofttranslator.com`, `translator.microsoft.com`, `bing.com`). Los proxies son una puerta trasera al problema de idioma que ya cerró `filter_by_language`: sirven la misma página en otro idioma con el dominio envuelto, así que un filtro por dominio del contenido real no los ve. Se define en `DOMINIOS_EXCLUIDOS` (`src/lib/tavily.ts`).

Parámetros útiles al portar:

| Parámetro | Qué hace | ¿Cuándo usarlo? |
|---|---|---|
| `language` + `filter_by_language` | `language` sesga, `filter_by_language` filtra | Casi siempre juntos si tu público es monolingüe |
| `country` | **Solo sesga** hacia un país; no filtra | Como preferencia suave, nunca como garantía |
| `topic: "news"` | Restringe a noticias recientes | Si buscas cifras/actualidad |
| `time_range` | Recencia (`day` / `week` / `month` / `year`) | Estadísticas que cambian rápido |
| `include_domains` / `exclude_domains` | Permite (blanda, salvo que pongas `filter_by_language`-like duro) / bloquea (dura) | Evitar fuentes conocidas por no traer cifras |
| `include_raw_content: true` | Trae el texto completo de la página | Casi nunca: para eso está `/extract`, que además deja pedir `query` y `chunks_per_source` |

### 4.1 Extract: verificar el contenido de la fuente

`POST https://api.tavily.com/extract` (mismo header `Authorization: Bearer`) recibe las URLs y devuelve el texto de la página:

```json
{
  "urls": ["https://fuente.example/informe"],
  "query": "cifra reciente mercado solar",
  "chunks_per_source": 3,
  "extract_depth": "basic",
  "format": "markdown"
}
```

- `query` (opcional pero recomendado) — reordena los fragmentos devueltos según su relevancia con lo que buscas, así el dato aparece arriba.
- `chunks_per_source` — cuántos fragmentos por URL (1–5).
- `format: "markdown"` — el texto llega con encabezados y listas, más fácil de citar.
- `extract_depth` — `basic` (1 crédito) vs `advanced` (2, para páginas difíciles). Aquí `basic`.
- `timeout` — segundos que Tavily espera por la página (aquí `10`), además del `AbortSignal.timeout(12 s)` del cliente. Doble defensa para que una página lenta no cuelgue el análisis.

Ojo con la respuesta, que tiene **dos** trampas:

- `raw_content` es el texto real de la página. En este repo se lee `results[0].raw_content`, se recorta a `MAX_CONTENIDO_EXTRAIDO` (6000 caracteres) y se pasa al validador: **nunca llega al cliente**.
- **Un 200 no significa que extrajo.** Cada entrada de `failed_results` es una URL que no se pudo extraer. Hay que revisar **los dos** arreglos, no solo el status HTTP.

**Cómo se elige el resultado.** Antes se tomaba `results[0]` a ciegas. Ahora `elegirCandidatos` (en `src/lib/tavily.ts`) filtra por `estaExcluido(url)` (dominios de `DOMINIOS_EXCLUIDOS`), descarta los que no traen URL, exige un `score` mínimo (`SCORE_MINIMO`) y ordena por score descendente; luego se prueban **hasta `MAX_CANDIDATOS`** por punto (si el elegido no pasa la validación, se intenta el siguiente). Criterio simple, documentado y testeado: no es "el primero que devolvió Tavily", es "el primero con score suficiente y dominio no excluido".

> **Nota de costos.** Extract **no** reemplaza al `content` de Search: lo profundiza. Search da un extracto corto que puede no incluir la cifra; Extract trae la sección donde vive el dato. Por eso van los dos, y por eso el rate limit de la ruta es más bajo (§5).

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

El código lee `data.results`, los filtra por dominio excluido, los ordena por `score` y **no** se queda con `results[0]` a ciegas: prueba hasta `MAX_CANDIDATOS` por punto y solo usa el que pasa la validación. Además, el `content` de Search es solo un extracto: la cifra suele estar más abajo, en la página completa — para eso se corre `/extract` sobre la URL elegida (§4.1).

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
      (solo los 2 primeros puntos, en el ORDEN DE LA RÚBRICA, corren el pipeline completo)
→ 200 { sugerencias: [{ punto, query, cifra, cita, fecha, titulo, url, frase }] }
→ 400 { error }   solo si el body no es JSON válido
→ 429 { error }   rate limit por IP (5 req / 10 min, en memoria) + Retry-After
```

Único caso en que esta ruta no es best-effort: el **429**, que se decide antes de llamar a Tavily y protege tu cuota. En memoria, así que el límite efectivo se multiplica por el número de instancias.

El techo de esta ruta es **la mitad del global** (5 contra 10 por ventana de 10 min). No es arbitrario: cada invocación dispara una **cadena completa por punto fallido** —1 query al modelo (`rapido`), 1 búsqueda de Tavily (1 crédito), hasta 2 `extract` (1 crédito cada uno) y 1 validación (`rapido`)— más 1 extracción de entidades y 1 frase (`rapido`) si algo pasó. Ese 5 no se multiplica por todos los puntos: el pipeline completo se corta en los **2 primeros puntos de la rúbrica** del tipo (`MAX_PUNTOS_ENRIQUECIDOS`), elegidos en el orden en que aparecen; los puntos fallidos restantes **no generan ninguna llamada externa**. El techo real por invocación es 1 + 2 × 6 = **~13 llamadas externas**, no ~31. Por eso el techo global de 10 no sirve: el peor caso por IP y ventana vaciaría el free tier de Tavily (~1000 créditos/mes) en horas. Si llevás esta feature a otro repo, ajustá el número a tu presupuesto, pero no le dejes el techo global sin mirar el costo por invocación.

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
- Render condicional: `sugerencias.length === 0` muestra "Sin sugerencias verificadas por ahora." y no la sección; cada sugerencia se renderiza como `punto` + `cifra` + `fecha` + `cita` + enlace "Fuente" (`target="_blank" rel="noreferrer"`), y un botón **"Escuchar el dato"** que manda la `frase` por la misma API de TTS de la sesión (`ReproductorVeredicto`, sin autoplay).

---

## 7. Cómo portarlo a otro proyecto (pasos)

### Paso 1 — Variables

Crea `.env.local` (gitignored) y `.env.example` (commiteable) con la key de la sección 3. Obtén la key en el [dashboard de Tavily](https://app.tavily.com/).

### Paso 2 — Cliente genérico

Copia el bloque de la sección 8.1. Cambia el tipo `SugerenciaFuente`, el texto con el que armas la `query` y qué campo usas de "clave" (aquí era un punto de rúbrica; en tu producto puede ser una sección faltante, un claim sin respaldo, etc.). No toques: lectura de env, headers, manejo de `!res.ok`, ni el patrón **Extract → validación → frase** (es lo que evita mostrar fuentes sin el dato).

### Paso 2 bis — Verificación (Extract + validación)

Copia el bloque de la sección 8.1 bis. Cambia el esquema de validación a tu criterio de "dato útil" (aquí: cifra concreta citada textualmente). Si no vas a usar modelo para validar, al menos exige una verificación determinista antes de mostrar la fuente: el error más caro es presentar como "dato" una página que solo explica metodología.

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
  -d '{"query":"cifra reciente mercado LATAM 2026","search_depth":"basic","max_results":6,"language":"es","filter_by_language":true,"time_range":"year"}'

# y el extract sobre la URL elegida
curl -sS -X POST "https://api.tavily.com/extract" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://fuente.example/informe"],"query":"cifra reciente mercado LATAM","chunks_per_source":3,"format":"markdown"}'
```

Si ves un `results` con `url` y `content`, el contrato está bien. Luego prueba `$TAVILY_API_KEY=` vacío (o un valor inválido) y confirma que tu route responde `{ "sugerencias": [] }` y que tu UI no crashea.

---

## 8. Código genérico para copiar

### 8.1 Cliente server (`src/lib/tavily.ts`, adaptado)

Usa `Authorization: Bearer` (ver callout de la sección 4). `buscarEnTavily` es el núcleo 100 % portable; `sugerirFuentes` es el patrón "paralelo + aislado" con la query de tu dominio y **valida antes de mostrar**.

```ts
export interface SugerenciaFuente {
  /** Qué querías reforzar (tu "clave": punto, sección, claim…). */
  clave: string;
  query: string;
  /** La cifra concreta, citada textualmente de la fuente. */
  cifra: string;
  cita: string;
  fecha: string;
  titulo: string;
  url: string;
  /** Frase lista para decir en voz alta, con la cifra y la fuente. */
  frase: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

/** Dominios que en la práctica dan metodología sin cifras. */
const DOMINIOS_EXCLUIDOS = ["fastercapital.com", "quora.com", "reddit.com"];

/** Busca en Tavily y devuelve los resultados ya ordenados por relevancia.
 *  Lanza si no hay key o si la API responde mal — el caller decide si
 *  eso importa (en este patrón: no, es best-effort). */
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
      // El filtro duro de idioma: `language` solo sesga el ranking.
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

/** Trae el contenido de la fuente elegida, priorizando los fragmentos
 *  relevantes a lo que buscas. `/search` solo da un extracto; el dato
 *  suele estar más abajo. */
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

/** Criterio de selección: descarta dominios excluidos, exige score mínimo
 *  y ordena por score. No es `results[0]` a ciegas. */
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

/** Para cada "brecha" (algo que a tu análisis le faltó respaldar), arma una
 *  query, elige una fuente, verifica su contenido y solo entonces sugiere.
 *  Best-effort: si algo falla para una brecha, esa brecha no trae
 *  sugerencia — no tumba el resto. */
export async function sugerirFuentes(
  brechas: { clave: string; detalle?: string }[],
  tema: string
): Promise<SugerenciaFuente[]> {
  const sugerencias: SugerenciaFuente[] = [];

  await Promise.all(
    brechas.map(async ({ clave }) => {
      // Sin el comentario negativo del análisis: pide el dato, no la carencia.
      const query = `cifra reciente ${tema} ${clave}`.trim();
      try {
        const candidatos = elegirCandidatos(await buscarEnTavily(query));

        for (const candidato of candidatos) {
          const contenido = await extraerContenido(candidato.url, query);
          if (!contenido) continue;

          // Validación obligatoria: ¿trae una cifra citable Y relevante al
          // tema? El tema y la clave van como contexto de comparación; una
          // cifra real de otro sector debe rechazarse.
          const validacion = await validarConModelo(contenido, [tema, clave]); // nivel "rapido"
          if (!validacion.util) continue;

          sugerencias.push({
            clave,
            query,
            cifra: validacion.cifra,
            cita: validacion.cita,
            fecha: validacion.anio,
            titulo: candidato.title,
            url: candidato.url,
            frase: await generarFrase({ clave, ...validacion }), // nivel "rapido"
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

`validarConModelo` es una llamada al modelo con un **esquema restringido** (`additionalProperties: false`) que devuelve `{ util, relevante, cifra, cita, anio }`: `util` solo es `true` si `cifra` y `cita` vienen no vacías **y** `relevante` es `true` (el modelo confirma que la cifra corresponde a las entidades del pitch). `relevante` es obligatorio: si falta, se asume `false`. Si el modelo falla, se trata como `util: false` (degradación, no excepción). `generarFrase` produce la frase hablada; si el modelo falla, hay una **frase determinista** de respaldo armada con la cifra y la fuente. El detalle de los esquemas está en `src/lib/validar-sugerencia.ts`.

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
tavily.ts  (TAVILY_API_KEY solo aquí)
  1) entidades-tavily.ts: extrae ≤3 entidades cortas (nivel "rapido")
  2) elegirPuntosAEnriquecer: solo los 2 primeros puntos de la rúbrica
     del tipo, en su orden (el resto no genera llamadas)
  3) por cada punto elegido (en paralelo, cada uno con su try/catch):
       query-tavily.ts   → query orientada a cifra (nivel "rapido"),
                           SIN el comentario negativo; entidad ambigua
                           nunca viaja sola; fallback determinista
       buscarEnTavily    → /search (language + filter_by_language,
                           exclude_domains, topic, time_range=year)
       elegirCandidatos  → filtra/ordena por score (no results[0] ciego)
       tavily-extract.ts → /extract sobre el candidato
       validar-sugerencia.ts → validación obligatoria (nivel "rapido")
                           ¿trae cifra citable Y relevante al tema?
                           (recibe las entidades del pitch como contexto)
                           si no → descarta
       generarFraseHablada   → frase 8–12 s (nivel "rapido")
       diarioPunto       → console.info: query final + aprobado/motivo
                           (NUNCA transcripción ni contenido extraído)
        │
        ▼
DashboardResultado → sección "Datos que podrían reforzar tu pitch"
  render: punto + cifra + fecha + cita + <a href={url}>Fuente</a>
          + "Escuchar el dato" (misma voz TTS de la sesión)
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
- [ ] `search_depth: "basic"` y `max_results` suficiente para poder elegir (¿6 sirve?).
- [ ] `include_answer: false` a menos que quieras la respuesta redactada del LLM.
- [ ] `language` + `filter_by_language` juntos si necesitas el idioma de verdad (con `language` solo, llegan fuentes en otro idioma).
- [ ] `exclude_domains` con los dominios que ya te dieron metodología sin cifras.
- [ ] Elección del resultado por score/dominio, no `results[0]` ciego.
- [ ] `POST /extract` sobre la fuente elegida y **validación obligatoria** antes de mostrar (sin cifra citada **o con una cifra ajena al tema** → se descarta; pásale las entidades del pitch como contexto).
- [ ] La validación confirma además la **relevancia** (la cifra pertenece al tema/sector, no solo "hay un número").
- [ ] El `content` extraído **no** se manda al cliente; solo la cifra, la cita recortada y el enlace.
- [ ] Frase hablada reproducible con tu TTS de sesión (o un fallback determinista).
- [ ] Log de diagnóstico (query + veredicto) sin transcripción ni contenido extraído.
- [ ] Cliente tolera `[]` y no bloquea el render principal.
- [ ] Nada con prefijo `NEXT_PUBLIC_` para la key.

---

## 11. Referencia rápida

| Concepto | Valor en este repo |
|---|---|
| SDK | Ninguno (`fetch` + REST) |
| Base URL | `https://api.tavily.com` |
| Métodos | `POST /search` y `POST /extract` |
| Auth | Repo: key en el body. **Hoy**: `Authorization: Bearer` |
| `search_depth` | `basic` |
| `max_results` | `6` |
| `include_answer` | `false` |
| Idioma | `language` (sesión) + `filter_by_language: true` |
| Todos los resultados | `elegirCandidatos`: dominio no excluido + `score ≥ SCORE_MINIMO`, ordenados, hasta `MAX_CANDIDATOS` |
| `exclude_domains` | `DOMINIOS_EXCLUIDOS` (FasterCapital, Quora, Reddit, agregadores…, proxies de traducción como `translate.goog`) |
| Extract | `/extract` con `query` + `chunks_per_source: 3`, `format: "markdown"` |
| Validación | obligatoria, nivel `rapido`, esquema restringido `{ util, relevante, cifra, cita, anio }`; sin cifra citada **o sin relevancia confirmada** → descarta |
| Frase hablada | nivel `rapido`, 8–12 s, con fallback determinista |
| Forma de la sugerencia | `{ punto, query, cifra, cita, fecha, titulo, url, frase }` |
| Diagnóstico | `console.info` con query + veredicto; nunca transcripción ni contenido |
| Techo de puntos | `MAX_PUNTOS_ENRIQUECIDOS` = 2 (orden de rúbrica); el resto no llama |
| Aislamiento | `Promise.all` + `try/catch` por punto |
| Sin key / fallo | `200 { sugerencias: [] }` (degradación silenciosa) |
| Solo JSON inválido | `400` |

Fuente de verdad del cliente: [`src/lib/tavily.ts`](../src/lib/tavily.ts), [`src/lib/query-tavily.ts`](../src/lib/query-tavily.ts), [`src/lib/tavily-extract.ts`](../src/lib/tavily-extract.ts), [`src/lib/validar-sugerencia.ts`](../src/lib/validar-sugerencia.ts) y [`src/app/api/enriquecer/route.ts`](../src/app/api/enriquecer/route.ts).
