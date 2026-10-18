import type { Idioma } from "@/types/idioma";
import { IDIOMAS } from "@/types/idioma";

// Registro de idiomas (docs/alcance.md, modo bilingüe).
//
// Este módulo es la ÚNICA fuente de verdad de "qué idiomas existen y con qué
// metadatos". Agregar un idioma nuevo debe ser agregar datos acá (más su
// diccionario en src/lib/diccionarios/), nunca tocar lógica de componentes.
//
// La resolución del idioma (servidor: Accept-Language; cliente: localStorage →
// navegador → el del servidor) y el script que fija `<html lang>` antes del
// primer paint viven acá, para que el HTML servido y el estado de React no
// puedan divergir.

export interface RegistroIdioma {
  /** Código corto, el valor que viaja por la API y por el historial. */
  codigo: Idioma;
  /** Nombre del idioma EN SU PROPIO IDIOMA (etiqueta del selector). */
  nombre: string;
  /** Etiqueta BCP-47: `<html lang>`, `Intl` y `SpeechSynthesisUtterance.lang`. */
  etiqueta: string;
  /** Locale de Open Graph (`og:locale`, formato `ll_TT`; Facebook no acepta `es_419`). */
  etiquetaOpenGraph: string;
  // La voz de TTS no vive acá: son secretos de entorno, resueltos en
  // src/lib/elevenlabs.ts (par sin sufijo en español, par `_EN_` en inglés).
  // `codigoStt` es el hint `language_code` de Scribe (ISO 639-1). Los
  // patrones de muletillas viven en src/lib/muletillas.ts (`patronesMuletillas`).
  // Este arreglo de etiquetas no se consume.
  /** Voice IDs de ElevenLabs por género de voz. Vacío: los IDs son env, no datos. */
  voces: Partial<Record<"male" | "female", string>>;
  /** Código corto para el hint de idioma del STT (Scribe). */
  codigoStt: string;
  /** Etiquetas de muletillas propias de este idioma. */
  muletillas: readonly string[];
}

export const IDIOMAS_REGISTRO: Record<Idioma, RegistroIdioma> = {
  es: {
    codigo: "es",
    nombre: "Español",
    etiqueta: "es-419",
    etiquetaOpenGraph: "es_LA",
    voces: {},
    codigoStt: "es",
    muletillas: [],
  },
  en: {
    codigo: "en",
    nombre: "English",
    etiqueta: "en-US",
    etiquetaOpenGraph: "en_US",
    voces: {},
    codigoStt: "en",
    muletillas: [],
  },
};

/** Clave de localStorage donde se recuerda el idioma elegido. */
export const CLAVE_IDIOMA = "pitch-coach:idioma";

/**
 * Idioma que se usa cuando no hay ninguna señal: una petición sin
 * `Accept-Language` en el servidor, o un navegador sin idiomas en el cliente.
 */
export const IDIOMA_POR_DEFECTO: Idioma = "es";

/** true si el valor es uno de los idiomas soportados. */
export function esIdioma(valor: unknown): valor is Idioma {
  return valor === "es" || valor === "en";
}

/** Registro completo del idioma. */
export function registroIdioma(idioma: Idioma): RegistroIdioma {
  return IDIOMAS_REGISTRO[idioma];
}

/** Etiqueta BCP-47 del idioma (`es-419`, `en-US`). */
export function etiquetaIdioma(idioma: Idioma): string {
  return IDIOMAS_REGISTRO[idioma].etiqueta;
}

/** Locale de Open Graph del idioma (`es_LA`, `en_US`). */
export function etiquetaOpenGraph(idioma: Idioma): string {
  return IDIOMAS_REGISTRO[idioma].etiquetaOpenGraph;
}

// --- Idioma pedido por una petición -----------------------------------------

/**
 * Resuelve el campo `idioma` de una petición (cuerpo JSON o campo de FormData).
 *
 * - Ausente (`undefined` o `null`) → `'es'`, el valor por defecto del contrato.
 * - `'es'` / `'en'` → ese idioma.
 * - Cualquier otra cosa → `null`. La ruta responde 400.
 *
 * Se acepta `null` como "ausente" a propósito: `FormData.get()` devuelve `null`
 * cuando el campo no viene, así que tratarlo como ausente mantiene JSON y
 * multipart bajo la misma regla.
 */
