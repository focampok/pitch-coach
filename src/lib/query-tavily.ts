/**
 * Construcción de la query de Tavily (Fase B, §12 del alcance).
 *
 * -----------------------------------------------------------------------------
 * QUÉ CAMBIÓ RESPECTO A LA FASE A (y por qué)
 * -----------------------------------------------------------------------------
 * La Fase A armaba la query como
 *   prefijo + entidades + nombre del punto + comentario del modelo
 * y el `comentario` es el problema: describe lo que FALTA ("Carece de tracción:
 * no da ninguna cifra"). Metido en una búsqueda, sesga el resultado hacia
 * páginas que EXPLICAN el concepto en vez de páginas que dan la cifra —
 * exactamente el artículo de metodología de "cómo calcular el tamaño de
 * mercado" que reportaron las pruebas manuales.
 *
 * Ahora hay dos caminos:
 *   1. `redactarQueryConModelo` (nivel `rapido`): le pide al modelo una frase de
 *      búsqueda CORTA orientada a una CIFRA, prohibiéndole explícitamente
 *      términos de comentario/evaluación.
 *   2. `construirQueryTavily` (puro): respaldo determinista si el modelo falla.
 *      Ya no incluye el comentario; solo entidades + nombre del punto.
 *
 * -----------------------------------------------------------------------------
 * PRIVACIDAD
 * -----------------------------------------------------------------------------
 * El modelo de la query SOLO recibe entidades cortas y etiquetas del producto,
 * nunca la transcripción. La query final se limpia (sin puntuación de oración)
 * y se recorta a `MAX_QUERY_CARACTERES`.
 * -----------------------------------------------------------------------------
 */

import type { Idioma } from "@/types/idioma";
import { llamarModelo, type EsquemaJson } from "./modelo";
import { MAX_ENTIDADES, MAX_ENTIDAD_CARACTERES } from "./entidades-tavily";
import { recortarTexto } from "./texto-corto";

/** Tope duro de la query completa, sumando todas las piezas. */
export const MAX_QUERY_CARACTERES = 300;

/** Tope de términos que se concatenan en la query de respaldo. */
export const MAX_TERMINOS_QUERY = 5;

/**
 * Prefijo de la query de respaldo por idioma. Pide una cifra, no una página
 * promocional. Es texto genérico del producto, no del usuario.
 */
export const PREFIJOS: Record<Idioma, string> = {
  es: "cifra reciente",
  en: "recent figure",
};

/** Puntos suspensivos si la query viene larga (solo informativo). */
const MAX_QUERY_MODELO_CARACTERES = 160;

/** Nivel del modelo para redactar la query: barato y sin razonamiento. */
const NIVEL_QUERY = "rapido" as const;

const NOMBRE_ESQUEMA_QUERY = "query_tavily";

/**
 * true si la entidad es corta y puede referirse a varias cosas: una sola
 * palabra corta, una sigla en mayúsculas ("ELF", "TAM") o camelCase ("eBay").
 *
 * El caso real: el producto "ELF" (una cortadora de papel) hizo que Tavily
 * devolviera noticias financieras de "e.l.f. Beauty" (cosméticos). Una entidad
 * así NUNCA debe viajar sola en la query.
 */
export function esEntidadAmbigua(entidad: string): boolean {
  const limpio = entidad.trim();
  if (limpio === "") return true;
  if (limpio.length > 16) return false;

  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length > 1) return false;

  const letras = limpio.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length < 2) return false;

  // Siglas con puntos: "e.l.f.", "U.S.A."
  if (/^([A-Za-z]\.){1,}[A-Za-z]?$/.test(limpio)) return true;

  // Todo en mayúsculas y corto: "ELF", "TAM", "ERP".
  if (limpio === limpio.toUpperCase() && letras.length <= 10) return true;

  // camelCase: "eBay", "iPhone".
  if (/^[A-Za-z]*[a-z][A-Z][A-Za-z]*$/.test(limpio)) return true;

  return false;
}

/** Separa las entidades en normales y potencialmente ambiguas. */
export function separarEntidades(entidades: readonly string[]): {
  primarias: string[];
  ambiguas: string[];
} {
  const primarias: string[] = [];
  const ambiguas: string[] = [];
  for (const entidad of entidades.slice(0, MAX_ENTIDADES)) {
    if (esEntidadAmbigua(entidad)) ambiguas.push(entidad);
    else primarias.push(entidad);
  }
  return { primarias, ambiguas };
}

/** Insumos del constructor de query de respaldo. */
export interface DatosQueryTavily {
  /** Nombre visible del punto de rúbrica que falló (etiqueta del producto). */
  puntoNombre: string;
  /** Entidades cortas del pitch (ver entidades-tavily.ts). */
  entidades?: readonly string[];
  /** Nombre visible del tipo de pitch; contexto cuando no hay entidades. */
  tipoNombre?: string;
  idioma: Idioma;
}

/**
 * Query de RESPALDO, pura y determinista. Solo entidades + nombre del punto
 * (+ tipos de pitch si no hay entidades). Nunca incluye el comentario negativo.
 *
 * Regla de ambigüedad: una entidad ambigua se agrega SOLO si ya hay otra entidad
 * o el tipo de pitch que la acompañe; sola nunca entra (choque de nombres).
 */
