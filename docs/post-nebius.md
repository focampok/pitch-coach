# Estado post-Nebius

Documento de estado actual. Es la contraparte de [`docs/pre-nebius.md`](pre-nebius.md):
describe el repositorio **después** de la migración a Nebius Token Factory y del
ajuste del esquema restringido.

Punto de referencia: `HEAD` = commit `15902cb` ("feat(modelo): log mínimo no
sensible en la ruta de éxito"), con fecha 2026-09-25. Es el commit **19** de la
historia (`git rev-list --count HEAD`). El tag `pre-nebius` apunta a `51ddfd6`
(2026-08-30) y fue el commit 15, así que **hay 4 commits** entre el baseline y hoy
(`git rev-list --count pre-nebius..HEAD`):

```
15902cb feat(modelo): log mínimo no sensible en la ruta de éxito
ea1c55e feat(model): add Nebius Token Factory provider, standard + ultra tiers
6024240 docs: document pre-nebius baseline for the Nebius migration
c018cc6 hardening: secure, determinize and isolate the model layer before Nebius
```

El diff acumulado contra el baseline es de **38 archivos, +6502/−914**
(`git diff --shortstat pre-nebius HEAD`).

Este documento se escribió en **modo solo lectura**: no se modificó código y no se
hizo ningún commit. Todo lo que se afirma sale del código tal como está en `main`
o de comandos de git/grep reproducibles. Donde no hay evidencia, dice
**NO VERIFICADO** en lugar de afirmar.

## 1. Arquitectura del análisis (ahora)

La migración no reescribió el análisis: lo partió en tres capas con una frontera
neutra de proveedor. La API route no conoce a ningún proveedor.

**Puerta de entrada — [`src/app/api/analizar-pitch/route.ts`](../src/app/api/analizar-pitch/route.ts).**
Valida el cuerpo (`route.ts:23-38`), corta por límite de transcripción antes de
gastar cuota (`route.ts:44-46`, 413), construye el prompt (`route.ts:49-55`),
llama al caso de uso (`route.ts:58`) y compone el `ResultadoAnalisis` con las
muletillas recalculadas server-side (`route.ts:63-72`). Los errores del proveedor
se registran server-side y hacia el cliente solo sale un mensaje genérico con 502
(`route.ts:75-79`).

**Caso de uso — [`src/lib/analisis-modelo.ts`](../src/lib/analisis-modelo.ts).**
`analizarConModelo(prompt, rubrica)` (`analisis-modelo.ts:22-35`) arma la solicitud
al modelo: `system` + `user` (`:27-28`), el esquema neutro `ESQUEMA_ANALISIS`
(`:29`), los **nombres de los puntos** en `puntosRubrica` (`:32`) y la validación
`validarAnalisis` (`:33`). No sabe de Gemini ni de Nebius.

**Capa neutra — [`src/lib/modelo.ts`](../src/lib/modelo.ts).** Es la única puerta de
entrada al modelo (`modelo.ts:176-224`) y concentra toda la política que **no**
depende del proveedor: recorrido de modelos principal + fallbacks, reintentos con
backoff, timeout por intento (`TIMEOUT_MS = 20_000`, `modelo.ts:88`), clasificación
de errores transitorios (`ESTADOS_REINTENTABLES = {408, 429, 500, 502, 503, 504}`,
`modelo.ts:91`), extracción tolerante del JSON (`extraerJson`, `modelo.ts:114-130`),
parseo (`parsearRespuesta`, `modelo.ts:149-162`) y normalización de excepciones a
`ErrorModelo` (`modelo.ts:139-146`).

**Selección de proveedor — fábrica `proveedorActivo()` (`modelo.ts:71-85`).** Lee
`MODEL_PROVIDER` en cada llamada (no al importar el módulo) y devuelve el
adaptador. Si no está definida usa **Nebius** (`PROVEEDOR_POR_DEFECTO = "nebius"`,
`modelo.ts:64`); `"gemini"` sigue soportado y un valor desconocido lanza
`ErrorModelo` (`modelo.ts:80-83`). La interfaz que ambos implementan es
`ProveedorModelo` (`modelo.ts:44-58`): `nombre`, `listarModelos()` y
`enviar({ modelo, solicitud, signal })`, que devuelve **texto crudo**.

**Adaptadores (solo transporte).**

| Proveedor | Archivo | Rol |
|---|---|---|
| Nebius (por defecto) | [`src/lib/proveedor-nebius.ts`](../src/lib/proveedor-nebius.ts) | `POST {NEBIUS_BASE_URL}/chat/completions` OpenAI-compatible |
| Gemini (contingencia) | [`src/lib/proveedor-gemini.ts`](../src/lib/proveedor-gemini.ts) | `generateContent` con la key como query param |

Nebius se expone como `proveedorNebius` (nivel estándar,
`proveedor-nebius.ts:236`) y también como fábrica `crearProveedorNebius(nivel)`
(`proveedor-nebius.ts:176-233`) con dos niveles, `estandar | ultra`
(`proveedor-nebius.ts:19`).

**Esquema restringido — [`src/lib/validar-analisis.ts`](../src/lib/validar-analisis.ts).**
`construirEsquemaAnalisisRestringido(puntos)` (`validar-analisis.ts:113-149`) deriva
del esquema neutro `ESQUEMA_ANALISIS` (`validar-analisis.ts:43-74`) una variante con
longitud exacta del array de rúbrica, pensada para la salida estructurada estricta.
Solo lo usa el adaptador de Nebius, cuando el llamador aporta `puntosRubrica`
(`proveedor-nebius.ts:100-102`); Gemini sigue usando el esquema neutro tal cual.
El resultado se cachea por conjunto de puntos (`validar-analisis.ts:95` y `:147`) y
el módulo es puro: no hace I/O ni lee variables de entorno (`validar-analisis.ts:5-6`).

## 2. Contrato de salida (ahora)

**Lo que se le pide a Nebius.** El cuerpo enviado (`proveedor-nebius.ts:104-122`)
tiene `model`, `messages` separado en `system`/`user`, `temperature`, `max_tokens`,
el envoltorio de salida estructurada y, en modo estándar, el apagado del
razonamiento:

```jsonc
{
  "model": "nvidia/nemotron-3-super-120b-a12b",
  "messages": [
    { "role": "system", "content": "<instrucciones y rúbrica>" },
    { "role": "user",   "content": "<transcripción delimitada como dato no confiable>" }
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "response_format": {
    "type": "json_schema",
    "json_schema": { "name": "analisis_pitch", "strict": true, "schema": { /* restringido */ } }
  },
  "chat_template_kwargs": { "enable_thinking": false }   // solo en modo estándar
}
```

El envoltorio `json_schema` es obligatorio: el encabezado del archivo documenta que
sin él la API responde 422 (`proveedor-nebius.ts:9-12`).

**El esquema restringido que se envía** (`validar-analisis.ts:122-145`):

- Raíz: `additionalProperties: false` (`:124`) y `required: ["veredicto_corto",
  "claridad", "rubrica"]` (`:125`).
- `rubrica`: `minItems === maxItems === puntos.length` (`:132-133`) — obliga a
  exactamente un ítem por punto de la rúbrica.
- Ítems: `additionalProperties: false` (`:136`), `required: ["cumplido",
  "comentario"]` (`:137`) y **solo** esas dos propiedades (`:138-141`).
- **No existe el campo `punto`** ni un `enum` de nombres de punto. El JSDoc lo
  explica de forma explícita: el modelo nunca nombra los puntos y `puntos` solo fija
  la longitud del array (`validar-analisis.ts:106-109`).

**Forma esperada del JSON del modelo** (sin `score` y sin `punto`, tal como lo pide
el esquema y el prompt en `prompts.ts:77`):

```json
{
  "veredicto_corto": "Muy buen manejo del problema, pero te faltó cerrar el ask.",
  "claridad": 17,
  "rubrica": [
    { "cumplido": true,  "comentario": "El problema queda claro desde la primera frase." },
    { "cumplido": false, "comentario": "Mencionas el mercado pero sin cifra ni tamaño." }
  ]
}
```

**El nombre del punto lo asigna el servidor por índice**, desde `RUBRICAS`
(`validar-analisis.ts:210` y `:220`, con el comentario "El nombre lo pone el servidor
desde RUBRICAS, nunca el modelo"). Las rúbricas son la fuente de verdad
([`src/lib/rubricas.ts`](../src/lib/rubricas.ts:16)), 4 tipos × 5 puntos; por ejemplo
`capital` en `rubricas.ts:17-38`.

**El score lo calcula el servidor de forma determinista**
(`validar-analisis.ts:164-173`), con la fórmula:

```
score = clamp( round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100 )
```

con `COBERTURA_MAXIMA = 80` (`validar-analisis.ts:28`) y `CLARIDAD_MAXIMA = 20`
(`validar-analisis.ts:25`). El prompt lo declara al modelo: "El score NO lo calculas
tú" (`prompts.ts:81`).

**Dos niveles de rigor, y esto es importante.** El `additionalProperties: false`
vive **solo en el esquema que se le envía al proveedor**. La validación local es
**tolerante** con campos de más: `validarAnalisis` recorre la rúbrica por índice
(`validar-analisis.ts:210-224`), lee únicamente `cumplido` y `comentario`, y
**construye un objeto nuevo**, así que cualquier clave extra (por ejemplo un `punto`
alucinado o un `score` propio) se descarta sin provocar error. Lo que sí es
estricto es la **longitud**: si el número de ítems no coincide con la rúbrica se
lanza `ErrorValidacion` (`validar-analisis.ts:204-208`), y como la validación corre
dentro de `llamarModelo` (`modelo.ts:202`), ese error aprovecha el reintento
existente (`modelo.ts:205-216`).

## 3. Tabla comparativa 1 a 1 (pre-Nebius vs. post-Nebius)

| Área | Antes (tag `pre-nebius`, solo Gemini) | Después (`HEAD`, Nebius por defecto + Gemini de respaldo) | Evidencia |
|---|---|---|---|
| **Proveedor de modelo** | Uno solo, Gemini, cableado en el único módulo `src/lib/gemini.ts` (276 líneas) | Capa neutra + dos adaptadores; `MODEL_PROVIDER` elige y el default es `nebius` | `modelo.ts:1-2`, `:44-58`, `:64`, `:71-85`; `proveedor-nebius.ts:236`; `proveedor-gemini.ts:54` |
| **Endpoint / formato de request** | `POST .../v1beta/models/{modelo}:generateContent?key={apiKey}`, key como **query param**; body `contents: [{ parts: [{ text }] }]` (un solo string, sin `systemInstruction`); `generationConfig.responseSchema` en dialecto Gemini (tipos en MAYÚSCULAS) | `POST {NEBIUS_BASE_URL}/chat/completions`, key en header `Authorization: Bearer`; body con `messages` separado en `system`/`user`; `response_format.json_schema {name, strict, schema}` obligatorio (sin él, 422) | Gemini: `proveedor-gemini.ts:67-130`, traducción de dialecto en `:18-36`. Nebius: `proveedor-nebius.ts:9-12`, `:95`, `:104-116`, `:126-134` |
| **Manejo del razonamiento** | N/A — el concepto no existía: nada que activar ni desactivar | Estándar: se apaga con `chat_template_kwargs: { enable_thinking: false }`. Ultra: se **omite** el campo, dejando el razonamiento activo (y el modelo cambia a `NEBIUS_MODEL_ULTRA`) | `proveedor-nebius.ts:118-122`, `:19`, `:23`, `:177`, `:183`, `:193`, `:200`, `:220` |
| **Tokens de razonamiento en producción** | N/A | **NO VERIFICADO en producción.** El único log de éxito (`modelo.ts:203`) imprime `proveedor` y `modelo`, **no** tokens ni nivel, así que no hay forma de confirmar el valor desde los logs de Railway. Lo único observado es **0** en una corrida manual **local** del smoke test en modo estándar | `modelo.ts:202-204` (qué imprime el log); `scripts/smoke-nebius.mjs:176` y `:178-180` (donde sí se imprime y se avisa si no es 0) |
| **Reintento por `finish_reason: "length"`** | No existía. El truncado no se distinguía: no se leía `finishReason` en ninguna forma y se dependía solo del reintento genérico ante error | Regla propia del adaptador: si el primer `finish_reason` es `length`, **reintenta esa misma llamada una vez** con `max_tokens` duplicado (tope `8192`); si vuelve a truncarse lanza `ErrorModelo` (sin `codigoHttp`, o sea reintentable por la capa neutra); si ya estaba en el tope, error claro sin reintentar | `proveedor-nebius.ts:26`, `:204-214`, `:216-228`; tests en `test/proveedor-nebius.test.ts:211-272` |
| **Variables de entorno** | Solo `GEMINI_*`: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_RETRY_*` (con `gemini-2.0-flash` de default), más `GEMINI_API_KEY` | `MODEL_PROVIDER` (`nebius` por defecto) + `NEBIUS_API_KEY` (requerida en ese modo), `NEBIUS_BASE_URL`, `NEBIUS_MODEL_ULTRA`; configuración neutra compartida `MODEL`, `MODEL_FALLBACK_MODELS`, `MODEL_MAX_TOKENS`, `MODEL_TEMPERATURE`, `MODEL_RETRY_*`; los `GEMINI_*` sobreviven **solo** como alias que aplican cuando el proveedor activo es Gemini | `.env.example:6-10`, `:12-21`, `:23-41`, `:43-64`; `modelo.ts:103-111` (alias); `proveedor-nebius.ts:29-50` |
| **Validación de campos extra del modelo** | No aplicaba como problema local: el esquema pedía `punto` y `score`, y la validación aceptaba lo que viniera | El esquema enviado ya no declara `punto` ni `enum`, y la validación local **ignora** campos extra en lugar de rechazarlos: el servidor asigna el nombre por índice y recalcula el score. Hay test de regresión explícito | `validar-analisis.ts:106-109`, `:122-145`, `:210-224`; test "ignora campos extra del modelo (ej. 'punto') en vez de rechazarlos" en `test/validar-analisis.test.ts:115-135` |
| **Quién nombra los puntos y calcula el score** | El modelo: pedía `punto` y `score` en el esquema y el servidor no recalculaba nada | El servidor: nombres desde `RUBRICAS` por índice y score determinista con la fórmula de cobertura + claridad | `validar-analisis.ts:210-232`; `prompts.ts:77` y `:81` |
| **Selección del modelo** | `GEMINI_MODEL` con default fijo en código | `MODEL` (default `nvidia/nemotron-3-super-120b-a12b` en Nebius) + `MODEL_FALLBACK_MODELS`; en ultra, `NEBIUS_MODEL_ULTRA` sin fallbacks | `proveedor-nebius.ts:22`, `:35-37`, `:40-42`, `:45-50`, `:182-185` |
| **Timeout y política de reintentos** | `TIMEOUT_MS = 20_000` y reintentos dentro del mismo módulo que hacía el fetch | Igual en valores, pero movida a la capa neutra: la política es agnóstica del proveedor y el adaptador solo clasifica errores | `modelo.ts:88`, `:91`, `:133-136`, `:176-224` |
| **Prueba contra la API real** | Ninguna automatizada; verificación manual | Script manual `scripts/smoke-nebius.mjs` que **reutiliza las funciones de producción** (esquema restringido, `validarAnalisis`, `RUBRICAS`, `construirPrompt`) e importa los `.ts` con type stripping nativo de Node ≥ 22.6, sin runner ni build | `scripts/smoke-nebius.mjs:16-22`, `:28-35`, `:108`, `:204`; `docs/guia-integracion-nebius.md:160-187` |

## 4. Evidencia de validación real

**Prueba de humo contra Nebius real (`scripts/smoke-nebius.mjs`).** El script no
duplica lógica: importa `construirEsquemaAnalisisRestringido`, `validarAnalisis`,
`RUBRICAS` y `construirPrompt` desde `src/lib` (`smoke-nebius.mjs:30-35`), usa la
rúbrica real de `capital` (5 puntos, `smoke-nebius.mjs:87-89`) y **primero imprime el
esquema de producción efectivo** antes de llamar a la API
(`smoke-nebius.mjs:107-117`). Después del POST, pasa el `content` por
`JSON.parse` y **por el `validarAnalisis` real** (`smoke-nebius.mjs:191-212`), y
comprueba de forma independiente la longitud de `rubrica`
(`smoke-nebius.mjs:214-220`).

Corrida registrada en esta fase (modo estándar, con la clave del mantenedor):

| Señal | Valor observado |
|---|---|
| HTTP | `200` |
| `finish_reason` | `stop` (sin truncado; el reintento por `length` no se disparó) |
| `usage` | `prompt_tokens = 807`, `completion_tokens = 213`, `reasoning_tokens = 0` |
| Esquema enviado | `rubrica.minItems === maxItems === 5`, `items.required = ["cumplido","comentario"]`, `items.additionalProperties = false`, `items.properties = ["cumplido","comentario"]`, el campo `punto` **ausente** |
| `validarAnalisis()` | **OK** (no lanzó): `score = 99`, rúbrica con **exactamente 5 ítems** |
| Claves de cada ítem devuelto | `["cumplido","comentario"]` — el modelo no intentó nombrar puntos |

Esa corrida es la que justifica decir que el contrato cerrado (sin `punto` ni `enum`)
funciona contra la API real, y que la validación de producción acepta la respuesta.
El script imprime además un aviso explícito si en modo estándar los tokens de
razonamiento no son 0 (`smoke-nebius.mjs:178-180`), de modo que una regresión ahí
se hace visible.

Actualización operativa (2026-09-26, no verificable desde el repo): 
se confirmó en los logs de despliegue de Railway, en una prueba real 
del flujo completo (grabar → analizar → dashboard), la línea 
`[modelo] proveedor=nebius modelo=nvidia/nemotron-3-super-120b-a12b`, 
confirmando que el despliegue en producción usa Nebius con el modelo 
estándar por defecto. Esta observación no queda registrada en el 
repositorio ni es reproducible por un tercero sin acceso al dashboard 
de Railway.

```ts
console.log(`[modelo] proveedor=${proveedor.nombre} modelo=${modelo}`);
```

(`modelo.ts:203`) — es decir, sirve para confirmar **qué** proveedor atendió la
petición (que hoy debe salir `nebius`), pero no aporta `nivel`, ni `tokensEntrada`,
ni `tokensSalida`, porque esos datos no existen en ese scope: `enviar()` devuelve
únicamente el texto de la respuesta (`modelo.ts:53-57`) y el nivel vive solo dentro
de `crearProveedorNebius`.

**Modo ultra.** **NO VERIFICADO.** `ultra` nunca se ejecutó de punta a punta: no
tiene ruta, botón ni llamador en la UI
(`proveedor-nebius.ts:167-175`, `:192`, y `docs/status.md:47`). Por lo tanto,
tampoco hay medición real de tokens de razonamiento > 0 en ultra; es una expectativa
derivable del código (se omite `enable_thinking`), no un dato observado.

**Pruebas automatizadas.** `npm test` (vitest) da **52 tests en verde en 6 archivos**,
verificado durante esta fase de documentación con `npx vitest run`. La cobertura
relevante para esta migración incluye el contrato HTTP de Nebius con `fetch`
mockeado, los dos niveles, el reintento por `length`, la ausencia de
`NEBIUS_API_KEY`, la selección por `MODEL_PROVIDER`, que Gemini no se rompió, y la
tolerancia a campos extra (`test/proveedor-nebius.test.ts:70-342`,
`test/validar-analisis.test.ts:115-135`).

## 5. Qué NO cambió

La migración fue quirúrgica en la capa de modelo. Sigue igual:

- **Gemini sigue existiendo como respaldo manual de contingencia.** El adaptador
  `proveedor-gemini.ts` conserva su endpoint, su key como query param y su
  traducción de dialecto (`aEsquemaGemini`, `proveedor-gemini.ts:18-36`); se activa
  con `MODEL_PROVIDER=gemini` y no se usa en el despliegue por defecto
  (`.env.example:43-47`).
- **ElevenLabs (TTS)** — `/api/tts` con fallback a `SpeechSynthesis`, sin cambios de
  contrato ni de variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`,
  `ELEVENLABS_VOICE_ID_FEMALE`).
- **Tavily (enriquecimiento opcional)** — `/api/enriquecer`, best-effort, con su
  timeout de 8 s; sin key, el dashboard simplemente omite las sugerencias.
- **Web Speech API (STT)** — sigue siendo la única vía de transcripción, en `es-419`
  y en Chrome/Chromium (`src/components/GrabadorVoz.tsx`).
- **El núcleo del prompt y de la validación** — separación `system`/`user`
  (`prompts.ts:102-108`), transcripción delimitada como dato no confiable y
  delimitadores neutralizados (`prompts.ts:87-100`, `:46-52`), rúbricas fijas de 4
  tipos × 5 puntos (`rubricas.ts:16`), fórmula del score y validación determinista
  (`validar-analisis.ts:164-234`).
- **Límites y rate limiting** — `src/lib/limites.ts` (8000 caracteres) y
  `src/lib/rate-limit.ts` (por IP, en memoria) siguen aplicándose igual en las tres
  rutas.
- **Deploy** — `Dockerfile` + `railway.toml` (standalone, healthcheck) sin cambios;
  el Dockerfile sigue siendo exclusivo de producción y no se usa en local.

## 6. Lo que queda abierto

**Nada de esta lista está implementado.** Se listan como pendientes explícitos, no
como trabajo hecho.

1. **Sparring (segundo intento, crítica en vivo).** Sin implementar. Búsqueda en el
   repositorio (case-insensitive, excluyendo `node_modules`, `.git` y `.next`):
   **0 coincidencias** de `sparring`.
2. **Memoria de sesiones.** Sin implementar. **0 coincidencias** de
   `memoria de sesiones`. El estado relacionado sigue declarado como limitación
   consciente: sesión anónima sin persistencia (`docs/status.md:41`, `:68-75`).
3. **Materiales en inglés.** Sin implementar. **0 coincidencias** de
   `materiales en inglés` / `materiales en ingles`. Hoy todo lo visible al usuario y
   el contenido de las rúbricas están en español (`rubricas.ts:6-7`), y las rúbricas
   custom / más idiomas aparecen como abiertos para la comunidad
   (`docs/status.md:74`).
4. **Integración con LangSmith (observabilidad / tracing).** Sin implementar.
   **0 coincidencias** de `langsmith`. No hay ninguna dependencia de tracing en el
   proyecto; el único instrumento de observabilidad del modelo es el `console.log`
   de `modelo.ts:203`.
5. **Confirmar Nebius en el despliegue real.** VERIFICADO. evidencia de que
   Railway esté corriendo con `MODEL_PROVIDER=nebius` y `NEBIUS_API_KEY` y de una
   corrida del flujo completo contra ese entorno. El log `[modelo]` permite
   confirmarlo, pero no hay registro de haberlo hecho.
6. **Modo ultra sin ejercitar.** Existe en la librería, sin ruta ni botón
   (`proveedor-nebius.ts:167-175`, `docs/status.md:47`). Falta decidir si entra a la
   UI y, si entra, medir su latencia y sus tokens de razonamiento reales.
7. **El log de éxito no permite auditar tokens.** `modelo.ts:203` imprime solo
   proveedor y modelo. Si se quiere medir consumo (entrada/salida/razonamiento) en
   producción, hay que propagar esos datos desde el adaptador: hoy `enviar()`
   devuelve únicamente texto (`modelo.ts:53-57`), y el `usage` de Nebius se descarta
   en `extraerResultadoNebius` (`proveedor-nebius.ts:66-76`).
8. **Documentación desalineada detectada (no corregida en modo solo lectura).**
   `docs/status.md:49` todavía describe el esquema restringido como
   `minItems`/`maxItems`/**`enum`**, cuando el `enum` de nombres ya no existe
   (`validar-analisis.ts:122-145`). Queda como deuda de documentación.
9. **Rate limit en memoria.** Es por proceso/instancia (`src/lib/rate-limit.ts`), así
   que su efectividad depende de cuántas réplicas corran en producción. La migración
   no lo cambió ni lo revisó.
10. **Verificación manual del loop completo.** Sigue siendo una prueba manual en
    navegador (Chrome) sobre el despliegue; no hay test end-to-end automatizado
    (`docs/status.md:104-105`).

---

Referencias cruzadas:

- Estado anterior a la migración: [`docs/pre-nebius.md`](pre-nebius.md).
- Alcance funcional del producto: [`docs/alcance.md`](alcance.md).
- Estado general del proyecto: [`docs/status.md`](status.md).
- Replicar la integración de Nebius: [`docs/guia-integracion-nebius.md`](guia-integracion-nebius.md).
- Historial de la migración: commits `c018cc6` → `6024240` → `ea1c55e` → `15902cb`;
  tag `nebius-core` (`7b8ca0d`) y rama `feature/nebius-provider` (que apunta al
  mismo árbol de contenidos que `ea1c55e`, aunque la rama ya no es ancestro de
  `main`).
