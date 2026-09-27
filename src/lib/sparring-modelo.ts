import { llamarModelo, type EsquemaJson } from "./modelo";
import type { PromptAnalisis } from "./prompts";
import {
  construirEsquemaPreguntaSparringRestringido,
  construirEsquemaSparringRestringido,
  validarEvaluacionSparring,
  validarPreguntaSparring,
  type EvaluacionSparring,
  type PreguntaSparring,
} from "./validar-sparring";

const NIVEL_SPARRING = "rapido" as const;

/** Genera una pregunta de seguimiento con el nivel rápido (Nano). */
export async function generarPreguntaSparring(
  prompt: PromptAnalisis,
): Promise<PreguntaSparring> {
  return llamarModelo<PreguntaSparring>(
    {
      system: prompt.system,
      user: prompt.user,
      esquema: construirEsquemaPreguntaSparringRestringido() as EsquemaJson,
      nombreEsquema: "pregunta_sparring",
      validar: validarPreguntaSparring,
    },
    NIVEL_SPARRING,
  );
}

/** Evalúa la respuesta de sparring con el nivel rápido (Nano). */
export async function evaluarRespuestaSparring(
  prompt: PromptAnalisis,
): Promise<EvaluacionSparring> {
  return llamarModelo<EvaluacionSparring>(
    {
      system: prompt.system,
      user: prompt.user,
      esquema: construirEsquemaSparringRestringido() as EsquemaJson,
      nombreEsquema: "evaluacion_sparring",
      validar: validarEvaluacionSparring,
    },
    NIVEL_SPARRING,
  );
}
