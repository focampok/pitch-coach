// Este módulo no importa tipos del SDK a propósito. @sentry/nextjs no reexporta
// `TransactionEvent` ni `Options`, y ambos viven en @sentry/core, que no es
// dependencia directa del proyecto — importarlo sería atarse a un paquete
// transitivo. Los handlers de abajo son genéricos sobre la forma que realmente
// tocamos, y TypeScript verifica la compatibilidad en el punto de uso
// (Sentry.init), que es donde importa.

import { IP_HEADER_NAMES } from "./sentry-options";

/**
 * Filtro de privacidad: la última barrera antes de que un evento salga hacia
 * Sentry, un tercero.
 *
 * POR QUÉ EXISTE
 * Esta app maneja la transcripción del pitch del usuario y el contenido de las
 * rúbricas. Ese texto no puede salir del proceso. Se aplica el mismo criterio
 * que ya se aplicó a localStorage (ver src/lib/historial-sesiones.ts): lo
 * sensible no se persiste ni se envía, aunque cueste funcionalidad.
 *
 * QUÉ HACE
 * Recorre el evento y reemplaza por un marcador el valor de toda propiedad cuyo
 * NOMBRE esté en SENSITIVE_KEYS, sin importar en qué nivel esté ni si cuelga de
 * un array. El recorrido es recursivo, así que cubre las formas reales del
 * dominio: `rubrica` es un array de objetos con `comentario`, y `turnos` es un
 * array de objetos con `pregunta`, `respuesta` y `comentario`.
 *
 * Además BORRA la IP del cliente: las cabeceras de IP de `request.headers` y
 * `user.ip_address`. La app es de sesión anónima, así que la IP era el único
 * identificador de cliente que se podía colar. Es redundante con el interruptor
 * de colección (ver DATA_COLLECTION en src/lib/sentry-options.ts) a propósito:
 * `beforeSend` está declarado como la última barrera y no debe depender de que
 * esa opción siga puesta.
 *
 * Y DESCARTA los breadcrumbs de consola, que son texto libre y por eso no se
 * pueden redactar por nombre de propiedad. También es una fuga reproducida, no
 * una precaución: ver el bloque de `scrubEventObject`.
 *
 * ALCANCE DE LO DE LA IP — lo que este módulo NO cubre
 * Los sobres de traza (span containers) se exportan sin pasar por `beforeSend`,
 * así que acá no se ven: de esos se encarga `dataCollection`. Este filtro solo
 * cubre eventos de error y de transacción.
 *
 * LÍMITE CONOCIDO
 * El filtro decide por NOMBRE de propiedad, no por contenido. Un string
 * sensible que viaje como VALOR de una propiedad con nombre permitido no se
 * detecta — por ejemplo, si un error de un proveedor incluyera el texto del
 * pitch dentro de su `message`. Ver la nota en docs/status.md.
 */

/**
 * Nombres de propiedad que nunca deben salir hacia Sentry. La comparación es
 * case-insensitive y exacta (no por substring) para no redactar de más.
 *
 * Origen de cada uno (ver src/types/pitch.ts):
 *   transcripcion  → SolicitudAnalisis.transcripcion
 *   comentario     → EvaluacionRubrica.comentario / TurnoSparring.comentario
 *   traza          → ResultadoAnalisis.traza (razonamiento del Análisis Ultra)
 *   pregunta       → TurnoSparring.pregunta / RespuestaPreguntaSparring
 *   respuesta      → TurnoSparring.respuesta / SolicitudEvaluacionSparring
 *   veredicto      → texto del veredicto
 *   veredicto_corto→ ResultadoAnalisis.veredicto_corto
 *   audio          → buffer devuelto por /api/tts
 */
export const SENSITIVE_KEYS: readonly string[] = [
  "transcripcion",
  "comentario",
  "traza",
  "pregunta",
  "respuesta",
  "veredicto",
  "veredicto_corto",
  "audio",
];

/** Marcador que reemplaza al valor filtrado. */
export const REDACTED = "[Filtered]";

/**
 * Tope de profundidad. Un evento real no anida tanto; el tope existe para no
 * colgar el proceso ante una estructura patológica.
 */
const MAX_DEPTH = 12;

/** ¿El nombre de esta propiedad está en la lista de sensibles? */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.includes(key.toLowerCase());
}

/**
 * Categoría de los breadcrumbs que produce la integración `Console` del SDK.
 */
export const CONSOLE_BREADCRUMB_CATEGORY = "console";

/**
 * ¿Es un breadcrumb de consola? Se comparan la categoría y, por las dudas, la
 * forma: `data.arguments` es lo que arma `consoleIntegration`.
 */
export function isConsoleBreadcrumb(breadcrumb: unknown): boolean {
  if (!isPlainObject(breadcrumb)) return false;
  const categoria = breadcrumb.category;
  return (
    typeof categoria === "string" &&
    categoria.toLowerCase() === CONSOLE_BREADCRUMB_CATEGORY
  );
}

/**
 * ¿Esta cabecera transporta la IP del cliente? La lista vive en
 * src/lib/sentry-options.ts porque también arma la denegación del SDK; acá se
 * usa para borrarlas del evento.
 */
export function isIpHeader(name: string): boolean {
  return IP_HEADER_NAMES.includes(name.toLowerCase());
}

/** Objeto plano: excluye Date, Error, Map, class instances, etc. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Recorre `value` y devuelve una copia con las propiedades sensibles
 * reemplazadas por REDACTED. No muta la entrada.
 *
 * Los valores primitivos (string, number, boolean, null, undefined) y los
 * objetos no planos (Date, Error, ...) se devuelven tal cual: el filtro decide
 * por nombre de propiedad, no por contenido.
 *
 * `seen` corta ciclos: sin él, un objeto que se referencie a sí mismo haría
 * que la recursión no termine nunca.
 */