export function idiomaDeSolicitud(valor: unknown): Idioma | null {
  if (valor === undefined || valor === null) return IDIOMA_POR_DEFECTO;
  return esIdioma(valor) ? valor : null;
}

/**
 * Cabecera por la que el cliente manda el idioma activo.
 *
 * Existe porque hay DOS momentos en que el cuerpo todavía no se puede leer:
 * el rate limit (que corre antes de parsear, a propósito, para no leer 20 MB de
 * audio bajo abuso) y un JSON que no parsea. En esos casos el idioma del
 * mensaje sale de acá. Cuando el cuerpo sí se puede leer, manda el cuerpo.
 */
export const CABECERA_IDIOMA = "x-idioma";

/**
 * Idioma de la cabecera `X-Idioma`. Si falta o no es válido (una petición hecha
 * a mano, sin pasar por el cliente), se cae al `Accept-Language` del navegador
 * y, sin ese tampoco, al default. Así el 503 de la demo pausada o un 429 le
 * llegan en inglés a quien navega en inglés aunque no mande `X-Idioma`.
 */
export function idiomaDeCabecera(request: Request): Idioma {
  const valor = request.headers.get(CABECERA_IDIOMA);
  if (esIdioma(valor)) return valor;
  return idiomaDeAcceptLanguage(request.headers.get("accept-language"));
}

// --- Idioma de la petición HTTP (servidor) ----------------------------------

/**
 * Idioma a partir de la cabecera `Accept-Language` (RFC 9110 §12.5.4), por
 * ejemplo `en-US,en;q=0.9,es;q=0.8`.
 *
 * Se ordenan las etiquetas por su peso `q` (ausente vale 1; `0` o inválido
 * descarta la etiqueta; a igual peso manda el orden de aparición), se ignora
 * el comodín `*`, y la etiqueta ganadora pasa por la misma regla que el
 * navegador (`idiomaDeEtiquetas`). Sin cabecera o sin etiquetas útiles → default.
 *
 * Es lo que usa el layout raíz para servir `<html lang>`, el metadata y el
 * primer render en el idioma del navegador, en lugar de siempre el default.
 */
export function idiomaDeAcceptLanguage(cabecera: string | null | undefined): Idioma {
  if (!cabecera) return IDIOMA_POR_DEFECTO;

  const etiquetas = cabecera
    .split(",")
    .map((parte, orden) => {
      const [etiqueta = "", ...parametros] = parte.trim().split(";");
      let peso = 1;
      for (const parametro of parametros) {
        const [clave, valor] = parametro.trim().split("=");
        if (clave?.trim().toLowerCase() !== "q") continue;
        const numero = Number(valor);
        peso = Number.isFinite(numero) ? numero : 0;
      }
      return { etiqueta: etiqueta.trim(), peso, orden };
    })
    .filter((entrada) => entrada.etiqueta !== "" && entrada.etiqueta !== "*" && entrada.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.orden - b.orden)
    .map((entrada) => entrada.etiqueta);

  return idiomaDeEtiquetas(etiquetas);
}

/** Cabeceras de una petición del cliente: JSON + idioma. */
export function cabecerasJson(idioma: Idioma): Record<string, string> {
  return { "Content-Type": "application/json", ...cabecerasIdioma(idioma) };
}

/** Cabeceras de una petición del cliente cuyo cuerpo NO es JSON (multipart). */
export function cabecerasIdioma(idioma: Idioma): Record<string, string> {
  return { [CABECERA_IDIOMA]: idioma };
}

// --- Idioma del navegador ---------------------------------------------------

/**
 * Idioma a partir de las etiquetas BCP-47 del navegador.
 *
 * Manda la PRIMERA etiqueta (la preferencia principal del usuario): si empieza
 * con `es` → español; cualquier otra cosa → inglés. Así `es`, `es-419` y
 * `es-MX` caen en español, y un usuario `["en-US","es-MX"]` recibe inglés, que
 * es lo que pidió primero.
 */
export function idiomaDeEtiquetas(etiquetas: readonly string[]): Idioma {
  const principal = (etiquetas[0] ?? "").trim().toLowerCase();
  if (principal === "es" || principal.startsWith("es-")) return "es";
  if (principal === "") return IDIOMA_POR_DEFECTO;
  return "en";
}

