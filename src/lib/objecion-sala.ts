import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";
import { extraerContenido } from "./tavily-extract";
import { llamarModelo, type EsquemaJson } from "./modelo";
import { etiquetaPunto, obtenerPuntoPorId } from "./rubricas";
import { construirQuerySala, salaDeTipo, type SalaId } from "./salas";
import { buscarFuentes } from "./tavily";

export interface ObjecionSala {
  punto: string;
  sala: SalaId;
  /** Pregunta corta que la página sostiene. */
  objecion: string;
  /** Cita textual que está en la página. */
  cita: string;
  titulo: string;
  url: string;
}

export const MAX_OBJECION_CARACTERES = 240;
export const MAX_CITA_OBJECION_CARACTERES = 300;

function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().toLowerCase();
}

/** La cita tiene que estar en el contenido extraído. Una paráfrasis no alcanza. */
export function citaEstaEnContenido(cita: string, contenido: string): boolean {
  const aguja = normalizar(cita);
  if (aguja.length < 12) return false;
  return normalizar(contenido).includes(aguja);
}

interface ObjecionCruda {
  util: boolean;
  objecion: string;
  cita: string;
}

function esquemaObjecion(idioma: Idioma): EsquemaJson {
  const pregunta =
    idioma === "en"
      ? "One question this page says the room would ask, in English, ending with ?. Empty if the page has no concrete question."
      : "Una pregunta que esta página dice que la sala haría, en español, terminada en ?. Vacía si la página no trae una pregunta concreta.";
  const cita =
    idioma === "en"
      ? "A short verbatim quote from the page that supports the question. Empty if there is none."
      : "Una cita textual corta de la página que sostiene la pregunta. Vacía si no hay.";
  return {
    type: "object",
    additionalProperties: false,
    required: ["util", "objecion", "cita"],
    properties: {
      util: {
        type: "boolean",
        description:
          idioma === "en"
            ? "true only if the page contains a concrete on-topic question."
            : "true solo si la página contiene una pregunta concreta y del tema.",
      },
      objecion: { type: "string", maxLength: MAX_OBJECION_CARACTERES, description: pregunta },
      cita: { type: "string", maxLength: MAX_CITA_OBJECION_CARACTERES, description: cita },
    },
  };
}

export function validarObjecionCruda(datos: unknown, contenido: string): ObjecionCruda {
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
    throw new Error("La objeción no es un objeto JSON.");
  }
  const bruto = datos as Record<string, unknown>;
  const objecion =
    typeof bruto.objecion === "string"
      ? bruto.objecion.replace(/\s+/g, " ").trim().slice(0, MAX_OBJECION_CARACTERES)
      : "";
  const cita =
    typeof bruto.cita === "string"
      ? bruto.cita.replace(/\s+/g, " ").trim().slice(0, MAX_CITA_OBJECION_CARACTERES)
      : "";
  const util =
    bruto.util === true &&
    objecion.length >= 12 &&
    objecion.includes("?") &&
    citaEstaEnContenido(cita, contenido);
  return { util, objecion: util ? objecion : "", cita: util ? cita : "" };
}

function systemObjecion(idioma: Idioma): string {
  if (idioma === "en") {
    return `You read a public web page and decide whether it contains a concrete question a pitch room would ask.

Rules:
- util is true only if the page states a specific question about the pitch point, not a how-to article and not a generic definition.
- objecion is that question, one sentence, ending with ?.
- cita is a verbatim fragment of the page (it must appear in the text you received).
- If the page does not support a question, util is false and the strings are empty.

Reply ONLY with the requested JSON.`;
  }
  return `Lees una página pública y decides si contiene una pregunta concreta que haría una sala de pitch.

Reglas:
- util es true solo si la página plantea una pregunta específica sobre el punto del pitch, no un artículo de metodología ni una definición genérica.
- objecion es esa pregunta, una oración, terminada en ?.
- cita es un fragmento textual de la página (tiene que aparecer en el texto que recibiste).
- Si la página no sostiene una pregunta, util es false y los textos van vacíos.

Responde ÚNICAMENTE con el JSON solicitado.`;
}

/**
 * Objeción de la sala para el primer punto no cumplido.
 * Best-effort: sin página usable devuelve null. La transcripción no sale.
 */
export async function objecionDeSala(datos: {
  puntoId: string;
  tipoPitch: TipoPitch;
  tipoNombre: string;
  idioma: Idioma;
  entidades: readonly string[];
}): Promise<ObjecionSala | null> {
  const punto = obtenerPuntoPorId(datos.tipoPitch, datos.puntoId);
  if (!punto) return null;
  const sala = salaDeTipo(datos.tipoPitch);
  const puntoNombre = etiquetaPunto(datos.puntoId, datos.idioma, datos.tipoPitch);
  const query = construirQuerySala({
    idioma: datos.idioma,
    sala,
    puntoNombre,
    entidades: datos.entidades,
    tipoNombre: datos.tipoNombre,
  });

  let fuentes;
  try {
    fuentes = await buscarFuentes(query, { idioma: datos.idioma, tipoPitch: datos.tipoPitch });
  } catch (err) {
    console.warn("[sala] búsqueda falló:", err);
    return null;
  }

  for (const fuente of fuentes) {
    const extraido = await extraerContenido(fuente.url, { personalizar: query });
    if (!extraido) continue;
    let cruda: ObjecionCruda;
    try {
      cruda = await llamarModelo<ObjecionCruda>(
        {
          system: systemObjecion(datos.idioma),
          user: `Punto: ${puntoNombre}\nQué buscar: ${punto.queBuscar[datos.idioma]}\n\n${extraido.contenido}`,
          idioma: datos.idioma,
          esquema: esquemaObjecion(datos.idioma),
          nombreEsquema: "objecion_sala",
          validar: (valor) => validarObjecionCruda(valor, extraido.contenido),
        },
        "rapido",
      );
    } catch (err) {
      console.warn("[sala] validación falló:", err);
      continue;
    }
    if (!cruda.util) continue;
    // Una guía pública de la sala (postulación, comité, comprador) casi nunca
    // nombra el producto. La query ya llevó las entidades; exigirlas en la
    // cita tiraría la objeción. El filtro de sector sigue en las cifras.
    return {
      punto: datos.puntoId,
      sala,
      objecion: cruda.objecion,
      cita: cruda.cita,
      titulo: fuente.title,
      url: fuente.url,
    };
  }
  return null;
}