export function scrub(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH || seen.has(value)) return REDACTED;
    seen.add(value);
    return value.map((item) => scrub(item, depth + 1, seen));
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_DEPTH || seen.has(value)) return REDACTED;
    seen.add(value);

    const salida: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      salida[key] = isSensitiveKey(key) ? REDACTED : scrub(item, depth + 1, seen);
    }
    return salida;
  }

  return value;
}

/**
 * Devuelve las cabeceras sin las que llevan la IP. Se ELIMINAN, no se redactan,
 * para que el evento no afirme siquiera que hubo una IP — mismo criterio que el
 * SDK cuando `include.ip` es falso (borra la cabecera, no la vacía).
 */
function sinCabecerasDeIp(headers: unknown): unknown {
  if (!isPlainObject(headers)) return headers;

  const salida: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!isIpHeader(key)) salida[key] = value;
  }
  return salida;
}

/**
 * Devuelve el objeto `user` sin la IP. `ip_address` es el campo de Sentry y
 * `ip` el alias que usa el SDK en algunas rutas; se borran ambos.
 */
function sinIpDeUsuario(user: unknown): unknown {
  if (!isPlainObject(user)) return user;

  const salida: Record<string, unknown> = { ...user };
  delete salida.ip_address;
  delete salida.ip;
  return salida;
}

/** Forma mínima del evento que nos interesa tocar. */
type ScrubTarget = {
  request?: unknown;
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: unknown;
  user?: unknown;
};

/**
 * Aplica el filtro a las superficies donde puede viajar contenido de usuario.
 *
 * Se tocan solo estas cinco a propósito, y no el evento entero, para no
 * alterar campos que el SDK necesita para agrupar y mostrar el error (mensaje,
 * stack trace, tags). Cada una es una vía conocida de entrada de datos:
 *   request.data    → cuerpo de la petición
 *   request.headers → cabeceras, entre ellas las que llevan la IP del cliente
 *   extra           → contexto que adjuntamos nosotros
 *   contexts        → contextos con nombre
 *   breadcrumbs     → la mayoría son de fetch, y su `data` lleva cuerpo/respuesta
 *   user            → identidad; acá solo puede colarse la IP
 *
 * POR QUÉ LOS BREADCRUMBS DE CONSOLA SE DESCARTAN ENTEROS
 * Un breadcrumb de consola es TEXTO LIBRE por construcción: `consoleIntegration`
 * guarda en `data.arguments` los argumentos tal cual (y un Error se serializa
 * con `message` y `stack` completos). Eso rompe la premisa de este filtro, que
 * decide por NOMBRE de propiedad y no mira dentro de los strings.
 *
 * No es teórico. Fuga reproducida: `console.error("[/api/analizar-pitch] fallo
 * el análisis:", error)` graba el mensaje de `ErrorModelo`, y ese mensaje
 * arrastra el cuerpo de respuesta del proveedor (src/lib/proveedor-nebius.ts),
 * que en un error de validación repite la petición —con la transcripción del
 * pitch—. Verificado con un proveedor simulado que devolvía eco: el texto del
 * pitch llegaba a Sentry dentro de `breadcrumbs[].data.arguments[1].message` y
 * de `.stack`.
 *
 * `reportarFallo` no cubre esto: sanitiza la EXCEPCIÓN, no el breadcrumb. Y no
 * se arregla en los logs, porque el detalle completo en consola es deliberado
 * (es la vía de depuración del mantenedor). El único punto donde se puede
 * cortar sin perder eso es acá.
 *
 * Se descartan en vez de redactarse porque el contenido de un breadcrumb de
 * consola es arbitrario: no hay un nombre de propiedad estable que marcar, así
 * que "sin breadcrumbs de consola" es la única regla verificable. El resto de
 * las categorías (fetch, http, navigation) sigue pasando por `scrub`.
 */
function scrubEventObject<T extends ScrubTarget>(event: T): T {
  const salida: ScrubTarget = { ...event };

  if (salida.request && typeof salida.request === "object") {
    const request = salida.request as Record<string, unknown>;
    const limpia: Record<string, unknown> = {
      ...request,
      data: scrub(request.data),
    };
    if (request.headers !== undefined) {
      limpia.headers = sinCabecerasDeIp(request.headers);
    }
    salida.request = limpia;
  }

  if (salida.extra) salida.extra = scrub(salida.extra);
  if (salida.contexts) salida.contexts = scrub(salida.contexts);

  if (Array.isArray(salida.breadcrumbs)) {
    salida.breadcrumbs = salida.breadcrumbs
      // Los de consola SE DESCARTAN en vez de redactarse: ver el porqué abajo.
      .filter((breadcrumb) => !isConsoleBreadcrumb(breadcrumb))
      .map((breadcrumb) => scrub(breadcrumb));
  }

  if (salida.user !== undefined) salida.user = sinIpDeUsuario(salida.user);

  return salida as T;
}

/**
 * beforeSend: se ejecuta antes de enviar un evento de error. Devolver el evento
 * (no null) para no descartarlo — acá solo se redacta.
 *
 * Genérico sobre T para no depender de un tipo que el SDK no reexporta: al
 * pasarlo como opción, TypeScript infiere T del evento que el SDK le entrega.
 */
export function beforeSend<T extends ScrubTarget>(event: T): T | null {
  return scrubEventObject(event);
}

/** beforeSendTransaction: lo mismo para eventos de traza. */
export function beforeSendTransaction<T extends ScrubTarget>(
  event: T
): T | null {
  return scrubEventObject(event);
}
