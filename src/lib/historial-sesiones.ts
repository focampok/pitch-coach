import type { Idioma } from "@/types/idioma";
import type {
  HallazgosHistorial,
  PuntoHistorial,
  SesionGuardada,
} from "@/types/historial";
import type { ConteoMuletillas, DuracionMaxima, ResultadoAnalisis, TipoPitch } from "@/types/pitch";
import { IDIOMA_POR_DEFECTO, esIdioma } from "./idiomas";
import { idDePunto } from "./rubricas";
import { COBERTURA_MAXIMA } from "./validar-analisis";

// Historial local de sesiones (localStorage del navegador).
//
// Privacidad: solo se persisten los campos de `SesionGuardada`. Aunque el
// llamador adjunte transcripción, comentarios, traza, preguntas, respuestas
// o audio, `normalizarSesion` los descarta antes de escribir.
//
// COMPATIBILIDAD
// Las sesiones guardadas antes del modo bilingüe no tienen `idioma` y guardan
// el NOMBRE del punto en español en lugar de su id. Al leerlas se normalizan
// (idioma → "es", nombre → id) sin romper: si un nombre ya no corresponde a
// ningún punto de la rúbrica, se conserva tal cual y se muestra así.

/** Clave con prefijo del proyecto para no chocar con otras apps del dominio. */
export const CLAVE_HISTORIAL_SESIONES = "pitch-coach:historial-sesiones";

/** Tope de sesiones guardadas. Al superarlo se descartan las más antiguas. */
export const MAX_SESIONES_GUARDADAS = 20;

const SESIONES_VACIAS: SesionGuardada[] = [];

const oyentes = new Set<() => void>();
let cacheCrudo: string | null | undefined;
let cacheLista: SesionGuardada[] = SESIONES_VACIAS;

function notificar(): void {
  cacheCrudo = undefined;
  for (const oyente of oyentes) oyente();
}

/** El panel se suscribe para refrescarse tras un guardado en esta pestaña. */
export function suscribirHistorial(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Instantánea estable para `useSyncExternalStore`. La misma referencia mientras
 * el texto guardado no cambie; si no hay sesiones, la lista vacía compartida.
 */
export function leerInstantaneaHistorial(): SesionGuardada[] {
  const storage = almacenamiento();
  if (!storage) return SESIONES_VACIAS;
  let crudo: string | null = null;
  try {
    crudo = storage.getItem(CLAVE_HISTORIAL_SESIONES);
  } catch {
    return SESIONES_VACIAS;
  }
  if (crudo === cacheCrudo) return cacheLista;
  const leidas = obtenerSesiones();
  cacheLista = leidas.length === 0 ? SESIONES_VACIAS : leidas;
  try {
    cacheCrudo = almacenamiento()?.getItem(CLAVE_HISTORIAL_SESIONES) ?? null;
  } catch {
    cacheCrudo = null;
  }
  return cacheLista;
}

/** Snapshot de servidor: siempre vacío, misma referencia, para hidratar. */
export function instantaneaServidorHistorial(): SesionGuardada[] {
  return SESIONES_VACIAS;
}

const TIPOS_PITCH = new Set<TipoPitch>(["capital", "educacion", "innovacion", "tecnologia"]);
const DURACIONES = new Set<DuracionMaxima>([1, 2, 3, 4, 5, 6, 7]);

export type { HallazgosHistorial, PuntoHistorial, SesionGuardada };

function almacenamiento(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function descartar(storage: Storage): void {
  try {
    storage.removeItem(CLAVE_HISTORIAL_SESIONES);
  } catch {
    // Modo privado o storage bloqueado: no hay nada que recuperar.
  }
}

function esTipoPitch(valor: unknown): valor is TipoPitch {
  return typeof valor === "string" && TIPOS_PITCH.has(valor as TipoPitch);
}

function esDuracion(valor: unknown): valor is DuracionMaxima {
  return typeof valor === "number" && DURACIONES.has(valor as DuracionMaxima);
}

/**
 * Idioma de una sesión guardada.
 *
 * Una entrada sin `idioma` es anterior al modo bilingüe: se asume español, el
 * único idioma que existía entonces. Un valor inválido (dato manipulado) cae al
 * mismo default en vez de descartar la sesión: perder una práctica entera por un
 * campo que sabemos completar sería peor que el dato faltante.
 */
function normalizarIdioma(valor: unknown): Idioma {
  return esIdioma(valor) ? valor : IDIOMA_POR_DEFECTO;
}

/**
 * Normaliza un punto al id de la rúbrica de ese tipo.
 * Acepta el id actual o el nombre en español de una entrada vieja.
 */
function normalizarPunto(valor: unknown, tipoPitch: TipoPitch): PuntoHistorial | null {
  if (valor === null || typeof valor !== "object") return null;
  const item = valor as Record<string, unknown>;
  if (typeof item.punto !== "string" || item.punto.trim() === "") return null;
  if (typeof item.cumplido !== "boolean") return null;
  return { punto: idDePunto(tipoPitch, item.punto), cumplido: item.cumplido };
}

function normalizarPuntos(valor: unknown, tipoPitch: TipoPitch): PuntoHistorial[] | null {
  if (!Array.isArray(valor)) return null;
  const puntos: PuntoHistorial[] = [];
  for (const item of valor) {
    const punto = normalizarPunto(item, tipoPitch);
    if (!punto) return null;
    puntos.push(punto);
  }
  return puntos;
}

function normalizarMuletillas(valor: unknown): ConteoMuletillas | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return null;
  const salida: ConteoMuletillas = {};
  for (const [clave, conteo] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof conteo !== "number" || !Number.isFinite(conteo)) continue;
    salida[clave] = conteo;
  }
  return salida;
}