/** Idiomas preferidos del navegador, con `navigator.language` como respaldo. */
export function etiquetasDelNavegador(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const preferidos = navigator.languages;
  if (preferidos && preferidos.length > 0) return preferidos;
  return navigator.language ? [navigator.language] : [];
}

/** Idioma guardado en este navegador, o `null` si no hay ninguno usable. */
export function leerIdiomaGuardado(): Idioma | null {
  try {
    const valor = globalThis.localStorage?.getItem(CLAVE_IDIOMA);
    return esIdioma(valor) ? valor : null;
  } catch {
    // Modo privado o storage bloqueado: se cae al idioma del navegador.
    return null;
  }
}

/** Persiste el idioma elegido. Falla en silencio si el storage no está disponible. */
export function guardarIdioma(idioma: Idioma): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Sin storage el idioma simplemente no se recuerda entre visitas.
  }
}

/**
 * Idioma con el que arranca la app en el cliente: el guardado si lo hay, si no
 * el del navegador, y si no hay ninguna señal `respaldo` (el idioma con el que
 * el servidor sirvió la página, que a su vez salió de `Accept-Language`).
 */
export function resolverIdiomaInicial(respaldo: Idioma = IDIOMA_POR_DEFECTO): Idioma {
  const guardado = leerIdiomaGuardado();
  if (guardado) return guardado;
  const etiquetas = etiquetasDelNavegador();
  if (etiquetas.length === 0) return respaldo;
  return idiomaDeEtiquetas(etiquetas);
}

// --- Script de arranque -----------------------------------------------------

/**
 * Script que se inyecta en el `<head>` y corre ANTES del primer paint.
 *
 * Por qué existe: el servidor elige el idioma por `Accept-Language`, pero el
 * usuario puede haber guardado otro en localStorage (el selector), y eso solo
 * se puede leer en el cliente. Sin este script, el HTML viajaría con el `lang`
 * del navegador y el atributo se corregiría recién después de hidratar. Con él,
 * el `<html lang>` correcto ya está puesto en el primer frame.
 *
 * No parpadea ni rompe la hidratación porque NO cambia texto: solo mueve un
 * atributo fuera del árbol de React. El texto lo resuelve el proveedor (ver
 * ProveedorIdioma), que arranca con el idioma del servidor y lo corrige en un
 * layout effect, antes de que el navegador pinte.
 *
 * `idiomaServidor` es el respaldo cuando no hay nada guardado ni idiomas en el
 * navegador: el mismo valor con el que el servidor renderizó la página.
 *
 * Se genera desde IDIOMAS_REGISTRO para que la clave, los códigos y las
 * etiquetas no se dupliquen a mano; `test/idiomas.test.ts` ejecuta el script
 * generado y verifica que elija el mismo idioma que `resolverIdiomaInicial`.
 */
export function scriptIdiomaInicial(idiomaServidor: Idioma = IDIOMA_POR_DEFECTO): string {
  const etiquetas = IDIOMAS.map(
    (idioma) => `${JSON.stringify(idioma)}:${JSON.stringify(etiquetaIdioma(idioma))}`,
  ).join(",");

  return [
    "(function(){try{",
    `var etiquetas={${etiquetas}};`,
    `var clave=${JSON.stringify(CLAVE_IDIOMA)};`,
    `var defecto=${JSON.stringify(idiomaServidor)};`,
    "var guardado=null;",
    "try{guardado=localStorage.getItem(clave);}catch(e){}",
    "var idioma=(guardado&&etiquetas[guardado])?guardado:elegir();",
    "document.documentElement.lang=etiquetas[idioma];",
    "function elegir(){",
    "var lista=navigator.languages;",
    "var principal=(lista&&lista.length?lista[0]:navigator.language)||'';",
    "principal=String(principal).toLowerCase();",
    "if(!principal)return defecto;",
    "return (principal==='es'||principal.indexOf('es-')===0)?'es':'en';",
    "}",
    "}catch(e){}})();",
  ].join("");
}

/** Fija `<html lang>` al idioma dado (imperativo: el atributo no es de React). */
export function aplicarIdiomaAlDocumento(idioma: Idioma): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = etiquetaIdioma(idioma);
}
