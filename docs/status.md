# Pitch Coach — Status del proyecto

> **2026-09-30.** Qué está implementado, mapeado a `docs/alcance.md`.
> El loop (voz → análisis → dashboard + veredicto a pedido) está cerrado.
> El STT es universal (MediaRecorder + Scribe). Resolver hallazgos, Análisis
> Ultra y el panel "Tu progreso" están implementados; la verificación del
> micrófono en cada navegador queda para el mantenedor.
> El **modo bilingüe (es / en)** está completo: interfaz, rúbricas, prompts,
> contrato de API, voz (TTS y hint de Scribe) y muletillas (§15 del alcance).
> El **avatar reactivo y su motor de reacciones fueron eliminados**: el flujo
> grabar → transcribir → analizar no produce resultados intermedios sobre los
> que reaccionar. Hoy el coach es un **indicador de texto** temporal; el
> reemplazo visual (esfera) llega en la fase de UX/UI.
> **Tavily (fases A y B) completo**: auth por header `Bearer`, extracción de
> entidades cortas (nivel `rapido`), query orientada a cifra (sin el comentario
> negativo de la Fase A) y `exclude_domains` para los dominios metodológicos
> conocidos, más `language` / `filter_by_language` / `topic` / `time_range` en
> la búsqueda. Una sugerencia **solo se muestra si pasa un paso de validación
> obligatorio** (Tavily Extract + nivel `rapido`) que exige una cifra concreta
> citada con su fuente, y se entrega con una **frase hablada** lista para decir
> en voz alta (misma voz TTS de la sesión). Ver la evidencia real en
> `docs/guia-integracion-tavily.md` (§2).

## Resumen rápido

- ✅ Loop voz → transcripción → muletillas (MediaRecorder + Scribe).
- ✅ Indicador de estado del coach (§5.1): texto (`Escuchando…` /
  `Transcribiendo…` / 3 frases al terminar) en el idioma de la sesión. Temporal.
- ✅ Deploy: `Dockerfile` + `railway.toml`.
- ✅ Análisis con dos proveedores: **Nebius** (por defecto) y **Gemini**
  (contingencia manual). Rúbricas, prompt parametrizado por idioma, tiempo como
  contexto, JSON estructurado, fallbacks y reintentos.
- ✅ Dashboard: score, rúbrica, muletillas, transcripción resaltada, tiempo.
- ✅ TTS: ElevenLabs vía `/api/tts`, fallback a SpeechSynthesis.
  **Sin autoplay** — el usuario pulsa "Escuchar veredicto".
- ✅ Tavily (§12): `/api/enriquecer` si hay puntos sin cumplir. Auth por
  `Authorization: Bearer` (la key no va en el body). La query se arma con
  entidades cortas del pitch + el nombre visible del punto (nivel `rapido`),
  **sin repetir el comentario negativo** que produjo resultados inútiles en las
  pruebas manuales; los dominios metodológicos conocidos —y los proxies de
  traducción automática (`translate.goog` y similares)— se excluyen con
  `exclude_domains`. La búsqueda viaja con `language` + `filter_by_language`,
  `topic` (`finance` para capital) y `time_range=year`. Sobre la mejor fuente
  se corre **Tavily Extract** y un **paso de validación obligatorio**: sin una
  cifra concreta citada con su fuente **y relevante al tema/sector del pitch**
  (el validador recibe las entidades como contexto de comparación), la
  sugerencia se descarta. Cuando pasa,
  se agrega una **frase hablada** (8–12 s) en el idioma de la sesión, lista para
  decir. El pipeline completo solo corre para los **2 primeros puntos de la
  rúbrica** del tipo de pitch, en su orden; los puntos fallidos que quedan fuera
  no generan ninguna llamada externa. Sin key, el dashboard no se rompe.
- ✅ Sentry: errores de servidor y de cliente, con filtro de privacidad (§5).
  **Session Replay deshabilitado a propósito**; **la IP del cliente no se
  reporta** y **los breadcrumbs de consola no salen** (fuga real, cerrada).
  Camino de error del cliente verificado en Chrome.
