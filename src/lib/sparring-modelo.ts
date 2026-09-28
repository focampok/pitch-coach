import type { Idioma } from "@/types/idioma";
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
  idioma: Idioma,
): Promise<PreguntaSparring> {
  return llamarModelo<PreguntaSparring>(
    {
      system: prompt.system,
      user: prompt.user,
      idioma,
      esquema: construirEsquemaPreguntaSparringRestringido(idioma) as EsquemaJson,
      nombreEsquema: "pregunta_sparring",
      validar: validarPreguntaSparring,
    },
    NIVEL_SPARRING,
  );
}

/** Evalúa la respuesta de sparring con el nivel rápido (Nano). */
export async function evaluarRespuestaSparring(
  prompt: PromptAnalisis,
  idioma: Idioma,
): Promise<EvaluacionSparring> {
  return llamarModelo<EvaluacionSparring>(
    {
      system: prompt.system,
      user: prompt.user,
      idioma,
      esquema: construirEsquemaSparringRestringido(idioma) as EsquemaJson,
      nombreEsquema: "evaluacion_sparring",
      validar: validarEvaluacionSparring,
    },
    NIVEL_SPARRING,
  );
}
