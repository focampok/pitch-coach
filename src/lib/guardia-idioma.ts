import type { Idioma } from "@/types/idioma";

/**
 * Guardia determinista de idioma para las salidas cortas de Nano.
 *
 * Caso real (pasada 3 del QA en inglés): con un pitch que nombra "Contable" y
 * países hispanos, Nano devolvió las entidades (`"contabilidad software"`,
 * `"pequeñas tiendas"`) y las cifras dichas (`"420 tiendas"`, `"15 % mes a
 * mes"`) en español aunque el system, el esquema y el user iban en inglés.
 * El modelo no es determinista en esto; la guardia sí.
 *
 * Solo cubre la sesión en inglés: un texto con marcadores claros de español
 * (tildes, ñ, signos de apertura o palabras que no existen en inglés) se
 * considera "en otro idioma". En sesión en español no se bloquea nada: el
 * inglés se cuela mucho menos y muchos términos técnicos son legítimos.
 */

/** Palabras españolas frecuentes en entidades y cifras que no existen en inglés. */
const PALABRAS_ESPANOL = new Set([
  "tienda",
  "tiendas",
  "pequeña",
  "pequeñas",
  "pequeño",
  "pequeños",
  "mes",
  "meses",
  "mensual",
  "mensuales",
  "anual",
  "anuales",
  "año",
  "años",
  "ciento",
  "contabilidad",
  "contable",
  "contables",
  "usuarios",
  "usuarias",
  "clientes",
  "empresas",
  "empresa",
  "comercios",
  "comercio",
  "negocios",
  "negocio",
  "dólares",
  "dolares",
  "pesos",
  "millones",
  "millón",
  "ventas",
  "crecimiento",
  "mercado",
  "software contable",
  "de",
  "del",
  "los",
  "las",
  "en",
  "con",
  "para",
  "por",
  "sobre",
  "hasta",
]);

/**
 * true si el texto trae marcadores claros de español: tildes o ñ, signos de
 * apertura, o una palabra de `PALABRAS_ESPANOL` entera.
 */
export function pareceEspanol(texto: string): boolean {
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(texto)) return true;
  const palabras = texto
    .toLowerCase()
    .split(/[^a-záéíóúñ]+/i)
    .filter(Boolean);
  return palabras.some((palabra) => PALABRAS_ESPANOL.has(palabra));
}

/**
 * true si un texto corto NO está en el idioma de la sesión. Hoy solo detecta
 * español en sesión en inglés; en sesión en español devuelve siempre false.
 */
export function enOtroIdioma(texto: string, idioma: Idioma): boolean {
  if (idioma !== "en") return false;
  return pareceEspanol(texto);
}

/**
 * Separa una lista corta en lo que está en el idioma de la sesión y lo que
 * no. Las dos listas conservan el orden.
 */
export function separarPorIdioma(
  valores: readonly string[],
  idioma: Idioma,
): { enIdioma: string[]; enOtro: string[] } {
  const enIdioma: string[] = [];
  const enOtro: string[] = [];
  for (const valor of valores) {
    if (enOtroIdioma(valor, idioma)) enOtro.push(valor);
    else enIdioma.push(valor);
  }
  return { enIdioma, enOtro };
}

/** Instrucción que se añade al system en el reintento (solo en inglés). */
export function refuerzoIdioma(idioma: Idioma): string {
  if (idioma !== "en") return "";
  return `

LANGUAGE CHECK FAILED: your previous answer contained Spanish words. This session is in ENGLISH. Every string in your answer MUST be written in English, even if the pitch mentions Spanish brand names, Spanish-speaking countries or Spanish words. Translate units and nouns ("tiendas" → "shops", "mes a mes" → "month over month", "software contable" → "accounting software").`;
}
