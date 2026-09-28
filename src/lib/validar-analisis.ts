import type { Idioma } from "@/types/idioma";
import type { EvaluacionRubrica } from "@/types/pitch";
import type { PuntoRubrica } from "./rubricas";
import type { EsquemaJson } from "./modelo";

// Validación y cálculo del score del análisis. Módulo PURO: no hace I/O, no
// lee variables de entorno y no conoce el proveedor del modelo.
//
// El modelo NO decide el score ni los puntos de la rúbrica: devuelve, en el
// mismo orden que la rúbrica, solo { cumplido, comentario } por punto, más
// `claridad` (entero 0-20) y `veredicto_corto`. El servidor asigna el id de
// cada punto desde RUBRICAS por índice y calcula el score de forma determinista.
//
// Cualquier desviación de forma (número de ítems distinto al de la rúbrica,
// tipos incorrectos) se lanza como error de validación: la capa de modelo lo
// trata como error reintentable, de modo que se usa el reintento existente.

/** Porción del análisis que produce el modelo (sin score: lo calcula el servidor). */
export interface AnalisisModelo {
  veredicto_corto: string;
  claridad: number;
  rubrica: EvaluacionRubrica[];
  /** Pasos de razonamiento (solo Análisis Ultra). */
  traza?: string[];
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
 * Descripciones del esquema, por idioma.
 *
 * Importan más de lo que parecen: son INSTRUCCIONES para el modelo, no solo
 * documentación. Ahí es donde se le dice en qué idioma tiene que escribir el
 * veredicto y los comentarios, así que tienen que viajar con el idioma de la
 * petición — si no, en inglés el modelo seguiría contestando en español.
 *
 * Los NOMBRES de los campos (`cumplido`, `comentario`, `claridad`,
 * `veredicto_corto`, `traza`) no se traducen nunca: son el contrato del JSON.
 */
interface DescripcionesEsquema {
  veredictoCorto: string;
  claridad: string;
  rubrica: string;
  cumplido: string;
  comentario: string;
  comentarioUltra: string;
  traza: string;
}

const DESCRIPCIONES_ESQUEMA: Record<Idioma, DescripcionesEsquema> = {
  es: {
    veredictoCorto:
      "Veredicto de 1 a 2 frases en español, para leer en voz alta, tono de coach.",
    claridad: "Claridad y fluidez de la exposición, entero de 0 a 20.",
    rubrica:
      "Un objeto por cada punto de la rúbrica, EN EL MISMO ORDEN en que se listaron. No incluir el nombre del punto.",
    cumplido: "true si la transcripción cubre este punto.",
    comentario: "Comentario breve en español (máx. 1 frase).",
    comentarioUltra:
      "Comentario en español (2 a 4 frases): cita evidencia de la transcripción y explica por qué.",
    traza:
      "Pasos de razonamiento (4 a 8): qué buscaste, qué hallaste o faltó, y cómo decidiste cada punto.",
  },
  en: {
    veredictoCorto:
      "Verdict of 1 to 2 sentences in English, to be read aloud, coach tone.",
    claridad: "How clear and fluent the delivery was, integer from 0 to 20.",
    rubrica:
      "One object per rubric point, IN THE SAME ORDER the points were listed. Do not include the point name.",
    cumplido: "true if the transcript covers this point.",
    comentario: "Short comment in English (1 sentence max).",
    comentarioUltra:
      "Comment in English (2 to 4 sentences): quote evidence from the transcript and explain why.",
    traza:
      "Reasoning steps (4 to 8): what you looked for, what you found or missed, and how you decided each point.",
  },
};

/**
 * Esquema neutro (JSON Schema) que el adaptador traduce al dialecto del
 * proveedor, con las descripciones en `idioma`. `rubrica` debe traer
 * exactamente un ítem por punto de la rúbrica, en el mismo orden — la longitud
 * se verifica en `validarAnalisis`, no aquí.
 */
export function esquemaAnalisis(idioma: Idioma): EsquemaJson {
  const textos = DESCRIPCIONES_ESQUEMA[idioma];

  return {
    type: "object",
    properties: {
      veredicto_corto: { type: "string", description: textos.veredictoCorto },
      claridad: { type: "integer", description: textos.claridad },
      rubrica: {
        type: "array",
        description: textos.rubrica,
        items: {
          type: "object",
          properties: {
            cumplido: { type: "boolean", description: textos.cumplido },
            comentario: { type: "string", description: textos.comentario },
          },
        },
      },
      traza: {
        type: "array",
        description: textos.traza,
        items: { type: "string" },
      },
    },
  };
}

// Caché para que el esquema con restricciones se genere UNA sola vez por
// combinación de idioma, traza y conjunto de puntos de rúbrica.
const CACHE_ESQUEMA_RESTRINGIDO = new Map<string, EsquemaJson>();

/**
 * Esquema restringido (JSON Schema estándar) derivado de `esquemaAnalisis`,
 * pensado para proveedores con salida estructurada estricta (Nebius /
 * OpenAI-compatible con `response_format.json_schema` + `strict: true`).
 *
 * Sobre el esquema base agrega:
 * - `minItems === maxItems === puntos.length`: obliga a un ítem por punto.
 * - `required` + `additionalProperties: false` (lo exige el modo estricto).
 *
 * Los ítems de `rubrica` son solo `{ cumplido, comentario }`: el modelo NUNCA
 * nombra los puntos. El servidor asigna cada id desde la rúbrica por índice,
 * así que aquí no se declara el campo ni un `enum` de nombres. `puntos` solo
 * fija la longitud exacta del array.
 *
 * El adaptador de Nebius lo usa; Gemini sigue usando `esquemaAnalisis`.
 */
export function construirEsquemaAnalisisRestringido(
  puntos: readonly string[],
  opciones: { idioma: Idioma; incluirTraza?: boolean },
): EsquemaJson {
  const conTraza = opciones.incluirTraza === true;
  const clave = `${opciones.idioma}\u0000${conTraza ? "traza" : "base"}\u0000${puntos.join("\u0000")}`;
  const enCache = CACHE_ESQUEMA_RESTRINGIDO.get(clave);
  if (enCache) return enCache;

  const textos = DESCRIPCIONES_ESQUEMA[opciones.idioma];

  const properties: Record<string, unknown> = {
    veredicto_corto: { type: "string", description: textos.veredictoCorto },
    claridad: { type: "integer", description: textos.claridad },
    rubrica: {
      type: "array",
      description: textos.rubrica,
      minItems: puntos.length,
      maxItems: puntos.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cumplido", "comentario"],
        properties: {
          cumplido: { type: "boolean", description: textos.cumplido },
          comentario: {
            type: "string",
            description: conTraza ? textos.comentarioUltra : textos.comentario,
          },
        },
      },
    },
  };
  const required = ["veredicto_corto", "claridad", "rubrica"];

