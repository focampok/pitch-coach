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

/** Respuesta de sparring: una réplica corta, no un pitch completo. */
export const MAX_RESPUESTA_SPARRING_CARACTERES = 2000;

export const MENSAJE_RESPUESTA_SPARRING_LARGA =
  "La respuesta supera el máximo de 2000 caracteres. Sé más breve.";

/** Nombre de un punto de rúbrica (textos cortos de `rubricas.ts`). */
export const MAX_PUNTO_SPARRING_CARACTERES = 200;

export const MENSAJE_PUNTO_SPARRING_LARGO =
  "El punto de la rúbrica supera el máximo permitido.";

/** Pregunta de seguimiento (1–2 frases habladas). */
export const MAX_PREGUNTA_SPARRING_CARACTERES = 800;

export const MENSAJE_PREGUNTA_SPARRING_LARGA =
  "La pregunta de sparring supera el máximo permitido.";

/** true si la transcripción excede el máximo permitido. */
export function excedeLimiteTranscripcion(texto: string): boolean {
  return texto.length > MAX_TRANSCRIPCION_CARACTERES;
}

/** true si la respuesta de sparring excede el máximo permitido. */
export function excedeLimiteRespuestaSparring(texto: string): boolean {
  return texto.length > MAX_RESPUESTA_SPARRING_CARACTERES;
}

/** true si un punto de rúbrica excede el máximo permitido. */
export function excedeLimitePuntoSparring(texto: string): boolean {
  return texto.length > MAX_PUNTO_SPARRING_CARACTERES;
}

/** true si la pregunta de sparring excede el máximo permitido. */
export function excedeLimitePreguntaSparring(texto: string): boolean {
  return texto.length > MAX_PREGUNTA_SPARRING_CARACTERES;
}

/**
 * Tope de audio para /api/transcribir.
 *
 * El preset más largo es 7 minutos. MediaRecorder (webm/opus o mp4/AAC) ronda
 * 32–128 kbps; a 256 kbps × 7 min ≈ 13.4 MB. 20 MB deja margen para Safari y
 * el overhead de multipart, y sigue muy por debajo del tope de Scribe (GB).
 */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export const MENSAJE_AUDIO_GRANDE =
  "El audio supera el tamaño máximo permitido. Acorta la grabación.";

const MIME_AUDIO_PERMITIDOS = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "video/webm",
  "video/mp4",
]);

/** true si el MIME es uno de los que Scribe acepta sin transcodificar. */
export function mimeAudioPermitido(tipo: string): boolean {
  const base = tipo.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "") return true;
  return MIME_AUDIO_PERMITIDOS.has(base);
}

/** true si el audio excede el tope de bytes. */
export function excedeLimiteAudio(bytes: number): boolean {
  return bytes > MAX_AUDIO_BYTES;
}
