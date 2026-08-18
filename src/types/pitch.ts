export type TipoPitch = "capital" | "educacion" | "innovacion" | "tecnologia";

// TODO: definir los campos completos del resultado del análisis
// (score, veredicto_corto, rubrica, muletillas), según el JSON
// estructurado esperado de Gemini en docs/alcance.md (sección 8).
export type ResultadoAnalisis = Record<string, never>;
