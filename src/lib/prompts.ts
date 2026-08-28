import type { PuntoRubrica } from "./rubricas";
import type { TipoPitch } from "@/types/pitch";

// Construcción del prompt enviado a Gemini (docs/alcance.md §13).
// El prompt pide explícitamente respuesta en español y evalúa cada punto de la
// rúbrica contra la transcripción, incluyendo el tiempo real vs. máximo como
// contexto del feedback (docs/alcance.md §7).

export interface DatosPrompt {
  transcripcion: string;
  tipoPitch: TipoPitch;
  rubrica: readonly PuntoRubrica[];
  /** Duración máxima seleccionada, en segundos (docs/alcance.md §7). */
  tiempoMaximoSegundos: number;
  /** Tiempo real que duró el pitch, en segundos (docs/alcance.md §7). */
  tiempoRealSegundos: number;
}

// Nombres legibles de cada tipo de pitch para usar en el prompt (contenido en
// español, visible para el modelo y luego para el usuario).
const NOMBRE_TIPO_PITCH: Record<TipoPitch, string> = {
  capital: "capital",
  educacion: "educación",
  innovacion: "innovación",
  tecnologia: "tecnología",
};

export function construirPrompt({
  transcripcion,
  tipoPitch,
  rubrica,
  tiempoMaximoSegundos,
  tiempoRealSegundos,
}: DatosPrompt): string {
  const puntos = rubrica
    .map(({ punto, queBuscar }, i) => `${i + 1}. ${punto} — qué buscar: ${queBuscar}`)
    .join("\n");

  const tiempo = `${tiempoRealSegundos} segundos de ${tiempoMaximoSegundos} segundos disponibles`;

  return `Eres Pitch Coach, un entrenador de pitches que evalúa de forma objetiva y da feedback accionable en español.

Tipo de pitch del usuario: ${NOMBRE_TIPO_PITCH[tipoPitch]}.
Tiempo: el usuario usó ${tiempo}.

Rúbrica contra la que debes evaluar (punto por punto):
${puntos}

Instrucciones:
- Evalúa CADA punto de la rúbrica contra la transcripción real del usuario.
- Para cada punto indica cumplido (true) o no cumplido (false) con un comentario breve en español (máx. 1 frase) que explique por qué y, si es un punto faltante, cómo podría cubrirlo.
- Ten en cuenta el tiempo en tu feedback: si el usuario se quedó corto de tiempo antes de cubrir un punto clave, menciónalo (ej. "se te acabó el tiempo antes de mencionar el ask de capital"); si terminó muy por debajo del límite, sugiere desarrollar más con profundidad; si administró bien el tiempo y cubrió todo, reconócelo.
- Calcula un score numérico de 0 a 100 según la cobertura de la rúbrica y la claridad.
- Escribe un veredicto_corto de 1 a 2 frases en español, pensado para ser leído en voz alta después (tono de coach: directo, con chispa, pero sobrio).

Transcripción del usuario:
"""
${transcripcion}
"""

Responde ÚNICAMENTE con el JSON estructurado solicitado, en español, sin texto adicional.`;
}
