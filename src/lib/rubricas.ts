import type { TipoPitch } from "@/types/pitch";

// Rúbricas hardcodeadas por tipo de pitch (docs/alcance.md §6).
// El MVP no tiene edición ni entrenamiento de rúbricas custom: esta lista es
// la fuente de verdad que se envía a Gemini como contexto de evaluación.
// Los nombres de los puntos van en español porque son contenido visible del
// producto (mercado objetivo LATAM, ver CLAUDE.md).

export interface PuntoRubrica {
  /** Nombre visible del punto (se muestra en el dashboard). */
  punto: string;
  /** Qué buscar en la transcripción para considerar el punto cumplido. */
  queBuscar: string;
}

export const RUBRICAS: Record<TipoPitch, readonly PuntoRubrica[]> = {
  capital: [
    {
      punto: "Problema claro",
      queBuscar: "Descripción concreta del problema o dolor que el producto resuelve",
    },
    {
      punto: "Tamaño del mercado / oportunidad",
      queBuscar: "Menciona el mercado al que apunta, su tamaño u oportunidad (idealmente con cifra)",
    },
    {
      punto: "Solución / diferenciador",
      queBuscar: "Explica la solución propuesta y qué la diferencia de la competencia",
    },
    {
      punto: "Tracción o evidencia",
      queBuscar: "Datos, usuarios, ingresos o cualquier evidencia temprana de validación",
    },
    {
      punto: "El ask",
      queBuscar: "Cuánto capital se busca y para qué se va a usar",
    },
  ],
  educacion: [
    {
      punto: "Objetivo de aprendizaje claro",
      queBuscar: "Define qué va a aprender o lograr el participante",
    },
    {
      punto: "Estructura pedagógica",
      queBuscar: "Muestra un orden de inicio, desarrollo y cierre (no es un listado suelto)",
    },
    {
      punto: "Ejemplo o caso concreto",
      queBuscar: "Ilustra el concepto con un ejemplo o caso real o hipotético",
    },
    {
      punto: "Conexión con conocimiento previo",
      queBuscar: "Vincula el contenido con lo que la audiencia ya sabe",
    },
    {
      punto: "Llamado a la acción",
      queBuscar: "Indica el siguiente paso concreto para el aprendiz",
    },
  ],
  innovacion: [
    {
      punto: "Problema u oportunidad identificada",
      queBuscar: "Señala el problema o la oportunidad que motiva la propuesta",
    },
    {
      punto: "Qué hace diferente/innovador",
      queBuscar: "Explica qué es novedoso o distinto frente a lo existente",
    },
    {
      punto: "Evidencia de validación",
      queBuscar: "Muestra validación, aunque sea temprana (prueba, piloto, entrevistas)",
    },
    {
      punto: "Impacto esperado",
      queBuscar: "Describe el impacto o beneficio esperado (social, económico, etc.)",
    },
    {
      punto: "Próximos pasos o visión",
      queBuscar: "Define los siguientes pasos o la visión a futuro",
    },
  ],
  tecnologia: [
    {
      punto: "Problema técnico que resuelve",
      queBuscar: "Describe el problema técnico concreto que la solución aborda",
    },
    {
      punto: "Cómo funciona",
      queBuscar: "Explica el funcionamiento sin perderse en jerga excesiva",
    },
    {
      punto: "Diferenciador técnico real",
      queBuscar: "Menciona qué lo hace difícil de replicar a nivel técnico",
    },
    {
      punto: "Estado actual",
      queBuscar: "Indica si es funcional, en desarrollo, y su escalabilidad",
    },
    {
      punto: "Uso de recursos o stack",
      queBuscar: "Menciona el stack o recursos relevantes con claridad",
    },
  ],
};

/** Devuelve la rúbrica correspondiente a un tipo de pitch. */
export function obtenerRubrica(tipoPitch: TipoPitch): readonly PuntoRubrica[] {
  return RUBRICAS[tipoPitch];
}
