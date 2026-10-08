import type { Idioma } from "./idioma";
import type { ConteoMuletillas, DuracionMaxima, TipoPitch } from "./pitch";

// Forma de una sesión persistida en el navegador.
//
// Solo estos campos. No se agregan, ni aunque el análisis los traiga:
// - transcripción del pitch
// - respuesta (voz o texto) de "Resolver hallazgos"
// - comentario de rúbrica (análisis, Ultra o turno de hallazgos)
// - traza del Análisis Ultra
// - pregunta de un turno de hallazgos
// - veredicto_corto
// - audio
// - texto de la segunda toma
//
// Ultra no guarda score ni rúbrica propios: `ultraUsado` solo registra que
// se corrió. El resultado de Ultra sigue en memoria de la pestaña.

/**
 * Punto de rúbrica persistido: id y si se cumplió. Sin comentario.
 *
 * Se guarda el ID, nunca el nombre traducido: así cambiar de idioma (o traducir
 * un punto) no invalida las sesiones ya guardadas. En una entrada vieja que no
 * se pudo mapear a ningún id queda el nombre original en español, tal cual.
 */
export interface PuntoHistorial {
  punto: string;
  cumplido: boolean;
}

/**
 * Resumen de "Resolver hallazgos" en esa sesión.
 * Sin pregunta, sin respuesta y sin comentario.
 */
export interface HallazgosHistorial {
  preguntasHechas: number;
  puntosReforzados: number;
  puntos: PuntoHistorial[];
}

/**
 * Una práctica guardada en localStorage. Presente `hallazgos` solo si
 * se completó "Resolver hallazgos".
 */
export interface SesionGuardada {
  /** Marca de tiempo ISO. Identifica esta sesión para actualizaciones. */
  fecha: string;
  tipoPitch: TipoPitch;
  /**
   * Idioma en el que se hizo la práctica. La continuidad solo mira sesiones
   * del mismo tipo Y del mismo idioma: los puntos no cubiertos de una práctica
   * en inglés no se le recuerdan a alguien que ahora practica en español.
   */
  idioma: Idioma;
  /** Preset de 1 a 7 minutos. */
  duracionMaxima: DuracionMaxima;
  score: number;
  /** Claridad 0–20. El análisis no la devuelve suelta; se reconstruye del score. */
  claridad: number;
  rubrica: PuntoHistorial[];
  /** Recuento por tipo, el mismo mapa que calcula el análisis principal. */
  muletillas: ConteoMuletillas;
  /** True si en esta sesión se completó Análisis Ultra. */
  ultraUsado: boolean;
  hallazgos?: HallazgosHistorial;
  /**
   * Ids de rúbrica que una segunda toma de 45 segundos dejó cubiertos.
   * Sin el texto de esa toma. Ausente en sesiones anteriores a esa función.
   */
  puntosCerrados?: string[];
}
