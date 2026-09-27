# Pitch Coach — Status del proyecto

> **2026-09-27.** Qué está implementado, mapeado a `docs/alcance.md`.
> El loop (voz → análisis → dashboard + veredicto a pedido) está cerrado.
> El STT es universal (MediaRecorder + Scribe). Resolver hallazgos, Análisis
> Ultra y el panel "Tu progreso" están implementados; la verificación del
> micrófono en cada navegador queda para el mantenedor.

## Resumen rápido

- ✅ Loop voz → transcripción → muletillas (MediaRecorder + Scribe).
- ✅ Avatar (§5.1): escucha durante la grabación y asiente al terminar.
- ✅ Deploy: `Dockerfile` + `railway.toml`.
- ✅ Análisis con dos proveedores: **Nebius** (por defecto) y **Gemini**
  (contingencia manual). Rúbricas, prompt en español, tiempo como contexto,
  JSON estructurado, fallbacks y reintentos.
- ✅ Dashboard: score, rúbrica, muletillas, transcripción resaltada, tiempo.
- ✅ TTS: ElevenLabs vía `/api/tts`, fallback a SpeechSynthesis.
  **Sin autoplay** — el usuario pulsa "Escuchar veredicto".
- ✅ Tavily (§12): `/api/enriquecer` si hay puntos sin cumplir. Sin key,
  el dashboard no se rompe.
- ✅ Sentry: errores de servidor y de cliente, con filtro de privacidad (§5).
  **Session Replay deshabilitado a propósito**; **la IP del cliente no se
  reporta** y **los breadcrumbs de consola no salen** (fuga real, cerrada).
  Camino de error del cliente verificado en Chrome.
- ✅ Tests unitarios (`npm test`, vitest) sobre la lógica de `src/lib/`
  (incluido el historial local) y las rutas de análisis/sparring/transcribir
  (fetch mockeado; sin llamadas reales a proveedores).
- ✅ Límites: transcripción máx. 8000 caracteres; audio máx. 20 MB; respuesta
  de sparring máx. 2000; rate limit por IP en memoria.
- ✅ Análisis Ultra: botón en el dashboard que reanaliza la misma transcripción
  con nivel `ultra` (Nemotron Ultra, razonamiento activo). Se muestra además
  del análisis estándar, con una traza de razonamiento (4–8 pasos).
- ✅ Resolver hallazgos: hasta 3 preguntas de seguimiento sobre los primeros
  puntos de rúbrica no cumplidos. Texto + "Escuchar pregunta" (misma voz de
  sesión); no hay autoplay.
- ✅ Historial local: las últimas 20 prácticas se guardan en `localStorage`
  de este navegador (sin cuenta y sin servidor). El panel "Tu progreso"
  las lista. No se guardan transcripción, comentarios, traza, preguntas,
  respuestas ni audio.
- 🟡 La transcripción no es en vivo (grabar → detener → transcribir). El selector de idioma y Scribe Realtime quedan para después.

## Leyenda

- ✅ Implementado y probado en navegador
- 🟡 Implementado con limitación conocida
- ⬜ No implementado (idea abierta para la comunidad)

## 1. Implementado

