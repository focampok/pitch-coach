import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";

// Rúbricas hardcodeadas por tipo de pitch (docs/alcance.md §6).
// El MVP no tiene edición ni entrenamiento de rúbricas custom: esta lista es
// la fuente de verdad que se envía al modelo como contexto de evaluación.
//
// Cada punto tiene un `id` ESTABLE, que es lo único que viaja por la API y lo
// único que se persiste en el historial. Los nombres y las descripciones son
// presentación: se resuelven desde el id según el idioma, así que traducir un
// punto no invalida los datos ya guardados.
//
// Los ids son únicos DENTRO de cada tipo, no entre tipos: la continuidad y el
// sparring siempre trabajan con un tipo de pitch conocido.

/** Un punto de la rúbrica, en todos los idiomas soportados. */
export interface PuntoRubrica {
  /** Identificador estable. Ej.: "problema", "mercado". */
  id: string;
  /** Nombre visible, por idioma. */
  nombre: Record<Idioma, string>;
  /** Qué buscar en la transcripción para dar el punto por cumplido, por idioma. */
  queBuscar: Record<Idioma, string>;
}

export const RUBRICAS: Record<TipoPitch, readonly PuntoRubrica[]> = {
  capital: [
    {
      id: "problema",
      nombre: { es: "Problema claro", en: "Clear problem" },
      queBuscar: {
        es: "Descripción concreta del problema o dolor que el producto resuelve",
        en: "A concrete description of the problem or pain the product solves",
      },
    },
    {
      id: "mercado",
      nombre: { es: "Tamaño del mercado / oportunidad", en: "Market size / opportunity" },
      queBuscar: {
        es: "Menciona el mercado al que apunta, su tamaño u oportunidad (idealmente con cifra)",
        en: "Names the market it targets, its size or opportunity (ideally with a figure)",
      },
    },
    {
      id: "solucion",
      nombre: { es: "Solución / diferenciador", en: "Solution / differentiator" },
      queBuscar: {
        es: "Explica la solución propuesta y qué la diferencia de la competencia",
        en: "Explains the proposed solution and what sets it apart from the competition",
      },
    },
    {
      id: "traccion",
      nombre: { es: "Tracción o evidencia", en: "Traction or evidence" },
      queBuscar: {
        es: "Datos, usuarios, ingresos o cualquier evidencia temprana de validación",
        en: "Data, users, revenue or any early evidence of validation",
      },
    },
    {
      id: "ask",
      nombre: { es: "El ask", en: "The ask" },
      queBuscar: {
        es: "Cuánto capital se busca y para qué se va a usar",
        en: "How much capital is being raised and what it will be used for",
      },
    },
  ],
  educacion: [
    {
      id: "objetivo",
      nombre: { es: "Objetivo de aprendizaje claro", en: "Clear learning goal" },
      queBuscar: {
        es: "Define qué va a aprender o lograr el participante",
        en: "States what the participant will learn or achieve",
      },
    },
    {
      id: "estructura",
      nombre: { es: "Estructura pedagógica", en: "Pedagogical structure" },
      queBuscar: {
        es: "Muestra un orden de inicio, desarrollo y cierre (no es un listado suelto)",
        en: "Shows an opening, body and closing order (not a loose list)",
      },
    },
    {
      id: "ejemplo",
      nombre: { es: "Ejemplo o caso concreto", en: "Concrete example or case" },
      queBuscar: {
        es: "Ilustra el concepto con un ejemplo o caso real o hipotético",
        en: "Illustrates the concept with a real or hypothetical example or case",
      },
    },
    {
      id: "conocimiento-previo",
      nombre: {
        es: "Conexión con conocimiento previo",
        en: "Connection to prior knowledge",
      },
      queBuscar: {
        es: "Vincula el contenido con lo que la audiencia ya sabe",
        en: "Links the content to what the audience already knows",
      },
    },
    {
      id: "llamado-accion",
      nombre: { es: "Llamado a la acción", en: "Call to action" },
      queBuscar: {
        es: "Indica el siguiente paso concreto para el aprendiz",
        en: "States the concrete next step for the learner",
      },
    },
  ],
  innovacion: [
    {
      id: "problema-oportunidad",
      nombre: {
        es: "Problema u oportunidad identificada",
        en: "Identified problem or opportunity",
      },
      queBuscar: {
        es: "Señala el problema o la oportunidad que motiva la propuesta",
        en: "Points to the problem or opportunity behind the proposal",
      },
    },
    {
      id: "diferenciador",
      nombre: { es: "Qué hace diferente/innovador", en: "What makes it different" },
      queBuscar: {
        es: "Explica qué es novedoso o distinto frente a lo existente",
        en: "Explains what is novel or different from what already exists",
      },
    },
    {
      id: "validacion",
      nombre: { es: "Evidencia de validación", en: "Evidence of validation" },
      queBuscar: {
        es: "Muestra validación, aunque sea temprana (prueba, piloto, entrevistas)",
        en: "Shows validation, even if early (a test, a pilot, interviews)",
      },
    },
    {
      id: "impacto",
      nombre: { es: "Impacto esperado", en: "Expected impact" },
      queBuscar: {
        es: "Describe el impacto o beneficio esperado (social, económico, etc.)",
        en: "Describes the expected impact or benefit (social, economic, and so on)",
      },
    },
    {
      id: "proximos-pasos",
      nombre: { es: "Próximos pasos o visión", en: "Next steps or vision" },
      queBuscar: {
        es: "Define los siguientes pasos o la visión a futuro",
        en: "Defines the next steps or the future vision",
      },
    },
  ],
  tecnologia: [
    {
      id: "problema-tecnico",
      nombre: { es: "Problema técnico que resuelve", en: "Technical problem it solves" },
      queBuscar: {
        es: "Describe el problema técnico concreto que la solución aborda",
        en: "Describes the concrete technical problem the solution addresses",
      },
    },
    {
      id: "funcionamiento",
      nombre: { es: "Cómo funciona", en: "How it works" },
      queBuscar: {
        es: "Explica el funcionamiento sin perderse en jerga excesiva",
        en: "Explains how it works without drowning in jargon",
      },
    },
    {
      id: "diferenciador-tecnico",
      nombre: { es: "Diferenciador técnico real", en: "Real technical differentiator" },
      queBuscar: {
        es: "Menciona qué lo hace difícil de replicar a nivel técnico",
        en: "States what makes it hard to replicate technically",
      },
    },
    {
      id: "estado",
      nombre: { es: "Estado actual", en: "Current status" },
      queBuscar: {
        es: "Indica si es funcional, en desarrollo, y su escalabilidad",
        en: "Says whether it works today or is in development, and how it scales",
      },
    },
    {
      id: "stack",
      nombre: { es: "Uso de recursos o stack", en: "Resources or stack used" },
      queBuscar: {
        es: "Menciona el stack o recursos relevantes con claridad",
        en: "Clearly mentions the relevant stack or resources",
      },
    },
  ],
};