- ✅ Tests unitarios (`npm test`, vitest) sobre la lógica de `src/lib/`
  (incluido el historial local) y las rutas de análisis/sparring/transcribir
  (fetch mockeado; sin llamadas reales a proveedores).
- ✅ Límites: transcripción máx. 8000 caracteres; audio máx. 20 MB; respuesta
  de sparring máx. 2000; rate limit por IP en memoria, **con techo por ruta**
  (10 / 10 min; `/api/enriquecer`, 5 / 10 min, por su costo por invocación).
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
- ✅ **Modo bilingüe (es / en)**: selector en la home, diccionarios tipados,
  rúbricas con ids estables, mensajes de error de la API en el idioma pedido,
  prompts que instruyen la salida en ese idioma, par de voces TTS por idioma,
  hint de Scribe y muletillas en inglés. El idioma se recuerda en este
  navegador y, si no hay ninguno guardado, sale del navegador.
- 🟡 La transcripción no es en vivo (grabar → detener → transcribir). Scribe
  Realtime queda para el rediseño de UX; no hay fecha de calendario.
- 🟡 El coach es **solo texto**. La animación (tipo esfera) que reemplaza al
  avatar se define en la fase de UX/UI; no hay fecha de calendario.

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
| ✅ | Transcripción (§9) | `GrabadorVoz.tsx` + `/api/transcribir` | ElevenLabs Scribe (`scribe_v2`); hint `language_code` = idioma de la sesión (`es` o `en`); `timestamps_granularity=word`; sin palabra por palabra en vivo |
| ✅ | Guion descargable | `guion-transcripcion.ts` + `DashboardResultado.tsx` | `.txt` con `[mm:ss.cc]` por frase; solo si Scribe mandó `start`; no se persiste en el historial |
| ✅ | Muletillas (§8) | `src/lib/muletillas.ts` | español: 21 patrones (`PATRONES_MULETILLAS`). inglés: `patronesMuletillas("en")`. `like` / `so` / `right` no se marcan por la palabra suelta |
| ✅ | UI | `src/app/page.tsx` | selectores + grabador + `DashboardResultado` |
| 🟡 | Indicador de estado del coach (§5.1) | `GrabadorVoz.tsx` + `mensajes-coach.ts` | texto simple: `Escuchando…` al grabar, `Transcribiendo…` mientras responde Scribe y, al terminar, una de las 3 frases de `MENSAJES_ASINTIENDO` (idioma de la sesión). Aplica al pitch y a "Resolver hallazgos". Temporal: el reemplazo visual (esfera) es de la fase de UX/UI, sin fecha |
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
| ✅ | API `transcribir` | `elevenlabs.ts` + `/api/transcribir` | Scribe batch; `language_code` del idioma de la sesión; `timestamps_granularity=word`; `ELEVENLABS_SCRIBE_MODEL` solo elige el modelo; audio en memoria; 200 `{ texto, palabras }`; 400 / 413 / 429 / 502 genérico; timeout 60 s |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | par de Voice IDs según idioma (sin sufijo en es, `_EN_` en en); el género de sesión no cambia. Veredicto y Resolver hallazgos comparten `/api/tts`. timeout 6 s; 413/429; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `query-tavily.ts` + `tavily-extract.ts` + `validar-sugerencia.ts` + `entidades-tavily.ts` + `/api/enriquecer` | best-effort; timeouts propios (búsqueda 8 s, Extract 12 s). Auth `Authorization: Bearer` (la key no viaja en el body). Extrae hasta 3 entidades cortas (máx. 40 caracteres, nivel `rapido`) y arma la query con ellas + el nombre visible del punto **sin el comentario negativo**; una entidad ambigua (sigla/marca de una palabra) nunca viaja sola. Una llamada al modelo (`rapido`) puede reescribir la query orientándola a cifra; si falla, cae a la query determinista. La transcripción **nunca** se envía a Tavily. Búsqueda localizada: `language` + `filter_by_language`, `exclude_domains` (dominios metodológicos conocidos **y proxies de traducción automática como `translate.goog`**), `topic` (`finance` si es `capital`, `general` en el resto) y `time_range=year`. Criterio de selección documentado (`SCORE_MINIMO`, tope de candidatos) en vez de `results[0]` ciego; sobre el elegido se corre **Tavily Extract** y una **validación obligatoria** (nivel `rapido`, esquema restringido con `additionalProperties: false`) que exige cifra citada **y confirma su relevancia al tema** (campo `relevante`: compara la cifra contra las entidades del pitch, así una cifra real de otro sector se descarta); solo entonces se genera la **frase hablada** (nivel `rapido`). Los fallos de la validación se registran en un **log de diagnóstico sin PII** (query final + si aprobó), nunca la transcripción ni el contenido extraído |
| ✅ | Límites | `src/lib/limites.ts` + `src/lib/rate-limit.ts` | transcripción máx. 8000; audio máx. 20 MB; respuesta sparring máx. 2000; rate limit por IP en memoria (por instancia) con techo por ámbito: 10 / 10 min por defecto y **5 / 10 min en `/api/enriquecer`** (`LIMITES_POR_AMBITO`). El techo más bajo sigue al costo: cada invocación dispara 1 llamada a Nano (entidades) y, por cada punto fallido, hasta 1 query al modelo + 1 búsqueda de Tavily + hasta 2 Extract + 1 validación + 1 frase. El pipeline completo solo corre para los `MAX_PUNTOS_ENRIQUECIDOS` (2) primeros puntos de la rúbrica del tipo, en su orden: el resto no genera llamadas externas. Techo real por invocación: 1 + 2 × 6 = **~13 llamadas externas** contra 1 del resto de las rutas. Verificado por test (incluido el techo de puntos): el de `enriquecer` no afecta al de las demás rutas |
| ✅ | Historial local | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | clave `pitch-coach:historial-sesiones`; últimas 20; FIFO. Campos: fecha, tipo, duración, score, claridad (reconstruida del score), rúbrica `{punto, cumplido}`, conteo de muletillas, `ultraUsado`, y —si se completó— hallazgos `{preguntasHechas, puntosReforzados, puntos: [{punto, cumplido}]}`. Ultra no guarda score ni rúbrica propios |
| ✅ | Panel "Tu progreso" | `PanelProgreso.tsx` | enlace en la página principal; lista reciente primero (fecha, tipo, score, cobertura `n/5`, Ultra, hallazgos); "Borrar historial" con `confirm()` |
| ✅ | Modo bilingüe (§15) | `src/lib/idiomas.ts`, `src/lib/diccionario-es.ts`, `src/lib/diccionario-en.ts`, `src/lib/diccionarios.ts`, `ProveedorIdioma.tsx`, `SelectorIdioma.tsx` | registro de idiomas + diccionarios tipados + contexto de React. `en` está tipado contra la forma de `es`; un test compara las dos formas clave por clave. Idioma inicial: `localStorage` → `navigator.language` (`es*` → es) → es |
| ✅ | `<html lang>` sin parpadeo | `layout.tsx` + `src/lib/idiomas.ts` | script en el `<head>` fija el atributo antes del primer paint; el proveedor arranca con el mismo idioma por defecto que el servidor (sin warning de hidratación) y lo corrige en un layout effect. La home sigue estática |
| ✅ | Ids estables de rúbrica | `src/lib/rubricas.ts` | 4 tipos × 5 puntos, cada uno con `id` estable + nombre y "qué buscar" por idioma. El id es lo único que viaja por la API y lo que se persiste; el modelo nunca lo ve. Verificados por un test que fija la lista |
| ✅ | Historial con ids e idioma | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | cada sesión guarda los **ids** de sus puntos y el `idioma`. Las entradas viejas (nombre en español, sin idioma) se normalizan sin romper: nombre → id, idioma → `es`. La continuidad solo usa sesiones del mismo tipo **y** idioma |
| ✅ | Mensajes de error por idioma | `src/lib/idioma-ruta.ts` + `src/lib/rate-limit.ts` + `src/lib/diccionarios.ts` | todas las rutas aceptan `idioma` (`'es' \| 'en'`; ausente → `'es'`; otro → 400) y responden 400/413/429/502 en ese idioma. El 429 usa la cabecera `X-Idioma` porque el rate limit corre antes de leer el cuerpo |
| ✅ | Prompts por idioma | `src/lib/prompts.ts`, `src/lib/prompts-sparring.ts`, `src/lib/validar-analisis.ts`, `src/lib/validar-sparring.ts` | un constructor por idioma (análisis estándar, Ultra con traza y sparring) y descripciones del esquema también por idioma: son instrucciones, es donde se le dice al modelo en qué idioma escribir. Delimitadores, esquema restringido y score siguen igual |

