// Idioma de la interfaz y del contenido generado (docs/alcance.md, modo bilingüe).
//
// Un único valor `Idioma` gobierna TODO: textos de UI, rúbricas, prompts y los
// mensajes de error de las rutas de API. La parte de voz (STT/TTS), las
// muletillas en inglés y las reacciones del avatar viven en la Parte B; acá solo
// se declara el tipo que esas fases consumirán.

export type Idioma = "es" | "en";

/** Los idiomas soportados, en el orden en que se muestran en el selector. */
export const IDIOMAS: readonly Idioma[] = ["es", "en"];
