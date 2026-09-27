# Sentry en Pitch Coach — registro de lo realizado

> **2026-09-27.** Documento de decisión: qué se integró, por qué, qué está
> verificado y qué no, y qué conviene mirar antes de aprobar el merge.
> Rama: `feature/sentry` (pusheada, sin PR abierto). `main` intacto en `72ab2a5`.
>
> **Este archivo entra a la rama** (decisión de esta fase). El resumen corto y
> estable para el mantenedor vive en `docs/status.md` §5; acá está el detalle y
> el porqué de cada decisión.

---

## 1. Objetivo

Monitoreo de errores en servidor y cliente, con la misma garantía de privacidad
que ya se aplicó al historial local: **el texto del usuario no sale del
proceso**.

La app maneja la transcripción del pitch y el contenido de las rúbricas. Sentry
es un tercero. La regla que ordena todo el diseño es que nada de eso llegue
ahí, aunque cueste funcionalidad.

---

## 2. Qué se integró

| Runtime | Archivo | Contenido |
|---|---|---|
| Node | `src/sentry.server.config.ts` | API routes, Server Components, Server Actions |
| Edge | `src/sentry.edge.config.ts` | middleware y handlers en el borde |
| Navegador | `src/instrumentation-client.ts` | bundle del cliente |
| Registro | `src/instrumentation.ts` | carga el config según `NEXT_RUNTIME` |

Versión: `@sentry/nextjs@11.0.0` sobre Next 16.3.1 con Turbopack. Se usa el
patrón de Next 16 (`instrumentation-client.ts`) y no `sentry.client.config.ts`,
que es el nombre de versiones anteriores.

**Session Replay no está instalado.** Graba interacciones del DOM —incluido
texto tipeado y leído—, que es exactamente el tipo de captura que este proyecto
no quiere.

### Opciones compartidas

`src/lib/sentry-options.ts` centraliza lo que comparten las tres configs:
entorno, interruptor maestro, muestreo y `tracePropagationTargets`. Vive en
`src/lib/` para poder testearse con Vitest, igual que el resto de la lógica.

Destinos de propagación de traza (los dos dominios de producción):

```
https://pitch-coach.focampo.com
https://pitch-coach-production-1c0c.up.railway.app
```

Muestreo: 100% en desarrollo, 10% en producción.

---

## 3. Privacidad — la parte que importa

### 3.1 Filtro centralizado

`src/lib/sentry-scrub.ts`. Función pura, testeable, aplicada como `beforeSend` y
`beforeSendTransaction` en las tres configs. Redacta recursivamente toda
propiedad cuyo **nombre** esté en esta lista, sin importar el nivel ni si
cuelga de un array:

```
transcripcion, comentario, traza, pregunta, respuesta,
veredicto, veredicto_corto, audio
```

Cubre las formas reales del dominio porque el contenido sensible siempre cuelga
de una de esas claves: `rubrica` es un array de objetos con `comentario`, y
`turnos` es un array de objetos con `pregunta`, `respuesta` y `comentario`.

Se aplica a `request.data`, `request.headers`, `extra`, `contexts`, `user` y
`breadcrumbs`. De los breadcrumbs, los de **consola se descartan enteros** (§3.7).

### 3.2 Sanitización del error del proveedor

Esto **no** lo cubre el filtro, y es el hallazgo más importante del trabajo.

`src/lib/proveedor-nebius.ts` construye el mensaje de error pegándole el cuerpo
de respuesta crudo del proveedor:

