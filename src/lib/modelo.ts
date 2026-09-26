import { proveedorGemini } from "./proveedor-gemini";
import { proveedorNebius } from "./proveedor-nebius";
import { ErrorModelo } from "./error-modelo";

export { ErrorModelo };

// Capa NEUTRA respecto al proveedor para invocar un modelo de lenguaje.
// Todo lo que NO depende del proveedor vive aquí: reintentos con backoff,
// timeout por intento, extracción tolerante del JSON y parseo. El código
// específico de cada proveedor (endpoint, autenticación, forma del body,
// dialecto del esquema y extracción del texto) vive en su propio adaptador:
//   - `src/lib/proveedor-gemini.ts`  (Gemini / generateContent)
//   - `src/lib/proveedor-nebius.ts`  (Nebius / OpenAI-compatible)
// `proveedorActivo()` elige uno según `MODEL_PROVIDER`.

/** Esquema de respuesta en dialecto neutro (JSON Schema, tipos en minúsculas). */
export type EsquemaJson = Record<string, unknown>;

/** Entrada de una llamada al modelo: persona (system) + contenido (user). */
export interface SolicitudModelo {
  system: string;
  user: string;
  /** Esquema que el modelo debe respetar. El adaptador lo traduce a su dialecto. */
  esquema: EsquemaJson;
  /**
   * Nombres de los puntos de la rúbrica, en orden. Es dato OPCIONAL: los
   * adaptadores que lo aprovechan (Nebius) derivan de él un esquema
   * restringido con `minItems === maxItems === puntos.length`; los que no
   * (Gemini) lo ignoran y siguen usando `esquema` tal cual.
   */
  puntosRubrica?: readonly string[];
}

/**
 * Entrada de `llamarModelo`: la solicitud al modelo más la validación del JSON.
 * `validar` recibe el JSON ya parseado y devuelve el valor tipado; si lanza, el
 * error se trata como transitorio y aprovecha el reintento existente.
 */
export interface EntradaLlamarModelo<T> extends SolicitudModelo {
  validar: (datos: unknown) => T;
}

/** Contrato que debe cumplir cualquier adaptador de proveedor. */
export interface ProveedorModelo {
  /** Nombre para logs (nunca se expone al cliente). */
  nombre: string;
  /** Lista de modelos a intentar, en orden (principal primero). */
  listarModelos(): string[];
  /**
   * Envía la solicitud y devuelve el TEXTO crudo de la respuesta del modelo.
   * Debe lanzar `ErrorModelo` (con `codigoHttp` cuando aplique) ante fallos.
   */
  enviar(args: {
    modelo: string;
    solicitud: SolicitudModelo;
    signal: AbortSignal;
  }): Promise<string>;
}

/** Nombres de proveedor soportados por la fábrica. */
export type NombreProveedor = "gemini" | "nebius";

/** Proveedor por defecto cuando `MODEL_PROVIDER` no está definido. */
const PROVEEDOR_POR_DEFECTO: NombreProveedor = "nebius";

/**
 * Fábrica simple (sin librerías nuevas): devuelve el adaptador del proveedor
 * activo según `MODEL_PROVIDER`. Se resuelve en cada llamada para que un cambio
 * de variable de entorno (o un test) surta efecto sin reiniciar el módulo.
 */
export function proveedorActivo(): ProveedorModelo {
  const configurado = (process.env.MODEL_PROVIDER ?? "").trim().toLowerCase();
  const nombre = (configurado || PROVEEDOR_POR_DEFECTO) as NombreProveedor;

  switch (nombre) {
    case "gemini":
      return proveedorGemini;
    case "nebius":
      return proveedorNebius;
    default:
      throw new ErrorModelo(
        `MODEL_PROVIDER inválido: "${configurado}". Valores válidos: gemini, nebius.`,
      );
  }
}

/** Timeout de cada intento (un análisis debe responder en segundos). */
const TIMEOUT_MS = 20_000;

/** Códigos HTTP transitorios que tiene sentido reintentar. */
const ESTADOS_REINTENTABLES = new Set([408, 429, 500, 502, 503, 504]);

/** Pausa promisificada. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lee el primer entero positivo definido entre varios nombres de variable.
 * Se aceptan nombres genéricos (`MODEL_RETRY_*`) y, por compatibilidad, los
 * anteriores (`GEMINI_RETRY_*`). No se requiere renombrar variables para migrar.
 */
