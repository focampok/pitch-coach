import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";
import {
  construirQueryCifra,
  extraerCifrasDichas,
  mismaMagnitud,
  type VeredictoCifra,
} from "./cifras-dichas";
import { extraerContenido } from "./tavily-extract";
import { buscarFuentes } from "./tavily";
import { comparteEntidad, validarContenido } from "./validar-sugerencia";

/**
 * Contrasta hasta una cifra dicha contra la web.
 *
 * Si la búsqueda falla, esa cifra no se reporta: decir "no hallamos fuente"
 * cuando Tavily no respondió sería un falso negativo. Si la búsqueda responde
 * y ninguna fuente es del mismo orden y del tema, el estado es `sin_fuente`.
 * La transcripción no sale de esta función hacia Tavily.
 */
export async function verificarCifrasDichas(datos: {
  transcripcion: string;
  tipoPitch: TipoPitch;
  tipoNombre: string;
  idioma: Idioma;
  entidades: readonly string[];
}): Promise<VeredictoCifra[]> {
  const cifras = await extraerCifrasDichas(datos.transcripcion, datos.idioma);
  const veredictos: VeredictoCifra[] = [];

  for (const cifra of cifras) {
    const query = construirQueryCifra({
      idioma: datos.idioma,
      cifra,
      entidades: datos.entidades,
      tipoNombre: datos.tipoNombre,
    });
    let fuentes;
    try {
      fuentes = await buscarFuentes(query, { idioma: datos.idioma, tipoPitch: datos.tipoPitch });
    } catch (err) {
      console.warn("[cifras] búsqueda falló:", err);
      continue;
    }

    let hallada: VeredictoCifra | null = null;
    for (const fuente of fuentes) {
      const extraido = await extraerContenido(fuente.url, { personalizar: query });
      if (!extraido) continue;
      const validacion = await validarContenido(extraido.contenido, datos.idioma, datos.entidades);
      if (!validacion.util) continue;
      if (!mismaMagnitud(cifra, validacion.cifra)) continue;
      const corpus = `${fuente.title} ${validacion.cita} ${validacion.cifra}`;
      if (!comparteEntidad(corpus, datos.entidades)) continue;
      hallada = {
        cifra,
        estado: "con_fuente",
        cifraFuente: validacion.cifra,
        titulo: fuente.title,
        url: fuente.url,
        cita: validacion.cita,
      };
      break;
    }

    veredictos.push(hallada ?? { cifra, estado: "sin_fuente" });
  }

  return veredictos;
}
