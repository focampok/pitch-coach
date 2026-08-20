export type TipoPitch = "capital" | "educacion" | "innovacion" | "tecnologia";

// Duración máxima del pitch en minutos. Solo se aceptan presets fijos de
// 1 a 7 minutos (docs/alcance.md, sección 7) — nunca un valor libre.
export type DuracionMaxima = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Las únicas opciones válidas de duración. Si se agrega una nueva, debe
// actualizarse también el union type DuracionMaxima para mantener ambos en sintonía.
export const DURACIONES_MAXIMAS: readonly DuracionMaxima[] = [1, 2, 3, 4, 5, 6, 7];

// TODO: definir los campos completos del resultado del análisis
// (score, veredicto_corto, rubrica, muletillas), según el JSON
// estructurado esperado de Gemini en docs/alcance.md (sección 8).
export type ResultadoAnalisis = Record<string, never>;
