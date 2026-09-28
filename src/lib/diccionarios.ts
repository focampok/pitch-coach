import type { Idioma } from "@/types/idioma";
import { es, type Diccionario } from "./diccionario-es";
import { en } from "./diccionario-en";

// Selección de diccionario por idioma. Es un mapa completo (Record<Idioma, …>),
// así que agregar un idioma al union `Idioma` obliga a agregarlo también acá.
//
// Los diccionarios viven en archivos PLANOS (diccionario-es.ts, diccionario-en.ts)
// a propósito: la prueba de humo de scripts/ las importa con el type stripping
// nativo de Node, que resuelve archivos pero no imports de directorio.

export const DICCIONARIOS: Record<Idioma, Diccionario> = { es, en };

/** Diccionario del idioma pedido. */
export function diccionario(idioma: Idioma): Diccionario {
  return DICCIONARIOS[idioma];
}

export type { Diccionario };
