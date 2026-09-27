import * as Sentry from "@sentry/nextjs";
import { scrub } from "./sentry-scrub";
import { sentryEnabled } from "./sentry-options";

/**
 * Reporte de fallos de servidor hacia Sentry, sin filtrar contenido del usuario.
 *
 * POR QUÉ NO SE MANDA EL ERROR CRUDO
 * `ErrorModelo` puede llevar en su `message` el cuerpo de respuesta del
 * proveedor (ver src/lib/proveedor-nebius.ts). Ese cuerpo, en errores de
 * validación, suele repetir la petición — y la petición contiene la
 * transcripción del pitch. El filtro de src/lib/sentry-scrub.ts decide por
 * NOMBRE de propiedad y no puede ver dentro de un string, así que acá no
 * alcanza: hay que no mandar ese mensaje en absoluto.
 *
 * QUÉ SÍ SE MANDA
 * Un resumen estructural — tipo de error, código HTTP, y el contexto operativo
 * (proveedor, modelo, nivel) — más el stack trace SIN la línea del mensaje
 * original. Alcanza para agrupar y ubicar el fallo, que es para lo que sirve
 * Sentry. El detalle completo del proveedor sigue yendo a los logs de consola.
 */

/** Lo único que se extrae de un error: su tipo y, si lo tiene, su código HTTP. */
export interface ResumenError {
  nombre: string;
  codigoHttp?: number;
}

/**
 * Extrae el resumen seguro de un error. Deliberadamente NO incluye `message`:
 * es el campo que puede arrastrar el cuerpo del proveedor.
 */
export function resumirError(error: unknown): ResumenError {
  const nombre = error instanceof Error ? error.name : "ErrorDesconocido";
  const codigo = (error as { codigoHttp?: unknown } | null | undefined)
    ?.codigoHttp;

  return typeof codigo === "number" ? { nombre, codigoHttp: codigo } : { nombre };
}

/** Partes del contexto que son seguras para el título del issue. */
const CLAVES_TITULO = ["proveedor", "modelo", "nivel"] as const;

/** Título corto, armado solo con datos operativos. */
function mensajeSeguro(
  resumen: ResumenError,
  contexto: Record<string, unknown>
): string {
  const partes: string[] = [resumen.nombre];

  for (const clave of CLAVES_TITULO) {
    const valor = contexto[clave];
    if (typeof valor === "string" || typeof valor === "number") {
      partes.push(`${clave}=${valor}`);
    }
  }

  if (resumen.codigoHttp !== undefined) partes.push(`HTTP ${resumen.codigoHttp}`);

  return partes.join(" · ");
}

/**
 * Construye un Error con el mensaje seguro, conservando los frames del stack
 * original.
 *
 * La primera línea de un stack es "Nombre: mensaje" — se descarta, porque es
 * donde viajaría el mensaje original completo.
 */
export function errorSanitizado(error: unknown, mensaje: string): Error {
  const seguro = new Error(mensaje);

  if (error instanceof Error) {
    seguro.name = error.name;
    const stackOriginal = error.stack;
    if (stackOriginal) {
      const frames = stackOriginal.split("\n").slice(1);
      seguro.stack = [`${seguro.name}: ${mensaje}`, ...frames].join("\n");
    }
  }

  return seguro;
}

/**
 * Reporta un fallo a Sentry.
 *
 * @param error     el error original; NUNCA se manda tal cual
 * @param contexto  datos operativos (proveedor, modelo, nivel, código...).
 *                  Pasa por el filtro de privacidad antes de adjuntarse.
 * @param tags      tags del evento (proveedor, nivel). Dato operativo, no privado.
 */
export function reportarFallo(
  error: unknown,
  contexto: Record<string, unknown> = {},
  tags: Record<string, string> = {}
): void {
  // Respeta el interruptor maestro: con SENTRY_ENABLED=false no se envía nada.
  if (!sentryEnabled()) return;

  const resumen = resumirError(error);

  Sentry.captureException(errorSanitizado(error, mensajeSeguro(resumen, contexto)), {
    // El filtro se aplica igual, por si el contexto trae algo que no esperábamos.
    extra: scrub({ ...contexto, error: resumen }) as Record<string, unknown>,
    tags,
  });
}