  if (conTraza) {
    properties.traza = {
      type: "array",
      description: textos.traza,
      minItems: 4,
      maxItems: 8,
      items: { type: "string" },
    };
    required.push("traza");
  }

  const esquema: EsquemaJson = {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  };

  CACHE_ESQUEMA_RESTRINGIDO.set(clave, esquema);
  return esquema;
}

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

/** Normaliza `traza`. Si `exigir` es true, un array vacío o ausente falla. */
function normalizarTraza(valor: unknown, exigir: boolean): string[] | undefined {
  if (valor === undefined) {
    if (exigir) {
      throw new ErrorValidacion("La respuesta del modelo no trae una traza de razonamiento.");
    }
    return undefined;
  }
  if (!Array.isArray(valor)) {
    throw new ErrorValidacion("La traza del modelo no es un array.");
  }
  const pasos = valor
    .filter((paso): paso is string => typeof paso === "string")
    .map((paso) => paso.trim())
    .filter((paso) => paso !== "");
  if (exigir && pasos.length === 0) {
    throw new ErrorValidacion("La traza del modelo está vacía.");
  }
  return pasos.length > 0 ? pasos : undefined;
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
  opciones: { exigirTraza?: boolean } = {},
): AnalisisModelo & { score: number } {
  if (!esObjeto(datos)) {
    throw new ErrorValidacion("La respuesta del modelo no es un objeto JSON.");
  }

  const { veredicto_corto, claridad, rubrica: items, traza: trazaCruda } = datos;

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
      // El id lo pone el servidor desde RUBRICAS, nunca el modelo.
      punto: punto.id,
      cumplido: item.cumplido,
      comentario: typeof item.comentario === "string" ? item.comentario : "",
    };
  });

  const cumplidos = evaluaciones.filter((e) => e.cumplido).length;
  const traza = normalizarTraza(trazaCruda, opciones.exigirTraza === true);

  return {
    veredicto_corto,
    claridad,
    rubrica: evaluaciones,
    score: calcularScore(cumplidos, rubrica.length, claridad),
    ...(traza ? { traza } : {}),
  };
}
