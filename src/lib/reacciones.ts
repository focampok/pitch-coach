import type { ReaccionCoach } from "@/types/coach";
import type { ConteoMuletillas } from "@/types/pitch";
import { detectarMuletillas } from "./muletillas";

// Motor de reacciones del coach visual (docs/alcance.md §5.1).
// Detecta DETECCIONES NUEVAS sobre el texto transcrito en vivo (interim results)
// para no re-disparar el mismo gesto por cada actualización del STT. No usa LLM:
// es regex/keyword matching local, sin latencia y sin depender de la red.

/**
 * Frases de impacto: keyword matching local sobre el texto. Busca declaraciones
 * potentes y cifras/datos concretos típicos de un buen pitch. Lista ajustable
 * durante pruebas con la propia voz del usuario.
 */
const PATRONES_IMPACTO: readonly RegExp[] = [
  /(quiero|vamos a|estamos\s+(en|construyendo|haciendo|logrando)|hemos\s+(logrado|creado|conseguido))/i,
  /(\d+\.?\d*|\bmil\b|\bmillones\b)\s*(k|m|mil|millones|%|usuarios|clientes|dólares|dolares|soles|pesos)/i,
  /\b(mercado|oportunidad|tam)\b/i,
];

/** Cooldown de la reacción "sorprendido" para evitar spam del mismo gesto. */
const COOLDOWN_SORPRESA_MS = 8000;

/** Mensajes del coach (el humor va en el copy, no en el dibujo — §5.1). */
export const MENSAJES_COACH: Record<ReaccionCoach, readonly string[]> = {
  estremecido: [
    "¡Uy, esa muletilla!",
    "Ese 'o sea' sonó fuerte…",
    "Cuidado con los 'este'.",
    "Se te escapó un 'digamos'.",
  ],
  sorprendido: [
    "¡Esa frase impacta!",
    "¡Buen dato!",
    "Eso suena a cifra importante.",
  ],
  mirandoReloj: [
    "¿Seguimos?",
    "Silencio… te escucho.",
    "No te me quedes en blanco.",
  ],
  asintiendo: [
    "Escuché tu pitch completo.",
    "¡Bien, terminaste!",
    "Ahora te doy mi veredicto.",
  ],
};

export interface MotorReacciones {
  /**
   * Devuelve una reacción si el texto nuevo la dispara; si no, null.
   * Debe llamarse con el texto completo acumulado (final + interim).
   */
  evaluar(textoActual: string): ReaccionCoach | null;
  /** Reinicia los contadores internos (nueva grabación). */
  reset(): void;
}

/**
 * Crea el motor de reacciones. Compara el conteo de muletillas del texto actual
 * con el último visto: solo reacciona cuando hay Ocurrencias NUEVAS. La reacción
 * "sorprendido" (frase de impacto) respeta un cooldown para no repetirse.
 */
export function crearMotorReacciones(): MotorReacciones {
  let ultimoTotalMuletillas = 0;
  let ultimaSorpresa = 0;

  return {
    evaluar(textoActual) {
      const conteo: ConteoMuletillas = detectarMuletillas(textoActual);
      const totalMuletillas = Object.values(conteo).reduce((a, b) => a + b, 0);

      // Las muletillas son la reacción de mayor prioridad.
      if (totalMuletillas > ultimoTotalMuletillas) {
        ultimoTotalMuletillas = totalMuletillas;
        return "estremecido";
      }
      ultimoTotalMuletillas = totalMuletillas;

      const ahora = Date.now();
      if (
        PATRONES_IMPACTO.some((patron) => patron.test(textoActual)) &&
        ahora - ultimaSorpresa >= COOLDOWN_SORPRESA_MS
      ) {
        ultimaSorpresa = ahora;
        return "sorprendido";
      }

      return null;
    },
    reset() {
      ultimoTotalMuletillas = 0;
      ultimaSorpresa = 0;
    },
  };
}
