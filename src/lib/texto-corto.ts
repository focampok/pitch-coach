// Helpers de saneamiento de texto CORTO para la ruta de Tavily.
//
// -----------------------------------------------------------------------------
// POR QUÉ ESTE ARCHIVO EXISTE (y no vive en tavily.ts)
// -----------------------------------------------------------------------------
// Estaba dentro de tavily.ts, pero los módulos nuevos de la Fase B (query,
// Extract, validación, frase hablada) lo necesitan. Si lo importaran desde
// tavily.ts se crearía un ciclo (tavily.ts los importa a ellos). Este módulo no
// importa NADA del proyecto: es la base del grafo.
//
// Es, además, la primera línea de la regla de privacidad: `limpiarTermino` deja
// el texto sin puntuación de oración, así que nada de lo que sale hacia Tavily
// (query, comentario) puede parecer una oración dictada por el usuario.
// -----------------------------------------------------------------------------

/**
 * Quita puntuación de oración y controla el espaciado.
 *
 * Esta función es la que garantiza que ninguna pieza de la query parezca una
 * oración: tras limpiar, no quedan `.?!¿¡;:` ni comillas. Es parte de la regla
 * de privacidad, no una vuelta estética.
 */
export function limpiarTermino(texto: string): string {
  return texto
    .replace(/[.!?;:¿¡"“”'‘’`´()\[\]{}<>«»]|\u0000-\u001f|\u007f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpia y recorta un término corto al tope dado. */
export function recortarTexto(texto: string, max: number): string {
  return limpiarTermino(texto).slice(0, max).trim();
}