function leerEnteroPositivo(nombres: string[], porDefecto: number): number {
  for (const nombre of nombres) {
    const valor = process.env[nombre];
    if (valor === undefined || valor === "") continue;
    const n = Number(valor);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return porDefecto;
}

/** Extrae del texto la porción que corresponde a un objeto JSON. */
export function extraerJson(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  // 1. Bloque de código ```json ... ``` (o ``` ... ```).
  const bloque = limpio.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidato = bloque ? bloque[1].trim() : limpio;

  // 2. Si ya es JSON puro, devolverlo tal cual.
  if (candidato.startsWith("{") && candidato.endsWith("}")) return candidato;

  // 3. Si hay prosa antes/después, recortar del primer `{` al último `}`.
  const inicio = candidato.indexOf("{");
  const fin = candidato.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin <= inicio) return null;
  return candidato.slice(inicio, fin + 1);
}

/** Determina si un error puede resolverse reintentando el mismo modelo. */
function esReintentable(error: ErrorModelo): boolean {
  if (error.codigoHttp === undefined) return true;
  return ESTADOS_REINTENTABLES.has(error.codigoHttp);
}

/** Normaliza cualquier excepción a `ErrorModelo` para la capa neutra. */
function normalizarError(error: unknown, modelo: string): ErrorModelo {
  if (error instanceof ErrorModelo) return error;
  const e = error as Error;
  if (e?.name === "TimeoutError") {
    return new ErrorModelo(`El modelo ${modelo} no respondió a tiempo (timeout).`);
  }
  return new ErrorModelo(`Error al invocar el modelo ${modelo}: ${e?.message ?? "desconocido"}`);
}

/** Convierte el texto devuelto por el modelo en JSON parseado. */
function parsearRespuesta<T>(texto: string | null, modelo: string): T {
  if (texto === null || texto.trim() === "") {
    throw new ErrorModelo(`El modelo ${modelo} devolvió una respuesta vacía o inesperada.`);
  }
  const json = extraerJson(texto);
  if (json === null) {
    throw new ErrorModelo(`El modelo ${modelo} no devolvió JSON estructurado válido.`);
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new ErrorModelo(`El modelo ${modelo} no devolvió JSON estructurado válido.`);
  }
}

/**
 * Única puerta de entrada al modelo de lenguaje.
 *
 * Devuelve el JSON ya parseado y tipado como `T`. Toda la política de
 * resiliencia vive aquí, fuera del adaptador de proveedor:
 * 1. Recorre `proveedor.listarModelos()` (principal + fallbacks).
 * 2. Por modelo hace hasta `MODEL_RETRY_ATTEMPTS` intentos con backoff
 *    exponencial (`delayBase * 2^(intento-1)`, con tope en `delayMax`).
 * 3. Solo reintenta errores transitorios (429/5xx/timeout/red); un error
 *    permanente (400/404) salta al siguiente modelo.
 * 4. Si todo falla, lanza `ErrorModelo` con el último detalle (server-side).
 */
export async function llamarModelo<T>(entrada: EntradaLlamarModelo<T>): Promise<T> {
  const proveedor = proveedorActivo();
  const modelos = proveedor.listarModelos();
  const intentos = leerEnteroPositivo(
    ["MODEL_RETRY_ATTEMPTS", "GEMINI_RETRY_ATTEMPTS"],
    3,
  );
  const delayBase = leerEnteroPositivo(
    ["MODEL_RETRY_DELAY_MS", "GEMINI_RETRY_DELAY_MS"],
    1000,
  );
  const delayMax = leerEnteroPositivo(
    ["MODEL_RETRY_MAX_DELAY_MS", "GEMINI_RETRY_MAX_DELAY_MS"],
    8000,
  );

  let ultimoError: ErrorModelo | null = null;

  for (const modelo of modelos) {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const texto = await proveedor.enviar({
          modelo,
          solicitud: entrada,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return entrada.validar(parsearRespuesta<unknown>(texto, modelo));
      } catch (error) {
        const err = normalizarError(error, modelo);
        ultimoError = err;

        // Error permanente: no se reintenta el mismo modelo, se pasa al siguiente.
        if (!esReintentable(err)) break;

        if (intento < intentos) {
          const delay = Math.min(delayBase * 2 ** (intento - 1), delayMax);
          await esperar(delay);
        }
      }
    }
  }

  throw new ErrorModelo(
    `El modelo falló con todos los proveedores configurados (${modelos.length} modelo(s) × ${intentos} intento(s)). Último error: ${ultimoError?.message ?? "desconocido"}`,
    ultimoError?.codigoHttp,
  );
}

/** Expuesto para logs y mensajes internos; nunca se envía al cliente. */
export function nombreProveedor(): string {
  return proveedorActivo().nombre;
}
