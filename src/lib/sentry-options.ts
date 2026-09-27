/**
 * Opciones compartidas por las configuraciones de Sentry de servidor y edge.
 *
 * Vive en src/lib/ (y no inline en cada config) para poder testearse con Vitest
 * igual que el resto de la lógica de negocio del proyecto.
 *
 * El config del NAVEGADOR no usa estos helpers a propósito: Next.js solo
 * reemplaza en el bundle del cliente las referencias ESTÁTICAS a
 * `process.env.NEXT_PUBLIC_*`, así que una lectura dinámica como
 * `source[variable]` llegaría `undefined` al navegador. Ver
 * src/instrumentation-client.ts.
 */

/**
 * Hosts de producción a los que se propaga la traza (cabeceras `sentry-trace` y
 * `baggage`). Sin esto la traza se corta en el borde del navegador y no se puede
 * correlacionar un error de cliente con la petición de API que lo causó.
 */
export const TRACE_PROPAGATION_TARGETS = [
  "https://pitch-coach.focampo.com",
  "https://pitch-coach-production-1c0c.up.railway.app",
];

/** Entorno reportado cuando no hay ninguna variable definida. */
export const DEFAULT_ENVIRONMENT = "production";

/**
 * Ciclo de vida de las trazas. `"static"` es una ELECCIÓN, no un default.
 *
 * EL PROBLEMA
 * El default de v11 es `"stream"` (spans ensobrados por separado, en lotes).
 * Con ese ciclo el SDK IGNORA `beforeSendTransaction` — lo dice el propio SDK:
 *
 *   @deprecated This option only has an effect if `traceLifecycle` is set to
 *   'static'. With span streaming (`traceLifecycle: 'stream'`, the default),
 *   the SDK ignores it. Use `beforeSendSpan` instead, which works with both
 *   trace lifecycles. `beforeSendTransaction` will be removed in v12 of the SDK.
 *   — node_modules/@sentry/core/build/types/types/options.d.ts
 *
 * O sea: con el default, la mitad "transacción" del filtro de privacidad
 * (src/lib/sentry-scrub.ts) no se ejecuta. Comprobado, no deducido: los sobres
 * de traza salían como `application/vnd.sentry.items.span.v2+json` y nunca
 * aparecía un sobre `{"type":"transaction"}`.
 *
 * POR QUÉ `"static"` IGUAL
 * Porque los eventos de transacción SÍ llevan breadcrumbs, y los breadcrumbs
 * pueden llevar texto del usuario: un `console.error` con el mensaje de
 * `ErrorModelo` arrastra el cuerpo de respuesta del proveedor, que puede repetir
 * la petición —con la transcripción—. Verificado: esa fuga llegaba a Sentry por
 * un breadcrumb. Pasar a `"static"` crea la superficie "transacción con
 * breadcrumbs", y `beforeSendTransaction` es lo que la filtra. Sin las dos
 * cosas juntas, la superficie o no existe o queda sin filtrar.
 *
 * LO QUE SE PIERDE, Y NO IMPORTA ACÁ
 * `"static"` agrupa todos los spans y los manda al terminar la transacción, así
 * que hereda los límites del modelo viejo: tope de 1000 spans por traza, más
 * memoria, y sin datos parciales si el proceso muere a mitad. Los tres son
 * irrelevantes para esta app: las peticiones son cortas (un render, una llamada
 * a API) y las trazas que medimos tienen entre 1 y ~40 spans. El beneficio real
 * de `"stream"` (spans de procesos largos, colas, cron) no aplica: acá no hay
 * ninguno.
 *
 * DEUDA ASUMIDA, CON FECHA
 * `beforeSendTransaction` está deprecado y **se elimina en la v12 del SDK**.
 * Esta decisión compra el filtro hoy al precio de una migración futura a
 * `beforeSendSpan` (que en `"stream"` recibe `StreamedSpanJSON`, con otra forma:
 * `description`→`name`, `data`→`attributes`). No es urgente —la v12 es un salto
 * mayor deliberado, no automático— pero la migración hay que hacerla igual, y
 * conviene que sea antes de subir a v12 y no después. Ver docs/sentry.md §9.7.
 */
export const TRACE_LIFECYCLE = "static";

/**
 * Cabeceras que transportan la IP del cliente. Es la misma lista que usa el SDK
 * (`node_modules/@sentry/core/build/cjs/vendor/getIpAddress.js`,
 * `ipHeaderNames`) para extraerla.
 *
 * Fuente única: la usan la denegación de `DATA_COLLECTION` (abajo) y el borrado
 * de cabeceras de src/lib/sentry-scrub.ts. Si se agrega una cabecera acá, queda
 * cubierta en los dos lugares.
 */
