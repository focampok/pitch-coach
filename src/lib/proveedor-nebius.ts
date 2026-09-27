import type { EsquemaJson, NivelAnalisis, ProveedorModelo, SolicitudModelo } from "./modelo";

export type { NivelAnalisis };
import { ErrorModelo } from "./error-modelo";
import { leerEnteroPositivo, leerTemperatura } from "./config-modelo";
import { construirEsquemaAnalisisRestringido } from "./validar-analisis";

// =============================================================================
// ADAPTADOR DE PROVEEDOR — NEBIUS TOKEN FACTORY
// =============================================================================
// Endpoint OpenAI-compatible (`POST /chat/completions`). A diferencia de
// Gemini, la salida estructurada se pide con el envoltorio
//   response_format: { type: "json_schema", json_schema: { name, strict, schema } }
// (sin el envoltorio, la API responde 422).
//
// Toda la política de reintentos/timeouts/parseo vive en `modelo.ts` (neutro).
// Este archivo solo transporta y clasifica errores vía `ErrorModelo`.
// =============================================================================

const BASE_URL_POR_DEFECTO = "https://api.tokenfactory.nebius.com/v1";
const MODELO_POR_DEFECTO = "nvidia/nemotron-3-super-120b-a12b";
const MODELO_ULTRA_POR_DEFECTO = "nvidia/Nemotron-3-Ultra-550b-a55b";
const MODELO_NANO_POR_DEFECTO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

/** Tope de tokens de salida al reintentar una respuesta truncada. */
export const TECHO_MAX_TOKENS_TRUNCADO = 8192;

/** URL base sin barra final. */
function leerBaseUrl(): string {
  const valor = process.env.NEBIUS_BASE_URL?.trim() || BASE_URL_POR_DEFECTO;
  return valor.replace(/\/+$/, "");
}

/** Modelo principal del modo estándar (`MODEL`, sin alias de Gemini). */
function obtenerModeloEstandar(): string {
  return process.env.MODEL?.trim() || MODELO_POR_DEFECTO;
}

/** Modelo del modo ultra (razonamiento activo). */
function obtenerModeloUltra(): string {
  return process.env.NEBIUS_MODEL_ULTRA?.trim() || MODELO_ULTRA_POR_DEFECTO;
}

/** Modelo del modo rápido (Nano, p. ej. sparring). */
function obtenerModeloNano(): string {
  return process.env.NEBIUS_MODEL_NANO?.trim() || MODELO_NANO_POR_DEFECTO;
}

/** Fallbacks del modo estándar, en orden. */
function listarFallbacks(): string[] {
  return (process.env.MODEL_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Forma (parcial) de una respuesta de `/chat/completions`. */
interface RespuestaChatCompletions {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null };
  }[];
}

/** Texto + motivo de parada de una llamada ya resuelta. */
interface ResultadoLlamada {
  texto: string;
  finishReason: string | null;
}

function extraerResultadoNebius(cuerpo: unknown): ResultadoLlamada {
  if (cuerpo === null || typeof cuerpo !== "object") return { texto: "", finishReason: null };
  const choices = (cuerpo as RespuestaChatCompletions).choices;
  if (!Array.isArray(choices) || choices.length === 0) return { texto: "", finishReason: null };

  const eleccion = choices[0];
  const finishReason =
    typeof eleccion?.finish_reason === "string" ? eleccion.finish_reason : null;
  const contenido = eleccion?.message?.content;
  return { texto: typeof contenido === "string" ? contenido : "", finishReason };
}

