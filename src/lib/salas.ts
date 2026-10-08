import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";
import { recortarTexto } from "./texto-corto";

/**
 * Sala pública que objeta el pitch. Una por tipo: no es una rúbrica nueva
 * ni un eje de segmentación. Los cinco ids de `rubricas.ts` no cambian.
 */
export type SalaId = "inversion" | "aula" | "comite" | "comprador";

export const SALA_POR_TIPO: Record<TipoPitch, SalaId> = {
  capital: "inversion",
  educacion: "aula",
  innovacion: "comite",
  tecnologia: "comprador",
};

/** Una sola objeción por práctica: una búsqueda, un extract, una validación. */
export const MAX_OBJECIONES_SALA = 1;

const ANGULO: Record<Idioma, Record<SalaId, string>> = {
  es: {
    inversion: "pregunta de inversor",
    aula: "pregunta de evaluacion educativa",
    comite: "criterio de comite de innovacion",
    comprador: "pregunta de comprador tecnico",
  },
  en: {
    inversion: "investor question",
    aula: "classroom assessment question",
    comite: "innovation committee criterion",
    comprador: "technical buyer question",
  },
};

export function salaDeTipo(tipoPitch: TipoPitch): SalaId {
  return SALA_POR_TIPO[tipoPitch];
}

/**
 * Query de la sala. Solo el ángulo público, entidades cortas y el nombre del
 * punto. `limpiarTermino` (vía `recortarTexto`) le quita la puntuación de
 * oración para que no viaje texto dictado.
 */
export function construirQuerySala(datos: {
  idioma: Idioma;
  sala: SalaId;
  puntoNombre: string;
  entidades: readonly string[];
  tipoNombre: string;
}): string {
  const partes = [ANGULO[datos.idioma][datos.sala]];
  const entidades = datos.entidades.length > 0 ? datos.entidades : [datos.tipoNombre];
  for (const entidad of entidades) {
    const limpia = recortarTexto(entidad, 40);
    if (limpia) partes.push(limpia);
  }
  const punto = recortarTexto(datos.puntoNombre, 40);
  if (punto) partes.push(punto);
  return partes.join(" ").slice(0, 180).trim();
}