const TIPOS_PITCH: readonly TipoPitch[] = [
  "capital",
  "educacion",
  "innovacion",
  "tecnologia",
];

/** Devuelve la rúbrica correspondiente a un tipo de pitch. */
export function obtenerRubrica(tipoPitch: TipoPitch): readonly PuntoRubrica[] {
  return RUBRICAS[tipoPitch];
}

/** Busca un punto de la rúbrica por su id. */
export function obtenerPuntoPorId(
  tipoPitch: TipoPitch,
  id: string,
): PuntoRubrica | undefined {
  return RUBRICAS[tipoPitch].find((punto) => punto.id === id);
}

/**
 * Normaliza el valor de un punto al id estable.
 *
 * Acepta un id (lo devuelve tal cual) o el nombre en español de una entrada
 * vieja del historial (lo traduce a su id). Si no coincide con nada —una
 * rúbrica que cambió, un valor corrupto— devuelve el valor original, para que
 * la entrada vieja se pueda seguir mostrando sin romper.
 */
export function idDePunto(tipoPitch: TipoPitch, valor: string): string {
  const porId = obtenerPuntoPorId(tipoPitch, valor);
  if (porId) return porId.id;
  const porNombre = RUBRICAS[tipoPitch].find((punto) => punto.nombre.es === valor);
  return porNombre?.id ?? valor;
}

/**
 * Nombre visible de un punto de la rúbrica para un idioma.
 *
 * Si `valor` no es un id conocido de ese tipo (el nombre en español de una
 * entrada vieja que no se pudo mapear, o cualquier texto inesperado), se
 * devuelve tal cual: el historial viejo se muestra bien aunque no se entienda.
 */
export function etiquetaPunto(
  valor: string,
  idioma: Idioma,
  tipoPitch?: TipoPitch,
): string {
  if (tipoPitch) {
    const punto = obtenerPuntoPorId(tipoPitch, valor);
    if (punto) return punto.nombre[idioma];
  }
  return valor;
}

/** true si el valor es un id de punto de la rúbrica de ese tipo. */
export function esIdDePunto(valor: unknown, tipoPitch: TipoPitch): boolean {
  return typeof valor === "string" && obtenerPuntoPorId(tipoPitch, valor) !== undefined;
}

/** Los cuatro tipos de pitch, en el orden en que se declaran. */
export function tiposPitch(): readonly TipoPitch[] {
  return TIPOS_PITCH;
}