export const IP_HEADER_NAMES: readonly string[] = [
  "x-client-ip",
  "x-forwarded-for",
  "fly-client-ip",
  "cf-connecting-ip",
  "fastly-client-ip",
  "true-client-ip",
  "x-real-ip",
  "x-cluster-client-ip",
  "x-forwarded",
  "forwarded-for",
  "forwarded",
  "x-vercel-forwarded-for",
];

/**
 * Colección de datos del SDK. Es lo que impide que la IP del cliente llegue a
 * Sentry, y el ÚNICO interruptor que lo apaga en todas las superficies.
 *
 * POR QUÉ NO ALCANZA CON DEJARLO AUSENTE
 * En @sentry/nextjs v11 los defaults de `dataCollection` son permisivos
 * (`node_modules/@sentry/core/build/cjs/utils/data-collection/resolveDataCollectionOptions.js`
 * define `userInfo: true`), así que omitir la opción NO es conservador: es
 * equivalente a pedir el default permisivo. La opción `sendDefaultPii` de las
 * guías antiguas no existe en v11 — no aparece en el código del SDK.
 *
 * LAS DOS PIEZAS, Y POR QUÉ SON DOS
 *
 * 1. `userInfo: false` (verificado en el SDK, no supuesto).
 *    `RequestData.extractNormalizedRequestData` hace dos cosas cuando
 *    `include.ip` es falso, y `include.ip` sale justamente de `userInfo`:
 *      a. No setea `event.user.ip_address`.
 *      b. BORRA de `request.headers` toda cabecera cuyo nombre esté en la lista
 *         de IP del SDK, y con eso también desaparece del evento de error.
 *
 * 2. `httpHeaders.request.deny` con la lista de IP.
 *    El punto 1.b NO alcanza para los spans. Los atributos
 *    `http.request.header.*` los arma `httpHeadersToSpanAttributes`
 *    (node_modules/@sentry/core/build/cjs/utils/request.js), que filtra por
 *    `dataCollection.httpHeaders.request` y no mira `include.ip`: sin esta
 *    segunda pieza, `http.request.header.x-forwarded-for` seguía viajando en
 *    los sobres de traza. Y esos sobres se exportan SIN pasar por `beforeSend`,
 *    así que el filtro de src/lib/sentry-scrub.ts no los ve.
 *    Con `deny`, el valor del atributo queda como `"[Filtered]"`.
 *
 * Este objeto solo nombra `userInfo` y `httpHeaders.request`; los campos que no
 * se nombran caen a sus defaults, que son los mismos que ya estaban activos —
 * pasar el objeto no "activa" nada nuevo (ver resolveDataCollectionOptions:
 * cada campo es `dc.campo ?? DEFAULTS.campo`).
 *
 * Sin `as const` a propósito: el tipo `DataCollection` vive en @sentry/core, que
 * no es dependencia directa del proyecto, y `as const` convertiría `deny` en
 * `readonly string[]`, que el SDK no acepta (su tipo pide `string[]` mutable).
 * El literal queda entonces con los tipos anchos que el SDK sí acepta, y la
 * forma se fija igual con los tests de sentry-options.
 */
export const DATA_COLLECTION = {
  userInfo: false,
  httpHeaders: { request: { deny: [...IP_HEADER_NAMES] } },
};

/** Vista de variables de entorno, para poder inyectar una falsa en los tests. */
export type EnvSource = Record<string, string | undefined>;

/**
 * Entorno que se reporta a Sentry.
 *
 * Orden de resolución: SENTRY_ENVIRONMENT → NODE_ENV → "production".
 *
 * El fallback a NODE_ENV es deliberado: NODE_ENV vale "development" en local y
 * "production" en el build de Railway, así que sin él el desarrollo local se
 * etiquetaría como "production" y se mezclaría con los eventos reales en la
 * misma vista de Sentry.
 *
 * Se usa `||` y no `??` a propósito: una variable presente pero vacía en
 * .env.local llega como cadena vacía (no como undefined), y `??` la dejaría
 * pasar y reportaría un entorno vacío.
 */
export function sentryEnvironment(source: EnvSource = process.env): string {
  return source.SENTRY_ENVIRONMENT || source.NODE_ENV || DEFAULT_ENVIRONMENT;
}

/**
 * Interruptor maestro: permite apagar Sentry en local sin borrar código.
 *
 * Cualquier valor distinto de la cadena exacta "false" lo deja encendido, así
 * que con la variable ausente el default es encendido.
 */
export function sentryEnabled(source: EnvSource = process.env): boolean {
  return source.SENTRY_ENABLED !== "false";
}

/** Muestreo de trazas: todas en desarrollo, una de cada diez en producción. */
export function sentryTracesSampleRate(environment: string): number {
  return environment === "development" ? 1.0 : 0.1;
}