function normalizarHallazgos(
  valor: unknown,
  tipoPitch: TipoPitch,
): HallazgosHistorial | null {
  if (valor === null || typeof valor !== "object") return null;
  const datos = valor as Record<string, unknown>;
  if (typeof datos.preguntasHechas !== "number" || !Number.isFinite(datos.preguntasHechas)) {
    return null;
  }
  if (typeof datos.puntosReforzados !== "number" || !Number.isFinite(datos.puntosReforzados)) {
    return null;
  }
  const puntos = normalizarPuntos(datos.puntos, tipoPitch);
  if (!puntos) return null;
  return {
    preguntasHechas: datos.preguntasHechas,
    puntosReforzados: datos.puntosReforzados,
    puntos,
  };
}

/** Deja solo los campos permitidos. Devuelve null si la entrada no es usable. */
export function normalizarSesion(valor: unknown): SesionGuardada | null {
  if (valor === null || typeof valor !== "object") return null;
  const datos = valor as Record<string, unknown>;
  if (typeof datos.fecha !== "string" || datos.fecha.trim() === "") return null;
  if (!esTipoPitch(datos.tipoPitch)) return null;
  if (!esDuracion(datos.duracionMaxima)) return null;
  if (typeof datos.score !== "number" || !Number.isFinite(datos.score)) return null;
  if (typeof datos.claridad !== "number" || !Number.isFinite(datos.claridad)) return null;
  // El tipo se resuelve antes: los puntos se normalizan contra SU rúbrica.
  const rubrica = normalizarPuntos(datos.rubrica, datos.tipoPitch);
  if (!rubrica) return null;
  const muletillas = normalizarMuletillas(datos.muletillas);
  if (!muletillas) return null;
  if (typeof datos.ultraUsado !== "boolean") return null;

  const sesion: SesionGuardada = {
    fecha: datos.fecha,
    tipoPitch: datos.tipoPitch,
    idioma: normalizarIdioma(datos.idioma),
    duracionMaxima: datos.duracionMaxima,
    score: datos.score,
    claridad: datos.claridad,
    rubrica,
    muletillas,
    ultraUsado: datos.ultraUsado,
  };

  if (datos.hallazgos !== undefined) {
    const hallazgos = normalizarHallazgos(datos.hallazgos, datos.tipoPitch);
    if (hallazgos) sesion.hallazgos = hallazgos;
  }

  return sesion;
}

function leerCrudo(storage: Storage): SesionGuardada[] {
  let crudo: string | null;
  try {
    crudo = storage.getItem(CLAVE_HISTORIAL_SESIONES);
  } catch {
    return [];
  }
  if (!crudo) return [];

  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    descartar(storage);
    return [];
  }
  if (!Array.isArray(datos)) {
    descartar(storage);
    return [];
  }

  const sesiones = datos
    .map((item) => normalizarSesion(item))
    .filter((item): item is SesionGuardada => item !== null)
    .slice(0, MAX_SESIONES_GUARDADAS);

  const serializado = JSON.stringify(sesiones);
  if (serializado !== crudo) {
    try {
      storage.setItem(CLAVE_HISTORIAL_SESIONES, serializado);
    } catch {
      // Si no se puede reescribir, igual devolvemos la lista ya saneada.
    }
  }
  return sesiones;
}

