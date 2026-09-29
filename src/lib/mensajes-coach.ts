import type { Diccionario } from "./diccionario-es";
import type { Idioma } from "@/types/idioma";

// Mensajes que el coach muestra en pantalla.
//
// Ya no hay avatar ni motor de reacciones: el flujo actual es grabar →
// transcribir → analizar, así que no existen resultados intermedios sobre los
// que reaccionar. Lo único que sobrevive de esa etapa son las 3 frases de
// asintiendo y su selección aleatoria. El reemplazo visual (animación tipo
// esfera) está planeado para la fase de UX/UI y parte de cero.

/** Estados del grabador; determinan el texto del indicador del coach. */
export type EstadoGrabador = "inactivo" | "grabando" | "transcribiendo" | "finalizado";

/**
 * Las tres frases que el coach muestra al terminar la transcripción
 * (una al azar, en el idioma de la sesión). Lista ajustable durante pruebas.
 */
export const MENSAJES_ASINTIENDO: Record<Idioma, readonly string[]> = {
  es: [
    "Escuché tu pitch completo.",
    "¡Bien, terminaste!",
    "Ahora te doy mi veredicto.",
  ],
  en: [
    "I heard your whole pitch.",
    "Nice, you finished!",
    "Now I'll give you my verdict.",
  ],
};

/**
 * Elige una de las tres frases de asintiendo del idioma dado.
 * `aleatorio` se inyecta (default `Math.random`) para probar la selección de
 * forma determinista.
 */
export function elegirMensajeAsintiendo(
  idioma: Idioma,
  aleatorio: () => number = Math.random,
): string {
  const opciones = MENSAJES_ASINTIENDO[idioma];
  return opciones[Math.floor(aleatorio() * opciones.length)];
}

/**
 * Texto del indicador de estado del coach (sustituto temporal del avatar):
 * "Escuchando" mientras se graba, "Transcribiendo" mientras responde Scribe y,
 * al finalizar, la frase de asintiendo ya elegida. Devuelve `null` cuando no
 * hay nada que mostrar (estado inactivo).
 */
export function textoIndicadorCoach(
  estado: EstadoGrabador,
  mensajeAsintiendo: string | null,
  textos: Diccionario,
): string | null {
  switch (estado) {
    case "grabando":
      return textos.grabador.escuchando;
    case "transcribiendo":
      return textos.grabador.transcribiendo;
    case "finalizado":
      return mensajeAsintiendo;
    case "inactivo":
      return null;
  }
}
