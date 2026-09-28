import type { Idioma } from "@/types/idioma";
import type { EsquemaJson } from "./modelo";

// Validación de la evaluación de una respuesta de sparring. Módulo PURO: no
// hace I/O ni lee variables de entorno.
//
// El modelo devuelve solo { cumplido, comentario }. La validación local es
// tolerante a campos extra (los descarta) y estricta en la forma exigida
// (objeto, cumplido booleano). Misma política que `validarAnalisis`.

/** Evaluación de una respuesta de sparring (sin el nombre del punto). */
export interface EvaluacionSparring {
  cumplido: boolean;
  comentario: string;
}

/** Error de forma/parseo. Reintentable por la capa de modelo. */
export class ErrorValidacionSparring extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorValidacionSparring";
  }
}

/**
 * Descripciones del esquema, por idioma. Son instrucciones para el modelo: acá
 * se le dice en qué idioma tiene que escribir, así que viajan con el idioma de
 * la petición. Los NOMBRES de los campos (`cumplido`, `comentario`, `pregunta`)
 * no se traducen: son el contrato del JSON.
 */
interface DescripcionesEsquemaSparring {
  cumplido: string;
  comentario: string;
  pregunta: string;
}

const DESCRIPCIONES: Record<Idioma, DescripcionesEsquemaSparring> = {
  es: {
    cumplido: "true si la respuesta cubre el punto de la rúbrica.",
    comentario: "Comentario breve en español (máx. 1 frase).",
    pregunta: "Una sola pregunta de seguimiento en español, para leer en voz alta.",
  },
  en: {
    cumplido: "true if the answer covers the rubric point.",
    comentario: "Short comment in English (1 sentence max).",
    pregunta: "A single follow-up question in English, meant to be read aloud.",
  },
};

/**
 * Esquema neutro (JSON Schema) de la evaluación. El adaptador lo traduce al
 * dialecto del proveedor. La forma se verifica en `validarEvaluacionSparring`.
 */
export function esquemaEvaluacionSparring(idioma: Idioma): EsquemaJson {
  const textos = DESCRIPCIONES[idioma];
  return {
    type: "object",
    properties: {
      cumplido: { type: "boolean", description: textos.cumplido },
      comentario: { type: "string", description: textos.comentario },
    },
  };
}

/**
 * Esquema restringido para salida estructurada estricta (Nebius /
 * `response_format.json_schema` + `strict: true`):
 * solo `{ cumplido, comentario }`, ambos required, `additionalProperties: false`.
 */
export function construirEsquemaSparringRestringido(idioma: Idioma): EsquemaJson {
  const textos = DESCRIPCIONES[idioma];
  return {
    type: "object",
    additionalProperties: false,
    required: ["cumplido", "comentario"],
    properties: {
      cumplido: { type: "boolean", description: textos.cumplido },
      comentario: { type: "string", description: textos.comentario },
    },
  };
}

/** Esquema neutro de la pregunta de seguimiento. */
export function esquemaPreguntaSparring(idioma: Idioma): EsquemaJson {
  return {
    type: "object",
    properties: {
      pregunta: { type: "string", description: DESCRIPCIONES[idioma].pregunta },
    },
  };
}

/** Esquema restringido de la pregunta: solo `{ pregunta }`, required, sin extras. */
export function construirEsquemaPreguntaSparringRestringido(idioma: Idioma): EsquemaJson {
  return {
    type: "object",
    additionalProperties: false,
    required: ["pregunta"],
    properties: {
      pregunta: { type: "string", description: DESCRIPCIONES[idioma].pregunta },
    },
  };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/** Pregunta de seguimiento generada por el modelo. */
export interface PreguntaSparring {
  pregunta: string;
}

/** Valida la pregunta generada. Ignora campos extra; exige `pregunta` no vacía. */
export function validarPreguntaSparring(datos: unknown): PreguntaSparring {
  if (!esObjeto(datos)) {
    throw new ErrorValidacionSparring("La respuesta del modelo no es un objeto JSON.");
  }
  if (typeof datos.pregunta !== "string" || datos.pregunta.trim() === "") {
    throw new ErrorValidacionSparring("La respuesta no trae una pregunta válida.");
  }
  return { pregunta: datos.pregunta.trim() };
}

/**
 * Valida la evaluación del modelo. Ignora campos extra; exige `cumplido`
 * booleano. Si falta `comentario`, lo deja vacío.
 *
 * @throws {ErrorValidacionSparring} si la forma no coincide.
 */
export function validarEvaluacionSparring(datos: unknown): EvaluacionSparring {
  if (!esObjeto(datos)) {
    throw new ErrorValidacionSparring("La respuesta del modelo no es un objeto JSON.");
  }

  if (typeof datos.cumplido !== "boolean") {
    throw new ErrorValidacionSparring('La respuesta no trae "cumplido" como booleano.');
  }

  return {
    cumplido: datos.cumplido,
    comentario: typeof datos.comentario === "string" ? datos.comentario : "",
  };
}