function escribir(storage: Storage, sesiones: SesionGuardada[]): boolean {
  try {
    storage.setItem(CLAVE_HISTORIAL_SESIONES, JSON.stringify(sesiones));
    return true;
  } catch {
    // Cuota excedida o modo privado: se pierde este guardado, no se lanza.
    return false;
  }
}

/** Agrega una sesión al frente (la más reciente primero) y recorta a 20. */
export function agregarSesion(entrada: SesionGuardada): void {
  const limpia = normalizarSesion(entrada);
  if (!limpia) return;
  const storage = almacenamiento();
  if (!storage) return;
  const actuales = leerCrudo(storage);
  if (escribir(storage, [limpia, ...actuales].slice(0, MAX_SESIONES_GUARDADAS))) {
    notificar();
  }
}

/**
 * Ids de los puntos que quedaron sin cubrir en la sesión más reciente de este
 * tipo Y este idioma. Solo ids de rúbrica: nada de comentarios ni transcripción.
 *
 * El idioma entra en el filtro porque los puntos no cubiertos se le recuerdan
 * al modelo en el prompt: mezclar idiomas haría que una práctica en inglés
 * condicionara una en español.
 */
export function puntosNoCumplidosPrevios(tipo: TipoPitch, idioma: Idioma): string[] {
  const previa = obtenerSesiones().find(
    (sesion) => sesion.tipoPitch === tipo && sesion.idioma === idioma,
  );
  if (!previa) return [];
  return previa.rubrica.filter((punto) => !punto.cumplido).map((punto) => punto.punto);
}

/** Sesiones guardadas, de la más reciente a la más antigua. */
export function obtenerSesiones(): SesionGuardada[] {
  const storage = almacenamiento();
  if (!storage) return [];
  try {
    return leerCrudo(storage);
  } catch {
    return [];
  }
}

/** Borra el historial de este navegador. */
export function borrarHistorial(): void {
  const storage = almacenamiento();
  if (!storage) return;
  descartar(storage);
  notificar();
}

/**
 * Arma la entrada del análisis principal.
 *
 * `claridad` no viene suelta en la respuesta del API. Se reconstruye como
 * `score − cobertura`, la inversa de `calcularScore`
 * (cobertura = round(cumplidos / total × COBERTURA_MAXIMA)).
 *
 * Copia solo el id y cumplido de la rúbrica, y el conteo de muletillas.
 * No copia veredicto, comentarios ni traza.
 */
export function construirSesionGuardada(datos: {
  fecha: string;
  tipoPitch: TipoPitch;
  idioma: Idioma;
  duracionMaxima: DuracionMaxima;
  resultado: ResultadoAnalisis;
}): SesionGuardada | null {
  const total = datos.resultado.rubrica.length;
  const cumplidos = datos.resultado.rubrica.filter((item) => item.cumplido).length;
  const cobertura = total > 0 ? Math.round((cumplidos / total) * COBERTURA_MAXIMA) : 0;
  return normalizarSesion({
    fecha: datos.fecha,
    tipoPitch: datos.tipoPitch,
    idioma: datos.idioma,
    duracionMaxima: datos.duracionMaxima,
    score: datos.resultado.score,
    claridad: datos.resultado.score - cobertura,
    rubrica: datos.resultado.rubrica.map(({ punto, cumplido }) => ({ punto, cumplido })),
    muletillas: datos.resultado.muletillas,
    ultraUsado: false,
  });
}

/**
 * Actualiza la sesión identificada por `fecha`: la que se guardó al terminar
 * el análisis principal de ESE intento. No usa "la más reciente" del historial,
 * porque un pitch nuevo crea otra fecha.
 *
 * Solo acepta `ultraUsado` y `hallazgos`. Cualquier otro campo que llegue
 * dentro de `hallazgos` (pregunta, respuesta, comentario) se descarta al
 * normalizar.
 */
export function actualizarSesion(
  fecha: string,
  cambios: { ultraUsado?: boolean; hallazgos?: HallazgosHistorial },
): void {
  const storage = almacenamiento();
  if (!storage) return;
  const actuales = leerCrudo(storage);
  const indice = actuales.findIndex((sesion) => sesion.fecha === fecha);
  if (indice === -1) return;
  const actual = actuales[indice];
  if (!actual) return;
  const fusionada = normalizarSesion({
    ...actual,
    ...(cambios.ultraUsado !== undefined ? { ultraUsado: cambios.ultraUsado } : {}),
    ...(cambios.hallazgos !== undefined ? { hallazgos: cambios.hallazgos } : {}),
  });
  if (!fusionada) return;
  const siguientes = actuales.slice();
  siguientes[indice] = fusionada;
  if (escribir(storage, siguientes)) notificar();
}
