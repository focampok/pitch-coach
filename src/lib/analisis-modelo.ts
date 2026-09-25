import type { PuntoRubrica } from "./rubricas";
import { llamarModelo, type EsquemaJson } from "./modelo";
import type { PromptAnalisis } from "./prompts";
import {
  ESQUEMA_ANALISIS,
  validarAnalisis,
  type AnalisisModelo,
} from "./validar-analisis";

// Orquesta una llamada de análisis: toma el prompt ya construido y la rúbrica,
// pide al modelo la porción que le corresponde y valida/calcula el resultado.
// No contiene nada específico de Gemini (eso vive en proveedor-modelo.ts) ni
// lógica de reintentos (eso vive en modelo.ts).

/**
 * Ejecuta el análisis contra el modelo configurado.
 *
 * La validación se hace DENTRO del `llamarModelo` para que una respuesta con
 * forma incorrecta (p. ej. un número de ítems distinto al de la rúbrica) se
 * trate como error y aproveche el reintento existente.
 */
export async function analizarConModelo(
  prompt: PromptAnalisis,
  rubrica: readonly PuntoRubrica[],
): Promise<AnalisisModelo & { score: number }> {
  return llamarModelo<AnalisisModelo & { score: number }>({
    system: prompt.system,
    user: prompt.user,
    esquema: ESQUEMA_ANALISIS as EsquemaJson,
    validar: (datos: unknown) => validarAnalisis(datos, rubrica),
  });
}
