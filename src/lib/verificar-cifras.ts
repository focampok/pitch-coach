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

/** Host de una URL para el diario; nunca la URL completa ni el contenido. */
function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "?";
  }
}

/**
 * Diario de una fuente por cifra. Solo host y motivo: nunca la cifra dicha
 * (sale de la transcripción), la cita ni el contenido extraído.
 */
function diarioCifra(indice: number, host: string, motivo: string): void {
  console.info(`[cifras] cifra=${indice + 1} host=${host} motivo=${motivo}`);
}

/**
 * Contrasta hasta una cifra dicha contra la web.
 *
 * Si la búsqueda falla, esa cifra no se reporta: decir "no hallamos fuente"
 * cuando Tavily no respondió sería un falso negativo. Si la búsqueda responde
 * y ninguna fuente es del mismo orden y del tema, el estado es `sin_fuente`.
 * La transcripción no sale de esta función hacia Tavily.
 *
 * Las cifras se verifican EN PARALELO (la pasada 3 del QA tardó 67 s con dos
 * cifras en serie, ~20 s cada una por timeouts de extracción). Dentro de cada
 * cifra, las extracciones también van en paralelo (no cuestan modelo) y la
 * validación con Nano sigue siendo secuencial con corte en la primera fuente
 * que confirma, para no duplicar llamadas al modelo.
 */
export async function verificarCifrasDichas(datos: {
  transcripcion: string;
  tipoPitch: TipoPitch;
  tipoNombre: string;
  idioma: Idioma;
  entidades: readonly string[];
}): Promise<VeredictoCifra[]> {
  const cifras = await extraerCifrasDichas(datos.transcripcion, datos.idioma);

  const veredictos = await Promise.all(
    cifras.map((cifra, indice) => verificarUnaCifra(cifra, indice, datos)),
  );

  // Se conserva el orden de las cifras; las que no se pudieron buscar salen.
  return veredictos.filter((v): v is VeredictoCifra => v !== null);
}

async function verificarUnaCifra(
  cifra: string,
  indice: number,
  datos: {
    tipoPitch: TipoPitch;
    tipoNombre: string;
    idioma: Idioma;
    entidades: readonly string[];
  },
): Promise<VeredictoCifra | null> {
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
    return null;
  }
  if (fuentes.length === 0) {
    console.info(`[cifras] cifra=${indice + 1} sin fuentes`);
    return { cifra, estado: "sin_fuente" };
  }

  // Extracción en paralelo: es solo Tavily, sin costo de modelo.
  const extraidos = await Promise.all(
    fuentes.map(async (fuente) => ({
      fuente,
      extraido: await extraerContenido(fuente.url, { personalizar: query }),
    })),
  );

  for (const { fuente, extraido } of extraidos) {
    const host = hostDe(fuente.url);
    if (!extraido) {
      diarioCifra(indice, host, "sin-extraccion");
      continue;
    }
    const validacion = await validarContenido(extraido.contenido, datos.idioma, datos.entidades);
    if (!validacion.util) {
      diarioCifra(indice, host, "no-relevante");
      continue;
    }
    if (!mismaMagnitud(cifra, validacion.cifra)) {
      diarioCifra(indice, host, "otra-magnitud");
      continue;
    }
    const corpus = `${fuente.title} ${validacion.cita} ${validacion.cifra} ${validacion.sector}`;
    if (!comparteEntidad(corpus, datos.entidades)) {
      diarioCifra(indice, host, "otro-tema");
      continue;
    }
    diarioCifra(indice, host, "ok");
    return {
      cifra,
      estado: "con_fuente",
      cifraFuente: validacion.cifra,
      titulo: fuente.title,
      url: fuente.url,
      cita: validacion.cita,
    };
  }

  return { cifra, estado: "sin_fuente" };
}