export function construirQueryTavily(datos: DatosQueryTavily): string {
  const { puntoNombre, entidades, tipoNombre, idioma } = datos;

  const terminos: string[] = [];
  const vistos = new Set<string>();

  const agregar = (bruto: string | undefined, max: number): boolean => {
    if (!bruto) return false;
    const limpio = recortarTexto(bruto, max);
    if (limpio === "") return false;
    const clave = limpio.toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    terminos.push(limpio);
    return true;
  };

  const { primarias, ambiguas } = separarEntidades(entidades ?? []);

  let agregadas = 0;
  for (const entidad of primarias) {
    if (agregadas >= MAX_TERMINOS_QUERY) break;
    if (agregar(entidad, MAX_ENTIDAD_CARACTERES)) agregadas += 1;
  }

  // Degradación: sin entidades normales, el tipo de pitch es el contexto.
  if (agregadas === 0) agregar(tipoNombre, MAX_ENTIDAD_CARACTERES);

  // Las ambiguas entran solo acompañadas (por una entidad o por el tipo).
  if (terminos.length > 0) {
    for (const entidad of ambiguas) {
      if (agregadas >= MAX_TERMINOS_QUERY) break;
      if (agregar(entidad, MAX_ENTIDAD_CARACTERES)) agregadas += 1;
    }
  }

  agregar(puntoNombre, MAX_ENTIDAD_CARACTERES);

  const query = `${PREFIJOS[idioma]} ${terminos.join(" ")}`.trim();
  return query.slice(0, MAX_QUERY_CARACTERES).trim();
}

// -----------------------------------------------------------------------------
// Query redactada por el modelo (camino principal)
// -----------------------------------------------------------------------------

/** Esquema estricto: `{ query: string }`. */
export function esquemaQueryRestringido(idioma: Idioma): EsquemaJson {
  const descripcion =
    idioma === "en"
      ? "A short web search phrase (max 12 words) aimed at finding a concrete FIGURE or statistic. No evaluation or commentary words."
      : "Una frase de búsqueda web corta (máximo 12 palabras) orientada a encontrar una CIFRA o estadística concreta. Sin palabras de comentario ni evaluación.";

  return {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", description: descripcion, maxLength: MAX_QUERY_MODELO_CARACTERES },
    },
  };
}

/** Valida y limpia la query del modelo. Reintentable si viene vacía. */
export function validarRespuestaQuery(datos: unknown): string {
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
    throw new Error("La respuesta del modelo no es un objeto JSON.");
  }
  const bruto = (datos as Record<string, unknown>).query;
  const query = recortarTexto(typeof bruto === "string" ? bruto : "", MAX_QUERY_MODELO_CARACTERES);
  const palabras = query.split(/\s+/).filter(Boolean);
  // Una frase larga o con números suele ser una cifra inventada por el modelo
  // (el año lo agrega el llamador). Mejor fallar y usar la query de respaldo.
  if (query === "" || palabras.length > 12 || /\d/.test(query)) {
    throw new Error("La query del modelo no es una frase corta y sin cifras.");
  }
  return query;
}

function construirSystemQuery(idioma: Idioma): string {
  if (idioma === "en") {
    return `You write ONE short web search phrase (max 12 words) to find a concrete FIGURE or statistic that backs up a point of a pitch.

Rules:
- The phrase must target a NUMERIC datum (market size, growth, price, users), never a concept or a methodology.
- Use only the terms you receive. Do not invent proper nouns, countries, or numbers.
- FORBIDDEN: commentary or evaluation terms such as "lacks", "no data", "missing", "without figure", "does not mention".
- Write it in the pitch's language. No punctuation, no quotes.

Reply ONLY with the requested structured JSON.`;
  }

  return `Redactas UNA frase de búsqueda web corta (máximo 12 palabras) para encontrar una CIFRA o estadística concreta que refuerce un punto de un pitch.

Reglas:
- La frase debe apuntar a un DATO numérico (tamaño de mercado, crecimiento, precio, usuarios), nunca a un concepto ni a una metodología.
- Usa solo los términos que recibes. No inventes nombres propios, países ni números.
- PROHIBIDO: términos de comentario o evaluación como "carece", "no da", "falta", "sin cifra", "no se menciona".
- Escríbela en el idioma del pitch. Sin puntuación, sin comillas.

Responde ÚNICAMENTE con el JSON estructurado solicitado.`;
}

function construirUserQuery(datos: DatosQueryTavily & { queBuscar?: string }): string {
  const entidades = (datos.entidades ?? []).join(", ") || "(ninguna)";
  const contexto = datos.queBuscar ? `\n- Qué se busca: ${datos.queBuscar}` : "";
  return `Datos del pitch:
- Punto que falló: ${datos.puntoNombre}${contexto}
- Tipo de pitch: ${datos.tipoNombre ?? "(no especificado)"}
- Entidades del pitch: ${entidades}`;
}

/**
 * Pide al modelo una query orientada a cifras. Devuelve `null` si no hay
 * entidades (no tiene insumos) o si el modelo falla; el llamador cae al
 * constructor puro.
 */
export async function redactarQueryConModelo(
  datos: DatosQueryTavily & { queBuscar?: string },
): Promise<string | null> {
  if (!datos.entidades || datos.entidades.length === 0) return null;

  try {
    const texto = await llamarModelo<string>(
      {
        system: construirSystemQuery(datos.idioma),
        user: construirUserQuery(datos),
        idioma: datos.idioma,
        esquema: esquemaQueryRestringido(datos.idioma),
        nombreEsquema: NOMBRE_ESQUEMA_QUERY,
        validar: validarRespuestaQuery,
      },
      NIVEL_QUERY,
    );
    // El año ayuda a que la búsqueda priorice cifras recientes.
    return `${texto} ${new Date().getFullYear()}`.slice(0, MAX_QUERY_CARACTERES).trim();
  } catch (err) {
    console.warn("[tavily] redacción de la query falló; se usa la de respaldo:", err);
    return null;
  }
}
