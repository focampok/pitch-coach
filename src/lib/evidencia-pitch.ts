import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";
import { extraerEntidades } from "./entidades-tavily";
import { objecionDeSala, type ObjecionSala } from "./objecion-sala";
import { elegirPuntosAEnriquecer, enriquecerConTavily, type SugerenciaTavily } from "./tavily";
import { verificarCifrasDichas } from "./verificar-cifras";
import type { VeredictoCifra } from "./cifras-dichas";

export interface EvidenciaPitch {
  sugerencias: SugerenciaTavily[];
  sala: ObjecionSala | null;
  cifras: VeredictoCifra[];
}

/**
 * Evidencia de una práctica: cifras para los puntos que faltan, una objeción
 * de sala para el primero de esos puntos, y el contraste de una cifra dicha.
 *
 * Las entidades se extraen una vez y se comparten. La transcripción no se
 * reenvía a Tavily. Cada rama es best-effort.
 */
export async function evidenciaDePitch(
  puntosSinCumplir: { punto: string; comentario?: string }[],
  contexto: {
    transcripcion: string;
    tipoPitch: TipoPitch;
    tipoNombre: string;
    idioma: Idioma;
  },
): Promise<EvidenciaPitch> {
  const entidades = contexto.transcripcion.trim()
    ? await extraerEntidades({
        transcripcion: contexto.transcripcion,
        tipoNombre: contexto.tipoNombre,
        idioma: contexto.idioma,
      })
    : [];

  const primero = elegirPuntosAEnriquecer(puntosSinCumplir, contexto.tipoPitch)[0];

  const [sugerencias, sala, cifras] = await Promise.all([
    enriquecerConTavily(puntosSinCumplir, { ...contexto, entidades }),
    primero
      ? objecionDeSala({
          puntoId: primero.punto,
          tipoPitch: contexto.tipoPitch,
          tipoNombre: contexto.tipoNombre,
          idioma: contexto.idioma,
          entidades,
        })
      : Promise.resolve(null),
    verificarCifrasDichas({ ...contexto, entidades }),
  ]);

  return { sugerencias, sala, cifras };
}