/** Una única llamada HTTP. Lanza `ErrorModelo` con `codigoHttp` si falla. */
async function llamarUnaVez(args: {
  modelo: string;
  solicitud: SolicitudModelo;
  maxTokens: number;
  incluirChatTemplateKwargs: boolean;
  signal: AbortSignal;
}): Promise<ResultadoLlamada> {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    // 401 (no reintentable): es un error de configuración, no de red.
    throw new ErrorModelo(
      "Falta NEBIUS_API_KEY en las variables de entorno (server-side). Revisa .env.local o Settings → Variables en Railway.",
      401,
    );
  }

  const url = `${leerBaseUrl()}/chat/completions`;
  const temperature = leerTemperatura(["MODEL_TEMPERATURE"], 0.7);

  // Esquema restringido (minItems/maxItems exactos) cuando el llamador aporta
  // los puntos de la rúbrica; si no, el esquema neutro tal cual.
  const esquema: EsquemaJson = args.solicitud.puntosRubrica?.length
    ? construirEsquemaAnalisisRestringido(args.solicitud.puntosRubrica, {
        incluirTraza: args.solicitud.incluirTraza === true,
      })
    : args.solicitud.esquema;

  const body: Record<string, unknown> = {
    model: args.modelo,
    messages: [
      { role: "system", content: args.solicitud.system },
      { role: "user", content: args.solicitud.user },
    ],
    temperature,
    max_tokens: args.maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: args.solicitud.nombreEsquema ?? "analisis_pitch",
        strict: true,
        schema: esquema,
      },
    },
  };

  // `enable_thinking: false` desactiva el razonamiento del modelo (0 tokens de
  // razonamiento sin perder validez del JSON). En modo ultra se OMITE.
  if (args.incluirChatTemplateKwargs) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (error) {
    const e = error as Error;
    throw new ErrorModelo(
      e.name === "TimeoutError"
        ? `El modelo ${args.modelo} no respondió a tiempo (timeout).`
        : `Error de red al conectar con el modelo ${args.modelo}: ${e.message}`,
    );
  }

  if (!respuesta.ok) {
    let detalle = "";
    try {
      detalle = await respuesta.text();
    } catch {
      // Sin cuerpo legible: el status alcanza para el mensaje (server-side).
    }
    throw new ErrorModelo(
      `El modelo ${args.modelo} respondió con error ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
      respuesta.status,
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    throw new ErrorModelo(`El modelo ${args.modelo} devolvió una respuesta no JSON.`);
  }

  return extraerResultadoNebius(cuerpo);
}

/**
 * Crea un adaptador de Nebius según el nivel:
 *
 * - `estandar`: usa `MODEL` (`nvidia/nemotron-3-super-120b-a12b` por defecto) y
 *   manda `chat_template_kwargs: { enable_thinking: false }`.
 * - `ultra`: usa `NEBIUS_MODEL_ULTRA` y OMITE `chat_template_kwargs` (deja el
 *   razonamiento activo).
 * - `rapido`: usa `NEBIUS_MODEL_NANO` y manda
 *   `chat_template_kwargs: { enable_thinking: false }`.
 */
export function crearProveedorNebius(nivel: NivelAnalisis = "estandar"): ProveedorModelo {
  const esUltra = nivel === "ultra";
  const esRapido = nivel === "rapido";

  return {
    nombre: "nebius",

    listarModelos(): string[] {
      if (esUltra) return [obtenerModeloUltra()];
      if (esRapido) return [obtenerModeloNano()];
      return [obtenerModeloEstandar(), ...listarFallbacks()];
    },

    async enviar({ modelo, solicitud, signal }: {
      modelo: string;
      solicitud: SolicitudModelo;
      signal: AbortSignal;
    }): Promise<string> {
      // En ultra/rápido el modelo lo fija el nivel (un único modelo, sin fallbacks).
      const modeloEfectivo = esUltra
        ? obtenerModeloUltra()
        : esRapido
          ? obtenerModeloNano()
          : modelo;
      const maxTokensInicial = leerEnteroPositivo(
        ["MODEL_MAX_TOKENS"],
        esUltra ? 2048 : 1024,
      );

      const primera = await llamarUnaVez({
        modelo: modeloEfectivo,
        solicitud,
        maxTokens: maxTokensInicial,
        incluirChatTemplateKwargs: !esUltra,
        signal,
      });

      // `length` no es éxito ni error genérico: es señal de reintento con más
      // presupuesto. Se reintenta UNA vez esta misma llamada antes de devolver
      // el control al bucle de reintentos/modelos de `modelo.ts`.
      if (primera.finishReason !== "length") return primera.texto;

      const maxTokensAmpliado = Math.min(maxTokensInicial * 2, TECHO_MAX_TOKENS_TRUNCADO);
      if (maxTokensAmpliado <= maxTokensInicial) {
        throw new ErrorModelo(
          `El modelo ${modeloEfectivo} truncó la respuesta (finish_reason: length) y ya está en el tope de ${TECHO_MAX_TOKENS_TRUNCADO} tokens de salida.`,
        );
      }

      const segunda = await llamarUnaVez({
        modelo: modeloEfectivo,
        solicitud,
        maxTokens: maxTokensAmpliado,
        incluirChatTemplateKwargs: !esUltra,
        signal,
      });

      if (segunda.finishReason === "length") {
        throw new ErrorModelo(
          `El modelo ${modeloEfectivo} truncó la respuesta otra vez (finish_reason: length) aun con ${maxTokensAmpliado} tokens de salida.`,
        );
      }

      return segunda.texto;
    },
  };
}

/** Adaptador por defecto (modo estándar). */
export const proveedorNebius = crearProveedorNebius("estandar");
