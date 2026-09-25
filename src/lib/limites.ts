/**
 * Límites de entrada de las API routes.
 *
 * La transcripción se acota para evitar consumir cuota del modelo con cuerpos
 * desproporcionados. Un pitch de 7 minutos ronda las ~1 000 palabras
 * (~6 500 caracteres), así que 8 000 deja margen de sobra.
 */

export const MAX_TRANSCRIPCION_CARACTERES = 8000;

export const MENSAJE_TRANSCRIPCION_LARGA =
  "La transcripción supera el máximo de 8000 caracteres. Acorta el pitch o divide la grabación.";

/** true si la transcripción excede el máximo permitido. */
export function excedeLimiteTranscripcion(texto: string): boolean {
  return texto.length > MAX_TRANSCRIPCION_CARACTERES;
}
