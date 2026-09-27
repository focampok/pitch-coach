// Tipos del dominio del pitch (docs/alcance.md).
// El código se escribe en inglés; los valores de dominio (nombres de puntos,
// veredictos) van en español por ser contenido visible del producto.

export type TipoPitch = "capital" | "educacion" | "innovacion" | "tecnologia";

// Duración máxima del pitch en minutos. Solo se aceptan presets fijos de
// 1 a 7 minutos (docs/alcance.md, sección 7) — nunca un valor libre.
export type DuracionMaxima = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Las únicas opciones válidas de duración. Si se agrega una nueva, debe
// actualizarse también el union type DuracionMaxima para mantener ambos en sintonía.
export const DURACIONES_MAXIMAS: readonly DuracionMaxima[] = [1, 2, 3, 4, 5, 6, 7];

// Muletillas detectadas sobre la transcripción (docs/alcance.md §8): mapa de
// etiqueta visible → número de ocurrencias. No requiere IA, es regex/keyword
// matching. Coincide con el campo `muletillas` del JSON de análisis (§13).
export type ConteoMuletillas = Record<string, number>;

/** Evaluación de un punto de la rúbrica, devuelta por Gemini (docs/alcance.md §13). */
export interface EvaluacionRubrica {
  /** Nombre del punto de la rúbrica (mismo texto que §6). */
  punto: string;
  /** Si la transcripción cubre o no el punto. */
  cumplido: boolean;
  /** Comentario breve del LLM sobre el punto (español). */
  comentario: string;
}

// Resultado completo del análisis del pitch (docs/alcance.md §13).
// El JSON de Gemini se mapea a esta forma; el dashboard y el veredicto hablado
// (TTS) la consumen después. Nombres en snake_case para los campos del JSON de
// respuesta porque es lo que define el contrato con Gemini y con el alcance.
export interface ResultadoAnalisis {
  /** Score numérico 0-100 del pitch. */
  score: number;
  /** Veredicto breve (1-2 frases), pensado para leerse en voz alta. */
  veredicto_corto: string;
  /** Evaluación punto por punto contra la rúbrica del tipo elegido. */
  rubrica: EvaluacionRubrica[];
  /** Conteo de muletillas detectadas sobre la transcripción. */
  muletillas: ConteoMuletillas;
  /** Duración real del pitch (hasta que se detuvo la grabación), en segundos. */
  tiempo_real_segundos: number;
  /** Duración máxima seleccionada por el usuario, en segundos. */
  tiempo_maximo_segundos: number;
  /**
   * Pasos de razonamiento del Análisis Ultra (qué buscó, qué halló o faltó).
   * Ausente en el análisis estándar.
   */
  traza?: string[];
}

// Cuerpo de la petición POST a /api/analizar-pitch. El frontend envía la
// transcripción + contexto; el análisis (modelo + muletillas) corre server-side.
export interface SolicitudAnalisis {
  transcripcion: string;
  tipoPitch: TipoPitch;
  duracionMaxima: DuracionMaxima;
  /** Tiempo real que duró el pitch, en segundos (docs/alcance.md §7). */
  tiempoRealSegundos: number;
  /**
   * Nivel del modelo. Por defecto `estandar`. `ultra` reanaliza con razonamiento
   * extendido (Nebius Ultra); Gemini ignora el valor.
   */
  nivel?: "estandar" | "ultra" | "rapido";
}

/** Cuerpo de POST /api/sparring/pregunta. */
export interface SolicitudPreguntaSparring {
  tipoPitch: TipoPitch;
  /** Nombre del punto de rúbrica no cumplido (mismo texto que la rúbrica). */
  punto: string;
}

/** Respuesta de POST /api/sparring/pregunta. */
export interface RespuestaPreguntaSparring {
  pregunta: string;
}

/** Cuerpo de POST /api/sparring/evaluar. */
export interface SolicitudEvaluacionSparring {
  tipoPitch: TipoPitch;
  punto: string;
  pregunta: string;
  /** Respuesta hablada o escrita del usuario. */
  respuesta: string;
}

/** Un turno de sparring (pregunta + respuesta + evaluación). */
export interface TurnoSparring {
  punto: string;
  pregunta: string;
  respuesta: string;
  cumplido: boolean;
  comentario: string;
}

/**
 * Sparring completado en la sesión (solo en memoria; no se persiste).
 * `preguntasHechas` es Y (preguntas hechas, máx. 3) y `puntosReforzados`
 * es X (turnos con cumplido === true).
 */
export interface SparringCompletado {
  tipoPitch: TipoPitch;
  turnos: TurnoSparring[];
  preguntasHechas: number;
  puntosReforzados: number;
}