| Estado | Ítem | Archivos | Notas |
|---|---|---|---|
| ✅ | Selector de tipo (§9) | `SelectorTipoPitch.tsx` | capital, educación, innovación, tecnología |
| ✅ | Selector de duración (§9) | `SelectorDuracion.tsx` | 1 a 7 minutos |
| ✅ | Grabación con corte (§9) | `GrabadorVoz.tsx` | MediaRecorder; auto-stop; texto de respaldo si no hay micrófono |
| ✅ | Transcripción (§9) | `GrabadorVoz.tsx` + `/api/transcribir` | ElevenLabs Scribe (`scribe_v2`); hint `es`; sin palabra por palabra en vivo |
| ✅ | Muletillas (§8) | `src/lib/muletillas.ts` | 21 patrones; `PATRONES_MULETILLAS` es la fuente de verdad |
| ✅ | UI | `src/app/page.tsx` | selectores + grabador + `DashboardResultado` |
| ✅ | Avatar (§5.1) | `CoachAvatar.tsx` + `reacciones.ts` + `types/coach.ts` | escucha + asiente; reacciones a texto intermedio reservadas a STT en vivo |
| ✅ | Sesión anónima | `src/app/page.tsx` | sin login. El historial vive en `localStorage` de este navegador, no en el servidor |
| ✅ | Deploy | `Dockerfile` + `railway.toml` | standalone; healthcheck `/` |
| ✅ | Rúbricas (§6) | `src/lib/rubricas.ts` | 4 tipos × 5 puntos |
| ✅ | Tipos (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` y relacionados |
| ✅ | Tiempo real (§7) | `GrabadorVoz.tsx` + `page.tsx` | contexto de Gemini + dashboard |
| ✅ | Cliente del modelo (§13) | `src/lib/modelo.ts` + adaptadores | capa neutra + fábrica por `MODEL_PROVIDER`; backoff; timeout 20 s |
| ✅ | Proveedor Nebius (por defecto) | `src/lib/proveedor-nebius.ts` | `/chat/completions` OpenAI-compatible; `json_schema` estricto (`{name, strict, schema}`); niveles `estandar` / `ultra` / `rapido`; `enable_thinking: false` en estándar y rápido; ultra omite el campo (razonamiento activo) |
| ✅ | Proveedor Gemini (contingencia) | `src/lib/proveedor-gemini.ts` | `generateContent`; se activa con `MODEL_PROVIDER=gemini` |
| ✅ | Esquema restringido | `src/lib/validar-analisis.ts` | `construirEsquemaAnalisisRestringido`: `rubrica` con `minItems === maxItems === puntos.length`; cada ítem con `additionalProperties: false` y `required: ["cumplido", "comentario"]`; Ultra añade `traza` (4–8 pasos) al esquema y la exige en validación |
| ✅ | Prompt (§7/§13) | `src/lib/prompts.ts` | español; transcripción como dato no confiable; pide rúbrica sin nombres + `claridad` + `veredicto_corto`. Si hay un intento previo del mismo tipo, el análisis principal puede mencionar solo los nombres de puntos no cubiertos |
| ✅ | API `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` | acepta `nivel` opcional (`estandar` \| `ultra` \| `rapido`); 400 / 413 / 429 / 502 (errores genéricos al cliente); Ultra comparte el mismo rate limit |
| ✅ | Dashboard | `DashboardResultado.tsx` + `dashboard-resultado.css` | incluye Tavily y botón **Análisis Ultra** |
| ✅ | Resolver hallazgos (§9) | `SparringCoach.tsx` + `/api/sparring/pregunta` + `/api/sparring/evaluar` | copy visible "Resolver hallazgos"; APIs internas siguen en `/api/sparring/*`; hasta 3 puntos no cumplidos; nivel `rapido`; escuchar a pedido; mismo grabador + texto de respaldo |
| ✅ | API `transcribir` | `elevenlabs.ts` + `/api/transcribir` | Scribe batch; audio en memoria; 400 / 413 / 429 / 502 genérico; timeout 60 s |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | timeout 6 s; 413/429; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `/api/enriquecer` | best-effort; timeout 8 s |
| ✅ | Límites | `src/lib/limites.ts` + `src/lib/rate-limit.ts` | transcripción máx. 8000; audio máx. 20 MB; respuesta sparring máx. 2000; rate limit por IP en memoria (por instancia) |
| ✅ | Historial local | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | clave `pitch-coach:historial-sesiones`; últimas 20; FIFO. Campos: fecha, tipo, duración, score, claridad (reconstruida del score), rúbrica `{punto, cumplido}`, conteo de muletillas, `ultraUsado`, y —si se completó— hallazgos `{preguntasHechas, puntosReforzados, puntos: [{punto, cumplido}]}`. Ultra no guarda score ni rúbrica propios |
| ✅ | Panel "Tu progreso" | `PanelProgreso.tsx` | enlace en la página principal; lista reciente primero (fecha, tipo, score, cobertura `n/5`, Ultra, hallazgos); "Borrar historial" con `confirm()` |

### Muletillas (21 patrones)

- **Base (§8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Oratoria (11):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin",
  "entonces", "¿me explico?", "a ver".
- **Umbral ≥3 (2):** **"pues"** y **"bueno"** (no se reportan ni se resaltan
  con menos de 3 apariciones).
- El patrón de "eeee / ehh" sigue; depende de que Scribe transcriba el relleno.

## 2. Abierto para la comunidad

| Ítem | Notas |
|---|---|
| Historial entre dispositivos o cuentas | El progreso queda en el `localStorage` de este navegador. No hay cuentas ni sincronización. |
| Rúbricas custom / más idiomas | Hoy solo español y 4 rúbricas fijas. El selector de idioma de Scribe queda para después. |
| STT en vivo (Scribe Realtime) | Esta fase transcribe el clip completo al detener. |

## 3. Variables de entorno

En `.env.local` y en el host de deploy:

- `MODEL_PROVIDER` — `nebius` (por defecto) o `gemini`.
- **Nebius** (`MODEL_PROVIDER=nebius`): `NEBIUS_API_KEY` (requerida),
  `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`),
  `NEBIUS_MODEL_ULTRA` (default `nvidia/Nemotron-3-Ultra-550b-a55b`) y
  `NEBIUS_MODEL_NANO` (default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`).
- **Gemini** (`MODEL_PROVIDER=gemini`, contingencia manual):
  `GEMINI_API_KEY` (requerida en ese modo).
- Configuración del modelo, compartida por el proveedor activo (todas
  opcionales): `MODEL`, `MODEL_FALLBACK_MODELS`, `MODEL_MAX_TOKENS`,
  `MODEL_TEMPERATURE`, `MODEL_RETRY_ATTEMPTS`, `MODEL_RETRY_DELAY_MS`,
  `MODEL_RETRY_MAX_DELAY_MS`. Los nombres `GEMINI_MODEL`,
  `GEMINI_FALLBACK_MODELS` y `GEMINI_RETRY_*` siguen funcionando como alias,
  pero **solo aplican cuando el proveedor activo es Gemini**.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` — TTS y STT (Scribe); sin Voice IDs, SpeechSynthesis. Sin API key, el STT falla y hay texto de respaldo.
- `TAVILY_API_KEY` — sugerencias; sin ella, esa sección no aparece

Prueba de humo manual contra Nebius real (fuera de vitest, la ejecuta el
mantenedor con su clave): `scripts/smoke-nebius.mjs`.

## 4. Notas técnicas

- Correr: `npm run dev` (sin Docker). Cualquier navegador moderno con micrófono.
- Red: Scribe, el modelo, ElevenLabs TTS y Tavily necesitan internet.
  SpeechSynthesis cubre el veredicto si el TTS falla; el texto de respaldo
  cubre el STT si no hay micrófono o falta la key.
- Tests: `npm test` (vitest; `src/lib/` y rutas de análisis/sparring/transcribir
  con fetch mockeado). El loop con micrófono se verifica a mano.
- Timeout del modelo: 20 s en `estandar`/`rapido`, 90 s en `ultra` (razonamiento).
- `.env.local` no se commitea. `.env.example` sí, sin valores.

## 5. Sentry (monitoreo de errores)

Integrado en los tres runtimes: Node, Edge y navegador. Los errores de las
rutas de API se reportan con un **resumen sanitizado**, nunca con el error
crudo; los de render del cliente, con los error boundaries del App Router
(`src/app/error.tsx` y `src/app/global-error.tsx`).

**Qué NO llega a Sentry.** La regla es la misma que ya se aplicó al historial
local: lo sensible no se persiste ni se envía, aunque cueste funcionalidad.

- La **transcripción** del pitch.
- El campo **`comentario`** de cualquier rúbrica (principal, Ultra, o de un
  turno de "Resolver hallazgos").
- El campo **`traza`** del Análisis Ultra.
- La **`pregunta`** y la **`respuesta`** de un turno de hallazgos.
- El **`veredicto`** y el **`veredicto_corto`**.
- **Audio** en cualquier forma.
- La **IP del cliente**. La app es de sesión anónima, así que la IP era el
  único identificador de cliente que podía colarse; ya no se reporta. Salía por
  cuatro canales (el usuario, las cabeceras del evento y los atributos de los
  spans); se apaga con `dataCollection` en las tres configs, más un borrado
  redundante en el filtro. El detalle, en `docs/sentry.md` §3.6.
- Los **breadcrumbs de consola**. Eran una fuga real, no teórica: el
  `console.error` de los `catch` graba el mensaje de `ErrorModelo` completo, y
  ese mensaje arrastra el cuerpo de respuesta del proveedor —que puede repetir
  la petición, con la transcripción—. Se descartan enteros en `beforeSend` y
  `beforeSendTransaction`; el resto de los breadcrumbs sigue pasando por el
  filtro. Reproducción y fix, en `docs/sentry.md` §3.7.

El filtro (`src/lib/sentry-scrub.ts`) redacta esas propiedades por nombre, en
cualquier nivel y también dentro de arrays (las rúbricas y los turnos son
arrays de objetos). Además, el error del proveedor **nunca se manda crudo**: su
mensaje puede arrastrar el cuerpo de respuesta del proveedor, que a su vez
puede repetir la petición —y con ella la transcripción—. Se envía un resumen
(tipo de error, código HTTP, proveedor, nivel) con el stack sin su primera
línea, que es la que lleva el mensaje original.

**Límite conocido:** el filtro decide por *nombre* de propiedad, no por
contenido. Un texto sensible que viaje como *valor* de una propiedad con nombre
permitido no se detecta. Por eso las rutas nunca adjuntan texto del usuario
como contexto y el error del proveedor se resume en vez de reenviarse. Si se
agrega un `extra` nuevo en alguna ruta, revisar antes esta sección.

**Verificado, capturando el sobre real** (antes eran suposiciones):

- El filtro **corre de verdad** en el pipeline de servidor: con centinelas sin
  filtrar adjuntos a propósito, el sobre real salió con `transcripcion` y
  `veredicto_corto` en `"[Filtered]"`.
- El **camino de error del cliente funciona**: un throw en `useEffect` y otro en
  render en Chrome 152 hacen que `error.tsx` muestre la UI de respaldo, y el
  evento con la excepción real llega al túnel hacia Sentry (HTTP 200).
- La IP quedó fuera en los cuatro canales.
- **`beforeSendTransaction` sí se ejecuta** ahora, y se comprobó de forma
  directa: centinelas en una transacción real salieron `"[Filtered]"`. Ese
  marcador solo lo produce el callback, así que no basta con que el SDK deje de
  avisar por consola.
- **`httpBodies` no filtra el cuerpo** de la petición: se mandó un POST real con
  la transcripción y el cuerpo no llega a Sentry por ninguna vía —ni
  `request.data`, ni atributos de span, ni breadcrumbs `http`—. Ver `§3.6.1`.
- **`genAI` es inerte por construcción** (verificado, no supuesto): instrumenta
  solo SDKs de IA reconocidos, por **paquete + versión + archivo exactos**
  (`openai`, `@google/genai`, `langchain`…), **nunca por URL ni por host**. Este
  proyecto llama a los proveedores por `fetch` crudo y no tiene ningún SDK de IA
  instalado, así que la categoría no captura nada. Confirmado además en los
  sobres: la llamada al proveedor sale como `auto.http.node_fetch` /
  `http.client`, sin ningún atributo `gen_ai.*`. Ver `docs/sentry.md` §3.6.2.
- El modo `static` **no pierde telemetría**: mismas trazas y mismos spans (36 en
  la home del navegador), solo cambia el sobre en que viajan.
- **Producción, las dos vías** (verificado en Railway el 2026-09-27): el
  servidor reporta con el resumen sanitizado, `environment: production`,
  `release` con el SHA del commit y los stack traces **desminificados** (los
  source maps suben en el build). Y el cliente reporta: llegan spans de
  navegador con `auto.pageload.nextjs.app_router_instrumentation` y se ve el
  `POST /monitoring` en DevTools. Antes de esto, el cliente no reportaba nada
  porque faltaban los `ARG NEXT_PUBLIC_*` en el `Dockerfile` — ver
  `docs/sentry.md` §6.
- **El cliente de producción ya lleva `release`.** Antes no lo llevaba: el
  release del navegador se resuelve en build-time y no llegaba nunca al build,
  mientras que el del servidor se resuelve en runtime y por eso sí aparecía —
  una asimetría que hacía parecer roto al cliente. Se arregló declarando
  `ARG RAILWAY_GIT_COMMIT_SHA` en el `Dockerfile`. Verificado en el bundle
  desplegado. Detalle y moraleja, en `docs/sentry.md` §9.14.
- **Lo único sin verificar en producción:** que los stack traces del navegador
  salgan **desminificados**. El cliente ya tiene release y los mapas suben bajo
  ese release, así que debería resolver, pero comprobarlo requiere un error real
  lanzado desde código del bundle — no alcanza con uno tirado desde la consola.
  Ojo al probar: el cliente muestrea trazas al 10%, así que cargar la página una
  vez probablemente no genere transacción; los errores no se muestrean.

> **⚠️ Trampa latente de `genAI`.** Las integraciones de IA **se registran por
> defecto** igual: son no-ops solo mientras el paquete del vendor no exista. Si
> alguien reemplaza el `fetch` crudo de `src/lib/proveedor-nebius.ts` por el
> **paquete oficial `openai`** (plausible: Nebius es compatible con esa API),
> `genAI` se activa con sus **defaults permisivos** (`inputs`/`outputs: true`) y
> el prompt —con la transcripción— empieza a viajar a Sentry **sin que nadie
> toque la privacidad**, como atributo de span, que **no pasa por `beforeSend`**.
> Si eso pasa, poner `dataCollection.genAI: { inputs: false, outputs: false }`
> **antes** del cambio.

**Siguen sin auditarse** `cookies`, `urlQueryParams` y `httpHeaders.response`:
sin evidencia de fuga, pero tampoco de lo contrario. Ver `docs/sentry.md` §3.6.3.

**Requiere tu decisión, con fecha.** `traceLifecycle` es `"static"` a propósito:
con el default (`"stream"`) el SDK **ignora** `beforeSendTransaction`, y los
eventos de transacción llevan breadcrumbs, que pueden llevar texto del usuario.
El precio es que `beforeSendTransaction` **se elimina en la v12 del SDK**: hay
que migrar a `beforeSendSpan` antes de subir a esa versión. No es urgente, pero
es una fecha. Ver `docs/sentry.md` §3.8 y §10.

**Session Replay está deshabilitado a propósito.** Graba interacciones del DOM
—incluido texto tipeado y leído—, que es exactamente el tipo de captura que
este proyecto no quiere. No activarlo sin revisar antes esta sección.

Sin `SENTRY_DSN` la app funciona igual: el SDK no envía nada.
`SENTRY_ENABLED=false` apaga el envío sin tocar código. Las variables están
documentadas en `.env.example`; la subida de source maps necesita además
`SENTRY_AUTH_TOKEN` en build-time.
