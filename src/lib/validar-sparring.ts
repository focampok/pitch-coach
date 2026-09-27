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
 * Esquema neutro (JSON Schema) de la evaluación. El adaptador lo traduce al
 * dialecto del proveedor. La forma se verifica en `validarEvaluacionSparring`.
 */
export const ESQUEMA_EVALUACION_SPARRING: EsquemaJson = {
  type: "object",
  properties: {
    cumplido: {
      type: "boolean",
      description: "true si la respuesta cubre el punto de la rúbrica.",
    },
    comentario: {
      type: "string",
      description: "Comentario breve en español (máx. 1 frase).",
    },
  },
};

/**
 * Esquema restringido para salida estructurada estricta (Nebius /
 * `response_format.json_schema` + `strict: true`):
 * solo `{ cumplido, comentario }`, ambos required, `additionalProperties: false`.
 */
export function construirEsquemaSparringRestringido(): EsquemaJson {
  const base = ESQUEMA_EVALUACION_SPARRING as {
    properties: {
      cumplido: Record<string, unknown>;
      comentario: Record<string, unknown>;
    };
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["cumplido", "comentario"],
    properties: {
      cumplido: { ...base.properties.cumplido },
      comentario: { ...base.properties.comentario },
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

/** Esquema neutro de la pregunta de seguimiento. */
export const ESQUEMA_PREGUNTA_SPARRING: EsquemaJson = {
  type: "object",
  properties: {
    pregunta: {
      type: "string",
      description: "Una sola pregunta de seguimiento en español, para leer en voz alta.",
    },
  },
};

/** Esquema restringido de la pregunta: solo `{ pregunta }`, required, sin extras. */
export function construirEsquemaPreguntaSparringRestringido(): EsquemaJson {
  const base = ESQUEMA_PREGUNTA_SPARRING as {
    properties: { pregunta: Record<string, unknown> };
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["pregunta"],
    properties: {
      pregunta: { ...base.properties.pregunta },
    },
  };
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