### Muletillas (21 patrones)

- **Base (§8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Oratoria (11):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin",
  "entonces", "¿me explico?", "a ver".
- **Umbral ≥3 (2):** **"pues"** y **"bueno"** (no se reportan ni se resaltan
  con menos de 3 apariciones).
- El patrón de "eeee / ehh" sigue; depende de que Scribe transcriba el relleno.
  Lo mismo pasa con "um" / "uh" en inglés.

### Muletillas en inglés

`patronesMuletillas("en")`. Claras: "um", "uh", "you know", "I mean",
"actually", "basically", "kind of" / "sort of". "you know" puede coincidir con
una pregunta real ("do you know"); se acepta, igual que "este" en español.

"like", "so" y "right" **no** se marcan por la palabra suelta:

- **like**: inicio de cláusula o entre comas ("Like,", ", like,"), repetido
  ("like like"), o seguido de um/uh. "I like the product" no entra.
- **so**: inicio de cláusula salvo "so that/much/many/far/on", entre comas, o
  repetido. "and so on" y "so big" no entran.
- **right**: solo "right?" o ", right," / ", right.". "right now" y "the right
  market" no entran.
- **well**: inicio de cláusula o tras coma. "as well" y "well-known" no entran.

El resaltado marca la palabra, no la coma que la precede.

## 2. Abierto para la comunidad

| Ítem | Notas |
|---|---|
| Historial entre dispositivos o cuentas | El progreso queda en el `localStorage` de este navegador. No hay cuentas ni sincronización. |
| Rúbricas custom | Hoy son 4 rúbricas fijas, en español e inglés. Editarlas o crear propias sigue abierto. |
| Animación del coach (esfera) | Hoy el coach es solo texto (§5.1). La animación que lo reemplace se define en la fase de UX/UI; no hay fecha de calendario. |
| Idiomas nuevos | Agregar uno debería ser agregar datos en el registro, un diccionario, un par de Voice IDs y patrones de muletillas; hoy solo hay es y en. |
| STT en vivo (Scribe Realtime) | Esta fase transcribe el clip completo al detener. No tiene fecha de calendario. |

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
- `ELEVENLABS_API_KEY` — TTS y STT (Scribe). Sin API key, el STT falla y hay texto de respaldo; el veredicto cae a SpeechSynthesis.
- `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` — par de voces en español.
- `ELEVENLABS_VOICE_ID_EN_MALE`, `ELEVENLABS_VOICE_ID_EN_FEMALE` — par de voces en inglés. Sin ellas, el TTS en inglés falla y el cliente cae a SpeechSynthesis. El género de la sesión no cambia de par.
- `ELEVENLABS_SCRIBE_MODEL` — modelo batch de Scribe (default `scribe_v2`). No elige idioma: el hint es `language_code` (`es` o `en`), y si se omitiera Scribe autodetectaría.
- `TAVILY_API_KEY` — sugerencias; sin ella, esa sección no aparece

Prueba de humo manual contra Nebius real (fuera de vitest, la ejecuta el
mantenedor con su clave): `scripts/smoke-nebius.mjs`. Corre el mismo pitch en
tres niveles de calidad (fuerte / medio / débil) y comprueba que el evaluador los
ordene; con `--lang en` eso mismo sobre transcripciones en inglés, para ver si
distingue calidad igual que en español. Consume cuota (una petición por fixture).

```
node scripts/smoke-nebius.mjs --lang en
node scripts/smoke-nebius.mjs --lang en --ultra
node scripts/smoke-nebius.mjs --lang en --fixture debil
```

**No ejecutada todavía**: la Parte A no toca al proveedor, así que la corrida real
en inglés queda para el mantenedor.

## 4. Notas técnicas

- Correr: `npm run dev` (sin Docker). Cualquier navegador moderno con micrófono.
- Red: Scribe, el modelo, ElevenLabs TTS y Tavily necesitan internet.
  SpeechSynthesis cubre el veredicto si el TTS falla; el texto de respaldo
  cubre el STT si no hay micrófono o falta la key.
- Tests: `npm test` (vitest; `src/lib/` y rutas de análisis/sparring/transcribir
  con fetch mockeado). El loop con micrófono se verifica a mano.
- Timeout del modelo: 20 s en `estandar`/`rapido`, 90 s en `ultra` (razonamiento).
- **Decisión de rate limit (Fase B)**: `/api/enriquecer` sigue en **5 / 10 min
  por IP** (el global se queda en 10). Razón explícita (y el motivo de que **no**
  se baje más): cada invocación ya no cuesta una o dos llamadas, cuesta **una
  cadena completa por punto fallido** —1 query al modelo (`rapido`), 1 búsqueda
  de Tavily a 1 crédito con `search_depth: "basic"`, hasta 2 `extract`, 1
  llamada de validación (`rapido`) y 1 de frase (`rapido`)— más 1 extracción
  de entidades. Ese techo no se multiplica por todos los puntos: el pipeline
  completo solo corre para los `MAX_PUNTOS_ENRIQUECIDOS` (2) primeros puntos de
  la rúbrica del tipo, en su orden, y el resto no genera ninguna llamada
  externa. El techo real por invocación es 1 + 2 × 6 = **~13 llamadas externas**,
  contra 1 del resto de las rutas. Con el techo global de 10, el peor caso por IP y ventana
  se multiplica por ~5 y el free tier de Tavily (~1000 créditos/mes) se agota en
  horas de abuso; con 5 el costo por ventana queda comparable al del resto. Se
  centraliza en `LIMITES_POR_AMBITO` (`src/lib/rate-limit.ts`) y hay test de que
  el techo de `enriquecer` no afecta al de las otras rutas. Si en el futuro se
  agrega otra ruta de costo múltiple, el override va ahí, no en la ruta.
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
- **El camino de error de `/api/enriquecer` está cerrado, probado en este flujo y
  no supuesto** (`test/enriquecer-privacidad.test.ts`). Se provoca el doble
  fallo —extracción (Nano) y Tavily— con errores que arrastran la transcripción,
  y se verifica en el flujo real de la ruta: la respuesta al cliente no lleva la
  transcripción; el payload que va a `captureException` (mensaje, stack, extra,
  tags) tampoco; y el error crudo que la ruta sí escribe en consola —el vector de
  breadcrumb de consola, el mismo que se cerró para ElevenLabs— se pasa por el
  `beforeSend` REAL del proyecto y el breadcrumb se descarta. Nota de cobertura:
  el reporte a Sentry de esta ruta solo se alcanza por el catch externo (los
  fallos del proveedor se tragan adentro por diseño best-effort), así que el test
  fuerza ese catch con un `ErrorModelo` con el cuerpo del proveedor en el
  `message`, que es la forma real de `src/lib/proveedor-nebius.ts`.
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