```ts
detalle = await respuesta.text();
throw new ErrorModelo(
  `El modelo ${args.modelo} respondió con error ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
  respuesta.status,
);
```

Ese cuerpo, en errores de validación, suele repetir la petición — y la petición
contiene la transcripción. El filtro decide por **nombre** de propiedad y no ve
dentro de un string, así que `captureException(error)` habría mandado el pitch a
Sentry en el título del issue.

Solución: `src/lib/sentry-reporte.ts` **nunca manda el error crudo**. Construye
un resumen (tipo de error, código HTTP, proveedor, nivel) y conserva el stack
descartando su primera línea, que es la que arrastra el mensaje original. El
detalle completo sigue yendo a los logs de consola.

### 3.3 Qué NO llega a Sentry

- La transcripción del pitch.
- El campo `comentario` de cualquier rúbrica (principal, Ultra, o de un turno
  de "Resolver hallazgos").
- El campo `traza` del Análisis Ultra.
- La `pregunta` y la `respuesta` de un turno de hallazgos.
- El `veredicto` y el `veredicto_corto`.
- Audio en cualquier forma.
- El mensaje crudo de `ErrorModelo`.
- La **IP del cliente**, por los cuatro canales por los que llegaba (§3.6).
- Los **breadcrumbs de consola**, y con ellos el detalle crudo del proveedor que
  arrastraban (§3.7).

### 3.4 Límite conocido, sin maquillar

El filtro decide por **nombre**, no por contenido. Un texto sensible que viaje
como **valor** de una propiedad con nombre permitido no se detecta. Por eso:

- Las rutas nunca adjuntan texto del usuario como contexto.
- El error del proveedor se resume en vez de reenviarse.
- Los breadcrumbs de consola, que son texto libre por construcción, se descartan
  (§3.7) — ese fue exactamente el agujero por donde se fugó el pitch una vez.

Hay un test que fija este límite a propósito
(`test/sentry-reporte.test.ts`, "LÍMITE CONOCIDO"), para que nadie asuma una
cobertura que no existe. Si se agrega un `extra` nuevo en alguna ruta, hay que
revisarlo contra esta sección.

**El límite sigue vivo para el resto de los breadcrumbs.** Un breadcrumb de
`fetch` cuyo `data` llevara texto del usuario en un string seguiría sin
detectarse. Hoy no ocurre —los de `http`/`fetch` llevan método, url y status
(verificado en el sobre)—, pero la regla no lo impide.

### 3.5 Otras decisiones de privacidad

- **`includeLocalVariables` no está activo.** Las variables locales de los stack
  frames del pipeline de análisis contienen el texto del pitch.
- **La IP del cliente NO se reporta** (desde el commit `fix(sentry): stop
  reporting client IP to align with anonymous-session design`). La app es de
  sesión anónima: sin cuentas, la IP era el único identificador de cliente que
  podía colarse, y no se quiere. El detalle de cómo se apaga, en §3.6.
- **`dataCollection` SÍ se define** (`userInfo: false` + denegación de cabeceras
  de IP). Ver §3.6: dejarlo ausente NO era conservador.
- **`traceLifecycle` es `"static"`, explícito.** Sin eso, `beforeSendTransaction`
  no se ejecuta y la mitad "transacción" del filtro es código muerto. Ver §3.8.

### 3.6 La IP del cliente: por qué salía y cómo se apaga

**Corrección de un supuesto previo.** Este documento afirmaba que omitir
`dataCollection` mantenía el comportamiento de `sendDefaultPii: false` y que
pasar el objeto —aunque fuera `{}`— activaba categorías permisivas. Las dos
cosas son falsas en `@sentry/nextjs@11.0.0`, y se comprobó leyendo el SDK:

- `sendDefaultPii` **no existe** en v11: no aparece en el código de
  `@sentry/core`, `@sentry/node` ni `@sentry/nextjs`. No protege nada.
- Los defaults de `dataCollection` son **permisivos** y no dependen de nada:
  `resolveDataCollectionOptions` fija `userInfo: true`, `cookies: true`,
  `httpHeaders.request/response: true`, los cuatro `httpBodies` y `genAI`.
  Omitir la opción es equivalente a `dataCollection: {}`: cada campo se resuelve
  como `dc.campo ?? DEFAULTS.campo`, así que pasar un objeto parcial no "activa"
  nada nuevo. (Que el default de `genAI` sea permisivo no implica que capture
  algo acá: sin un SDK de IA no hay quién lo lea. Ver §3.6.2.)

**La IP salía por cuatro canales**, no por uno. Verificado con un DSN local que
captura el sobre real (sin mandar nada a Sentry):

| # | Canal | Dónde |
|---|---|---|
| 1 | `event.user.ip_address` | evento de error |
| 2 | `event.request.headers["x-forwarded-for"]` | evento de error |
| 3 | `items[].attributes["user.ip_address"]` | sobre de spans |
| 4 | `items[].attributes["http.request.header.x-forwarded-for"]` | sobre de spans |

**Por qué hacen falta DOS piezas** (y no alcanza con una):

1. `dataCollection.userInfo: false`. `RequestData.extractNormalizedRequestData`
   hace dos cosas cuando `include.ip` es falso —y `include.ip` sale de
   `userInfo`—: no setea `user.ip_address` y **borra** de `request.headers` toda
   cabecera de su lista de IP. Eso cierra 1, 2 y 3.
2. `httpHeaders.request.deny` con la lista de cabeceras de IP. El punto 1 **no
   alcanza para 4**: los atributos `http.request.header.*` los arma
   `httpHeadersToSpanAttributes`, que filtra por
   `dataCollection.httpHeaders.request` y no mira `include.ip`. Con `deny`, el
   valor del atributo queda `"[Filtered]"`.

> **Por qué el filtro de §3.1 no bastaba.** Los sobres de spans se exportan SIN
> pasar por `beforeSend`, así que `src/lib/sentry-scrub.ts` no los ve. Para
> ellos la única barrera posible es la de colección. Por eso la pieza 1 es la
> importante y la denegación de cabeceras en `sentry-scrub.ts` es redundancia
> deliberada, no la defensa principal.

**Efecto lateral aceptado:** `deny` matchea por substring, así que
`x-forwarded-host`, `x-forwarded-port` y `x-forwarded-proto` también quedan
`[Filtered]`. No llevan la IP y se pierden como dato de debugging; se aceptó a
cambio de no dejar pasar una cabecera `X-Forwarded` a secas, que sí puede
llevarla. `host` y `user-agent` siguen intactos.

**Pendiente de decisión, no resuelto acá:** el interruptor apaga la IP, pero los
demás defaults permisivos siguen activos. `httpBodies` **ya se auditó** (§3.6.1) y
`genAI` resultó **inerte por construcción** (§3.6.2); `cookies`,
`urlQueryParams` y `httpHeaders.response` **siguen sin auditarse** (§3.6.3).

### 3.6.1 Auditoría de `httpBodies`: sin fuga

**Pregunta:** ¿`httpBodies` en su default permisivo tiene una vía de fuga que
saltee `beforeSend`, como la tenía la IP en los spans?

**Respuesta: no, y es verificable.** Se hizo un POST real con la transcripción
en el cuerpo a `/api/analizar-pitch` (el proveedor apuntado a un servidor local
que devolvía eco, para no llamar a nadie), y se auditaron los sobres:

| Dónde podría viajar el cuerpo | Qué se encontró |
|---|---|
| `event.request.data` | **ausente** — el SDK no adjunta el cuerpo de la petición entrante en estas rutas |
| `http.request.body.data` (atributo de span) | **no existe** |
| Atributos de span de la llamada saliente al proveedor | solo el nombre (`POST 127.0.0.1`); sin cuerpo ni cabecera `authorization` |
| Breadcrumb `http` de la llamada saliente | solo `http.request.method`, `status_code`, `url` |
| Breadcrumb de consola | **aquí sí salía** — pero no es `httpBodies`: ver §3.7 |

**Por qué no hay fuga, y por qué eso no depende de suerte.** El atributo
`http.request.body.data` lo arma `addNormalizedRequestDataToSpan`
(`@sentry/core/.../integrations/requestdata.js`) a partir de
`normalizedRequest.data` —el mismo objeto que alimenta `event.request.data`—, y
en estas rutas ese campo llega vacío: Next.js no lo puebla para route handlers.
No es que el filtro lo redacte: es que **no hay nada que redactar**. Por eso la
conclusión vale mientras el SDK no empiece a poblar `normalizedRequest.data`; si
algún día lo hace, el cuerpo entraría como `http.request.body.data` en un
atributo de span, que **no pasa por `beforeSend`** en modo stream. Ver §3.8.

### 3.6.2 `genAI`: inerte por construcción (verificado)

**Pregunta:** ¿`genAI` captura algo cuando se usa `fetch` crudo, como hacen
`proveedor-nebius.ts` y `proveedor-gemini.ts`?

**Respuesta: no. Solo instrumenta SDKs de IA reconocidos.** Este proyecto no usa
ninguno, así que la categoría es inerte y no hay nada que auditar.

**Cómo se engancha `genAI`** (leído en el SDK instalado, no deducido): las
integraciones de proveedor que leen `dataCollection.genAI` instrumentan
**módulos por nombre de paquete, rango de versión, ruta de archivo exacta y
clase/método**:

```
@google/genai          >=0.10.0 <3    dist/node/index.js      Models.generateContent
openai                 >=4.0.0 <8     resources/chat/completions/completions.js   Completions.create
groq-sdk               >=0.3.0 <2
@mistralai/mistralai   >=2.0.0 <3
```

**No hay matching por URL ni por host en ninguna parte.** Grep de
`api.openai.com`, `anthropic.com`, `generativelanguage`, `api.mistral` y
similares en todo `@sentry/**`: **cero coincidencias**. Las configs de los
proveedores que sí vienen registrados por defecto tienen **cero** referencias a
URLs o hosts.

**El módulo que podía haber sido la excepción no lo es.**
`openAiCompatibleConfig` —y Nebius **es** OpenAI-compatible, así que era la duda
legítima— no matchea endpoints: es una **fábrica parametrizada por descriptor de
módulo** (`{ name, versionRange, filePath }`). No existe detección de "endpoint
compatible", y `openAICompatibleIntegration` no está en las listas por defecto.

**Confirmación empírica, con los sobres ya capturados.** La llamada real al
proveedor por `fetch` crudo salió trazada como `sentry.origin =
auto.http.node_fetch` / `sentry.op = http.client`, **sin ningún atributo
`gen_ai.*`**. En todos los sobres capturados: **0 archivos** con `gen_ai.*` ni
`auto.ai.*`. Detalle que refuerza el caso: el proveedor simulado tenía la ruta
`/fake-provider/chat/completions` —un path que *parece* la API de OpenAI— y aun
así no disparó nada.

**El proyecto no tiene ningún SDK de IA instalado.** Grep de `openai`,
`@google/genai`, `@google/generative-ai`, `@anthropic-ai/sdk`, `langchain`, `ai`,
`groq-sdk`, `@mistralai/mistralai`, `together-ai`: ninguno presente.
`dependencies` es exactamente `@sentry/nextjs, next, react, react-dom`.

> **⚠️ Trampa latente, para el futuro.** Las integraciones de IA **sí se
> registran por defecto** —están en `getTracingIntegrations()` del runtime
> Node—; simplemente son **no-ops mientras el paquete del vendor no exista**. Si
> alguien reemplaza el `fetch` crudo de `src/lib/proveedor-nebius.ts` por el
> **paquete oficial `openai`** (plausible, porque Nebius es compatible con esa
> API), `genAI` se activa con sus **defaults permisivos** (`inputs: true`,
> `outputs: true`) y el prompt —que contiene la transcripción del pitch— empieza
> a viajar a Sentry **sin que nadie toque la configuración de privacidad**. El
> filtro de §3.1 no lo detiene: `genAI` graba prompts y completions como
> atributos de span, y los spans no pasan por `beforeSend`. Si eso pasa, hay que
> poner `dataCollection.genAI: { inputs: false, outputs: false }` **antes** de
> cambiar el proveedor.

### 3.6.3 Lo que sigue sin auditar

`cookies`, `urlQueryParams` y `httpHeaders.response` quedan con sus defaults
permisivos y **no se auditaron**. No hay evidencia de fuga, pero tampoco la hay
de lo contrario: no afirmar que están cubiertos. Lo que sí se sabe: la app no usa
`setContext`, `setExtra` ni `addBreadcrumb` en `src/`, y sus URLs no llevan texto
del usuario en el query string (el pitch va en el cuerpo de un POST).

### 3.7 Fuga real por breadcrumb de consola (reproducida y cerrada)

**Este fue un agujero vivo, no teórico.** Encontrarlo es el resultado más
importante de esta fase después de la IP.

**La cadena:**
1. `src/lib/proveedor-nebius.ts` mete el cuerpo de respuesta crudo del proveedor
   en el mensaje de `ErrorModelo` (§3.2).
2. El `catch` de cada ruta hace `console.error("[/api/…] fallo …", error)`.
3. La integración `Console` del SDK graba ese `console.error` como breadcrumb
   `category: "console"` con los argumentos serializados en `data.arguments` —
   **incluido el Error con su `message` y su `stack` completos**.
4. Los breadcrumbs viajan en el evento. El filtro de §3.1 los procesa, pero
   decide por **nombre** de propiedad y el pitch va **dentro de un string**.
5. Resultado: la transcripción llegaba a Sentry.

**Reproducción.** Con un proveedor simulado que devolvía `400` y un cuerpo con
eco de la petición, el centinela apareció en el sobre, exactamente en:

```
breadcrumbs[4].data.arguments[1].message
breadcrumbs[4].data.arguments[1].stack
```

**Por qué `reportarFallo` no alcanzaba.** Sanitiza la **excepción** (§3.2), pero
el breadcrumb lo genera el `console.error`, que es otro camino. Y no se arregla
quitando el log: el detalle completo en consola es deliberado, es la vía de
depuración del mantenedor.

**Fix aplicado:** `beforeSend` y `beforeSendTransaction` **descartan** los
breadcrumbs de consola (no los redactan: su contenido es arbitrario, no hay
nombre de propiedad estable que marcar). Los demás breadcrumbs siguen su curso
con `scrub` — verificado que un breadcrumb `http` sobrevive con su método,
status y url.

**Nota sobre la alternativa que se descartó.** `consoleIntegration` acepta un
`filter` de patrones, pero descarta la llamada **antes** de instrumentarla y
además la silencia de la consola real (`if (!isFiltered || debug) log(...)`). Eso
mataría el log local, que es justamente lo que se quiere conservar. El filtro en
`beforeSend` corta solo la salida hacia el tercero.

### 3.8 `traceLifecycle: "static"`: por qué no se usa el default

Con el default del SDK (`"stream"`), **`beforeSendTransaction` no se ejecuta**.
El SDK lo dice en sus tipos:

> `@deprecated` This option only has an effect if `traceLifecycle` is set to
> `'static'`. With span streaming (`traceLifecycle: 'stream'`, the default), the
> SDK ignores it. Use `beforeSendSpan` instead […]. `beforeSendTransaction` will
> be **removed in v12** of the SDK.
> — `@sentry/core/build/types/types/options.d.ts`

O sea: la mitad "transacción" del filtro era código muerto. Se puso
`traceLifecycle: "static"` —documentado como la salida oficial— por una razón
concreta, no por nostalgia del modelo viejo: **los eventos de transacción llevan
breadcrumbs**, y los breadcrumbs pueden llevar texto del usuario (§3.7). Pasar a
`static` crea esa superficie; `beforeSendTransaction` es lo que la filtra.

**Lo que se pierde, y por qué no importa acá:**

| Beneficio de `"stream"` | Por qué no aplica |
|---|---|
| Sin tope de 1000 spans por traza | Las trazas medidas tienen 1–40 spans (la home: 36 en el navegador) |
| Menos memoria | Los datos se retienen lo que dura una petición: un render o una llamada a API |
| Datos parciales si el proceso muere | No hay procesos largos, colas ni cron |
| Visibilidad más rápida | Operativo, no de privacidad |

**Verificado, no supuesto:** con `"static"` sigue habiendo la misma cantidad de
spans —el navegador manda una transacción `platform=javascript` con 36 spans, y
los servidores transacciones `platform=node`— y ya no hay ningún sobre
`application/vnd.sentry.items.span.v2+json`. No se pierde telemetría: se cambia
de sobre.

**Deuda con fecha.** `beforeSendTransaction` se elimina en la v12 del SDK. Esta
decisión compra el filtro hoy al precio de migrar a `beforeSendSpan` antes de
subir a v12. No es urgente, pero es una fecha, y conviene que la migración sea
deliberada y no un efecto colateral de un upgrade. Ver §9.7 y §10.

---

## 4. Variables de entorno

Todas opcionales: sin `SENTRY_DSN` la app funciona igual y el SDK no envía nada.

| Variable | Default | Para qué |
|---|---|---|
| `SENTRY_DSN` | — | runtime de servidor y edge |
| `NEXT_PUBLIC_SENTRY_DSN` | — | navegador (mismo valor; un DSN es clave de ingesta pública) |
| `SENTRY_ENVIRONMENT` | `production` | etiqueta de entorno |
| `SENTRY_ENABLED` | `true` | apagar el envío sin tocar código |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | — | espejo para el navegador |
| `NEXT_PUBLIC_SENTRY_ENABLED` | — | espejo para el navegador |
| `SENTRY_AUTH_TOKEN` | — | **build-time**, subida de source maps |
| `SENTRY_ORG` / `SENTRY_PROJECT` | — | build-time, subida de source maps |

Detalles que no son obvios:

- **Los espejos `NEXT_PUBLIC_*` son necesarios.** Next.js solo reemplaza en el
  bundle del cliente las referencias *estáticas* a `NEXT_PUBLIC_*`; el navegador
  no puede leer `SENTRY_ENVIRONMENT`. No estaban en el brief original; se
  agregaron porque sin ellos el cliente no reporta entorno.
- **El entorno cae a `NODE_ENV` antes que a `production`.** Sin ese fallback, el
  desarrollo local se etiquetaría como `production` y se mezclaría con los
  eventos reales.
- **`SENTRY_AUTH_TOKEN` va en `.env.sentry-build-plugin`** en local (gitignoreado),
  no en `.env.local`. Ese archivo lo crea uno a mano y su ausencia es silenciosa.

---

## 5. Captura

### Servidor — 5 rutas

`analizar-pitch`, `sparring/pregunta`, `sparring/evaluar`, `tts`, `enriquecer`.
Las cinco ya tenían el patrón "mensaje genérico al cliente, detalle en logs"; se
les agregó el reporte a Sentry. **No se cambió ningún código HTTP ni ningún
mensaje que vea el cliente.**

### Cliente — error boundaries

`src/app/error.tsx` (nuevo) y `src/app/global-error.tsx`.

Antes de esto **no existía ningún `error.tsx`**, así que los errores de render
de `GrabadorVoz`, `DashboardResultado` y `PanelProgreso` no llegaban a Sentry en
absoluto: Next los atrapa para mostrar la UI de respaldo y nunca alcanzan el
handler global del SDK. `global-error.tsx` solo dispara si falla el layout raíz.

Se reporta únicamente el error. No se adjuntan props ni estado de componentes.

### Tags

En cada evento de servidor: `proveedor` y `nivel`. Dato operativo, no privado.

- `analizar-pitch` → `nebius`/`gemini` según `MODEL_PROVIDER`, y el `nivel` real
  (`estandar`/`ultra`/`rapido`, con `estandar` por defecto).
- `sparring/pregunta` y `sparring/evaluar` → nivel `rapido`.
- `tts` → `elevenlabs`; `enriquecer` → `tavily`. Se usa el proveedor real de
  cada ruta, no el modelo de lenguaje.

### Sentry: dónde está el proyecto

- Organización `focampo`, proyecto `pitch-coach`, **región EU** (`de.sentry.io`).
- DSN en `.env.local` (gitignoreado).

---

## 6. Source maps

Configurado y **verificado de punta a punta**, no solo "el build dice OK".
`next.config.ts` usa `withSentryConfig` con `authToken`,
`widenClientFileUpload` y `tunnelRoute: "/monitoring"`.

> **Ojo:** el brief original decía no configurar esto todavía ("decisión mía").
> Se mantuvo por decisión explícita posterior, porque ya estaba funcionando y
> verificado. Si se quiere sacar del merge, hay que revertir `next.config.ts`,
> los `ARG` del `Dockerfile` y las variables asociadas en `.env.example`.

Verificación empírica: en un build de producción, el mismo error mostró esto en
la terminal local (sin source maps)

```
at t (.next/server/chunks/[root-of-the-server]__1kd39kw._.js:2:943)
```

y esto en Sentry, desde el mismo binario minificado

```
../../../src/app/api/sentry-prod-test/route.ts:4:9 (GET)
    3 │ export async function GET() {
  → 4 │     throw new Error(
```

Con comentarios originales y línea correcta.

### Producción: dos cosas sin hacer

1. **El `Dockerfile` ahora declara `ARG`** para `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_RELEASE` en la etapa `builder`.
   Railway **no** expone las variables del servicio a un build por Dockerfile sin
   declararlas con `ARG`. Sin esto el build no ve el token y los stack traces de
   producción salen minificados. Los `ARG` están puestos pero **inertes** hasta
   que Railway tenga las variables.
2. **`SENTRY_RELEASE` hay que pasarlo explícito** como
   `${{RAILWAY_GIT_COMMIT_SHA}}`. El `.dockerignore` excluye `.git`, así que la
   detección automática por SHA de git no encuentra nada y todos los eventos
   caerían en un release desconocido. Por la misma razón, los commits no se
   vincularán al release en producción (en local sí lo hacen).

---

## 7. Los commits de la rama

| Commit | Qué hace |
|---|---|
| `46a5e29` | Integración + opciones compartidas + esquema de entorno |
| `c2b80eb` | Filtro de privacidad + 32 tests |
| `05b8092` | Captura en las 5 rutas de servidor, con resumen sanitizado |
| `6b42d9b` | Error boundaries de cliente |
| `2a8148f` | Verificación de los tags operativos |
| `1816d3a` | Documentación en `docs/status.md` |
| `dc30f50` | **La IP del cliente deja de reportarse** (§3.6) + verificación del filtro en el pipeline real |
| `ff2d1d1` | Registra la verificación de la fase: el camino de error de cliente y la IP |
| `5d822ea` | **`traceLifecycle: "static"`** (§3.8) + **cierre de la fuga por breadcrumb de consola** (§3.7) + auditoría de `httpBodies` (§3.6.1) + alcance real del scrub en `extra` (§9.9) |
| *(este commit)* | Registra la verificación empírica de las dos tareas anteriores |

**Nota de transparencia:** la emisión de tags quedó dentro del commit `05b8092`,
no del `2a8148f`, porque `reportarFallo` necesitaba el parámetro `tags` desde el
principio. No se reescribió la historia para disimularlo; el commit de la tarea
5 aporta la verificación, que era lo que faltaba de verdad.

---

## 8. Estado de verificación

### Verificado

| Qué | Cómo |
|---|---|
| Camino de error de servidor | Error real lanzado contra `npm run dev` y contra un build de producción; llegó a Sentry (`PITCH-COACH-1`, `PITCH-COACH-2`) |
| Source maps | Stack trace desminificado en Sentry desde binario de producción |
| `onRequestError` | `mechanism: auto.function.nextjs.on_request_error` en el evento |
| Release | Coincide entre build y runtime (`72ab2a5…`), por eso Sentry encontró los mapas |
| Entorno | `environment: production` en el evento de producción |
| Muestreo | `client_sample_rate: 0.1` en producción |
| Inlineado de `NEXT_PUBLIC_*` | Valor centinela en un build; aparece en el bundle del cliente |
| Filtro de privacidad | 40 tests, afirmando por valor además de por nombre |
| Sanitización del error | 13 tests; el cuerpo del proveedor no llega al SDK por ninguna vía |
| Tags | 8 tests ejecutando las 5 rutas con el proveedor caído |
| **El filtro corre de verdad (servidor)** | `Sentry.setExtra` con centinelas sin filtrar, en una ruta temporal: el sobre real salió con `transcripcion: "[Filtered]"` y `veredicto_corto: "[Filtered]"`. No es solo un test unitario |
| **El camino de error del CLIENTE** | Chrome 152 headless contra `npm run dev`: un throw en `useEffect` y otro en render hacen que `error.tsx` muestre la UI de respaldo, y sale un evento con la excepción real (`LanzaEnEfecto.useEffect`) hacia `/monitoring` |
| **La IP ya no se reporta** | Sobre real capturado con un DSN local, antes y después. Antes: `user.ip_address` + `x-forwarded-for` en el evento y en los spans. Después: los cuatro canales limpios, y `settings.infer_ip: "never"` en el sobre del cliente |
| **`beforeSendTransaction` SÍ se ejecuta** | No alcanza con que desaparezca el warning. Prueba directa: con centinelas sin filtrar adjuntos a una transacción real (`GET /api/tmp-transaction-probe`), el sobre salió con `extra.analisis.transcripcion: "[Filtered]"` y `contexts.sparring.respuesta: "[Filtered]"`, conservando `score: 72`. Ese marcador solo lo produce el callback |
| **El modo `static` no pierde telemetría** | Mismo conteo de spans que antes: el navegador manda una transacción `platform=javascript` con 36 spans; los servidores, transacciones `platform=node`. Cero sobres `span.v2` (antes eran todos así) |
| **`httpBodies` no filtra el cuerpo** | POST real con la transcripción a `/api/analizar-pitch`: el cuerpo no aparece en `event.request.data`, ni en `http.request.body.data`, ni en los spans de la llamada saliente, ni en los breadcrumbs `http`. Detalle en §3.6.1 |
| **La fuga por breadcrumb de consola está cerrada** | Antes: con un proveedor que devolvía eco, el pitch aparecía en `breadcrumbs[].data.arguments[1].message`. Después: el centinela no llega a ningún sobre, y un breadcrumb `http` sigue sobreviviendo con método, status y url |
| **`genAI` no captura nada con `fetch` crudo** | Por código: instrumenta módulos por paquete + versión + archivo exactos, sin matching por URL/host (grep de hosts de proveedores: 0 coincidencias). Empíricamente: la llamada al proveedor sale como `auto.http.node_fetch` / `http.client` sin atributos `gen_ai.*`, y 0 archivos capturados contienen `gen_ai.*` ni `auto.ai.*` |
| Suite completa | 181 tests en verde (175 previos + 6 nuevos) |
| Lint / tipos / build | `npm run lint`, `npx tsc --noEmit`, `next build` — todos limpios |

### Cómo se verificó lo del cliente (reproducible)

1. `npm run dev` y abrir `http://localhost:3000/…` en Chrome. **Usar `localhost`,
   no `127.0.0.1`**: el dev server de Next 16 responde **403** a los assets de
   desarrollo pedidos a `127.0.0.1`, así que la página no hidrata, ningún efecto
   corre y la prueba falla por una razón que no tiene nada que ver con el código.
   Costó un intento fallido descubrirlo.
2. Un componente cliente que lanza en `useEffect` (no en render: los efectos no
   corren en el servidor, así que el fallo es inequívocamente del navegador).
3. Con Playwright: esperar `text=Algo salió mal`, interceptar el POST a
   `/monitoring` y leer el sobre.

El túnel (`tunnelRoute`) devolvió **HTTP 200** en todos los envíos, o sea que la
ingesta de Sentry aceptó los sobres. Los eventos de prueba quedaron como issues
reales en el proyecto (región EU); conviene cerrarlos.

### NO verificado

- **Nada de esto corrió en Railway.** Los `ARG` del Dockerfile están validados
  por documentación y por el comportamiento del plugin en local, no por un
  deploy real.
- **El camino de error de cliente NO se probó en un build de producción**, solo
  contra `npm run dev`. Tampoco la verificación de `static` en el cliente.
- **Tres categorías de `dataCollection` siguen sin auditar**: `cookies`,
  `urlQueryParams` y `httpHeaders.response`. `httpBodies` se auditó sin fuga
  (§3.6.1) y `genAI` resultó inerte por construcción, verificado (§3.6.2). Ver
  §3.6.3.
- **El tope de 1000 spans por traza con `static`** no se ejercitó: no hay trazas
  que se acerquen. Si algún día una ruta genera cientos de spans, es el primer
  sitio donde mirar.
- **La rama de arrays anidados de `scrub()` en `extra` es inerte hoy** (§9.9):
  no se puede verificar un camino que ningún call site produce.

---

## 9. Hallazgos

1. **No existía ningún `error.tsx`.** Los errores de render del cliente no
   llegaban a Sentry en absoluto.
2. **El leak del cuerpo del proveedor.** Real, no teórico. Resuelto.
3. **El `catch` de `/api/enriquecer` es prácticamente inalcanzable** ante fallos
   de Tavily: `enriquecerConTavily` aísla cada punto con su propio `try/catch`
   por diseño "best effort". El reporte ahí es defensivo, no una vía viva.
4. **Una clave sensible redacta el valor completo**, no elemento por elemento:
   `traza: [a, b]` queda como `"[Filtered]"`. Deliberado — no queda ni cuántos
   pasos tenía el razonamiento.
5. **`.dockerignore` excluye `.git`**, lo que rompe la detección automática de
   release y la vinculación de commits en producción. De ahí el punto 6.
6. **El flag "experimental" de Turbopack para source maps ya no aplica.** Desde
   `@sentry/nextjs@10.13.0` es comportamiento por defecto. Verificado contra la
   documentación y contra el log real del build.
7. **`beforeSendTransaction` no se ejecutaba** (con el default `"stream"`), y
   ahora sí. **Resuelto** poniendo `traceLifecycle: "static"`; el análisis
   completo del trade-off y lo que se pierde, en §3.8. Verificado con una
   transacción real y centinelas, no por ausencia del warning.
   **Deuda declarada:** `beforeSendTransaction` se elimina en la **v12** del SDK,
   así que esta solución tiene fecha. Migrar a `beforeSendSpan` (que en
   `"stream"` recibe `StreamedSpanJSON`) es trabajo pendiente, antes de subir a
   v12. Es una decisión para el mantenedor, no un detalle de implementación.
8. **La IP salía por cuatro canales y por dos mecanismos distintos**, no por uno.
   Ver §3.6 — es el hallazgo central de esta fase.
9. **Alcance real del scrub recursivo en `extra`: la rama de arrays anidados es
   INERTE hoy, no una defensa activa.** Se auditó a fondo y hay dos razones
   independientes:

   - **Ningún call site la produce.** Los cinco `reportarFallo` del proyecto
     pasan contextos planos (`{ proveedor }`, `{ proveedor, nivel }`), y `src/` no
     usa `setContext`, `setExtra` ni `addBreadcrumb`.
   - **Aunque existiera, Sentry la normaliza antes.** Verificado por la vía real
     (`captureException` con hint, la que usa `reportarFallo`): un
     `extra.analisis.rubrica` con `{ comentario }` adentro llega al sobre como
     `["[Object]"]`. O sea que `scrub()` no recibe los objetos anidados: recibe un
     array con el string `"[Object]"`.

   **Qué sí protege de verdad en `extra`, y no hay que restarle mérito:** la
   recursión en **objetos planos** funciona y es la que actúa. Verificado en el
   mismo sobre: `extra.analisis.transcripcion` y `veredicto_corto` salieron
   `[Filtered]` mientras `score` sobrevivió. Eso es lo que corta el texto del
   usuario en el nivel donde realmente viaja.

   **Dónde la rama de arrays SÍ es carga viva:** en `breadcrumbs`. Ahí los arrays
   NO se normalizan — la fuga de §3.7 viajó precisamente dentro de
   `data.arguments`, un array cuyo objeto interno conservó `message` y `stack`
   completos hasta el sobre. Esa rama es la que procesa esos breadcrumbs (y por
   eso el descarte de los de consola es una regla aparte y no un efecto del
   scrub). Para `request.data` y `contexts` la rama sigue siendo teórica: el
   primero llega vacío en estas rutas (§3.6.1) y los segundos no se usan.

   Conclusión honesta: la rama de arrays del filtro **no está de más** (es lo que
   cubre breadcrumbs), pero **no es lo que protege a `extra`**. La documentación
   anterior daba a entender lo segundo.
10. **Fuga real y reproducida por breadcrumb de consola.** El pitch llegaba a
    Sentry dentro de `breadcrumbs[].data.arguments[1].message` y `.stack`, por el
    `console.error` de los `catch`, que graba el `ErrorModelo` completo —y ese
    mensaje arrastra el cuerpo del proveedor—. **Cerrada** descartando los
    breadcrumbs de consola en `beforeSend`/`beforeSendTransaction`. Detalle en
    §3.7. Es el hallazgo más importante de esta fase después de la IP.
11. **El dev server de Next 16 responde 403 a los assets de desarrollo si se
    pide por `127.0.0.1`.** Fue lo que hizo fracasar el primer intento de
    verificar el error de cliente: sin assets no hay hidratación, sin hidratación
    no corre ningún efecto, y el resultado parece un boundary roto sin serlo. Con
    `localhost` funciona. Anotado en §8.
12. **`consoleIntegration` tiene un `filter`, pero no sirve para esto.** Filtra
    por patrón sobre el primer argumento y, además, **silencia la llamada de la
    consola real** (`if (!isFiltered || debug) log(...)`). Usarlo habría matado el
    log local que el proyecto quiere conservar. Por eso el corte va en
    `beforeSend`. Anotado para que nadie lo "simplifique" hacia allá.
13. **`genAI` es inerte hoy, pero con una trampa latente.** Solo instrumenta SDKs
    de IA por paquete/versión/archivo exacto, no por URL, y el proyecto llama a
    los proveedores por `fetch` crudo — así que no captura nada. Pero las
    integraciones de IA **se registran igual por defecto**: si se migra
    `proveedor-nebius.ts` al paquete `openai` (plausible, Nebius es
    OpenAI-compatible), `genAI` se enciende con defaults permisivos y el prompt
    viaja a Sentry como atributo de span, sin pasar por `beforeSend`. Ver §3.6.2.

---

## 10. Lo que queda pendiente

- **Railway:** cargar `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` y `SENTRY_RELEASE`.
- **Migrar a `beforeSendSpan` antes de subir a la v12 del SDK** (§9.7). Hoy el
  filtro de transacciones funciona vía `beforeSendTransaction` + `static`, pero
  esa opción se elimina en v12. En `"stream"` el callback recibe
  `StreamedSpanJSON` (otra forma de datos) y **no puede descartar spans
  devolviendo `null`**. Es la decisión de diseño que quedó abierta.
- **Auditar las tres categorías de `dataCollection` que siguen activas**
  (`cookies`, `urlQueryParams`, `httpHeaders.response`). `httpBodies` ya se
  auditó sin fuga (§3.6.1) y `genAI` es inerte mientras no se use un SDK de IA
  (§3.6.2). Ver §3.6.3 — no afirmar que están cubiertas.
- **Si algún día se migra `proveedor-nebius.ts` al paquete `openai`**, poner
  `dataCollection.genAI: { inputs: false, outputs: false }` **antes** del cambio:
  es lo único que impide que los prompts —con la transcripción— viajen a Sentry
  como atributos de span, que no pasan por `beforeSend`. Ver §3.6.2.
- **Issues de prueba en Sentry: cerrados.** Los cuatro del proyecto están en
  `resolved` —`PITCH-COACH-1` y `PITCH-COACH-2` de las fases anteriores, y
  `PITCH-COACH-3` y `PITCH-COACH-4` (los dos del camino de error de cliente,
  cerrados con un comentario que explica que eran pruebas y que el componente ya
  no existe)—. No queda ninguno abierto.
- **Decidido: `docs/sentry.md` entra a la rama.** Es el registro de decisión de
  la fase; el resumen corto y estable vive en `docs/status.md` §5. Si en algún
  momento divergen, manda `status.md`.

---

## 11. Qué mirar antes del merge

Por orden de riesgo:

1. **`src/lib/sentry-scrub.ts`** — el filtro completo, línea por línea. Es la
   pieza que evita que algo sensible se filtre a un tercero. Mirar en particular
   el descarte de breadcrumbs de consola (§3.7) y su test de regresión.
2. **`src/lib/sentry-options.ts`, `TRACE_LIFECYCLE`** — la decisión con fecha de
   vencimiento (§3.8). Es lo único de esta rama que hay que revisar antes de un
   upgrade mayor del SDK.
3. **`src/lib/sentry-reporte.ts`** — la sanitización del error del proveedor. Si
   alguien la reemplaza por un `captureException(error)` directo, el leak vuelve.
   Ojo: sanitiza la excepción, **no** los breadcrumbs — de eso se encarga el
   filtro.
4. **`next.config.ts` + `Dockerfile`** — la config de source maps, que el brief
   pedía dejar fuera. Decidir si se queda.
5. **`NODE_ENV` como fallback de entorno** — desviación del brief; el default
   documentado sigue siendo `production`.
6. **Los tags `elevenlabs`/`tavily`** en `tts`/`enriquecer` — desviación del
   brief, que pedía `nebius`/`gemini`.

### Comandos para verificar por tu cuenta

```bash
git log --oneline main..feature/sentry
npm run lint && npx tsc --noEmit && npm test && npm run build
npx vitest run test/sentry-scrub.test.ts test/sentry-reporte.test.ts test/sentry-tags.test.ts
```
