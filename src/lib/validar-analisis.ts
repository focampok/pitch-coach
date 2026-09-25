import type { EvaluacionRubrica } from "@/types/pitch";
import type { PuntoRubrica } from "./rubricas";
import type { EsquemaJson } from "./modelo";

// Validación y cálculo del score del análisis. Módulo PURO: no hace I/O, no
// lee variables de entorno y no conoce el proveedor del modelo.
//
// El modelo NO decide el score ni los nombres de los puntos: devuelve, en el
// mismo orden que la rúbrica, solo { cumplido, comentario } por punto, más
// `claridad` (entero 0-20) y `veredicto_corto`. El servidor reconstruye los
// nombres desde RUBRICAS por índice y calcula el score de forma determinista.
//
// Cualquier desviación de forma (número de ítems distinto al de la rúbrica,
// tipos incorrectos) se lanza como error de validación: la capa de modelo lo
// trata como error reintentable, de modo que se usa el reintento existente.

/** Porción del análisis que produce el modelo (sin score: lo calcula el servidor). */
export interface AnalisisModelo {
  veredicto_corto: string;
  claridad: number;
  rubrica: EvaluacionRubrica[];
}

/** Rango máximo que aporta la claridad al score. */
export const CLARIDAD_MAXIMA = 20;

/** Puntos máximos que aporta la cobertura de la rúbrica. */
export const COBERTURA_MAXIMA = 80;

/** Error de forma/parseo. Reintentable por la capa de modelo. */
export class ErrorValidacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorValidacion";
  }
}

/**
 * Esquema neutro (JSON Schema) que el adaptador traduce al dialecto del
 * proveedor. `rubrica` debe traer exactamente un ítem por punto de la rúbrica,
 * en el mismo orden — la longitud se verifica en `validarAnalisis`, no aquí.
 */
export const ESQUEMA_ANALISIS: EsquemaJson = {
  type: "object",
  properties: {
    veredicto_corto: {
      type: "string",
      description:
        "Veredicto de 1 a 2 frases en español, para leer en voz alta, tono de coach.",
    },
    claridad: {
      type: "integer",
      description: "Claridad y fluidez de la exposición, entero de 0 a 20.",
    },
    rubrica: {
      type: "array",
      description:
        "Un objeto por cada punto de la rúbrica, EN EL MISMO ORDEN en que se listaron. No incluir el nombre del punto.",
      items: {
        type: "object",
        properties: {
          cumplido: {
            type: "boolean",
            description: "true si la transcripción cubre este punto.",
          },
          comentario: {
            type: "string",
            description: "Comentario breve en español (máx. 1 frase).",
          },
        },
      },
    },
  },
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/** Acota un número al rango [min, max]. */
function acotar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/**
 * Calcula el score de forma determinista:
 *   score = clamp( round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100 )
 */
export function calcularScore(
  cumplidos: number,
  total: number,
  claridad: number,
): number {
  if (total <= 0) return 0;
  const cobertura = Math.round((cumplidos / total) * COBERTURA_MAXIMA);
  const claridadAcotada = acotar(claridad, 0, CLARIDAD_MAXIMA);
  return acotar(cobertura + claridadAcotada, 0, 100);
}

/**
 * Valida la respuesta del modelo contra la rúbrica y devuelve el análisis con
 * los nombres de punto asignados por índice y el score ya calculado.
 *
 * @throws {ErrorValidacion} si la forma no coincide o el número de ítems difiere.
 */
export function validarAnalisis(
  datos: unknown,
  rubrica: readonly PuntoRubrica[],
): AnalisisModelo & { score: number } {
  if (!esObjeto(datos)) {
    throw new ErrorValidacion("La respuesta del modelo no es un objeto JSON.");
  }

  const { veredicto_corto, claridad, rubrica: items } = datos;

  if (typeof veredicto_corto !== "string" || veredicto_corto.trim() === "") {
    throw new ErrorValidacion("La respuesta del modelo no trae un veredicto_corto válido.");
  }

  if (typeof claridad !== "number" || !Number.isFinite(claridad)) {
    throw new ErrorValidacion("La respuesta del modelo no trae una claridad numérica válida.");
  }

  if (!Array.isArray(items)) {
    throw new ErrorValidacion("La respuesta del modelo no trae una rúbrica (array) válida.");
  }

  // Un error aquí es un error de parseo: usará el reintento existente.
  if (items.length !== rubrica.length) {
    throw new ErrorValidacion(
      `La rúbrica del modelo tiene ${items.length} ítem(s); se esperaban ${rubrica.length}.`,
    );
  }

  const evaluaciones: EvaluacionRubrica[] = rubrica.map((punto, indice) => {
    const item = items[indice];
    if (!esObjeto(item)) {
      throw new ErrorValidacion(`El ítem ${indice + 1} de la rúbrica no es un objeto válido.`);
    }
    if (typeof item.cumplido !== "boolean") {
      throw new ErrorValidacion(`El ítem ${indice + 1} no trae "cumplido" como booleano.`);
    }
    return {
      // El nombre lo pone el servidor desde RUBRICAS, nunca el modelo.
      punto: punto.punto,
      cumplido: item.cumplido,
      comentario: typeof item.comentario === "string" ? item.comentario : "",
    };
  });

  const cumplidos = evaluaciones.filter((e) => e.cumplido).length;

  return {
    veredicto_corto,
    claridad,
    rubrica: evaluaciones,
    score: calcularScore(cumplidos, rubrica.length, claridad),
  };
}
