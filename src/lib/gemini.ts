import type { EvaluacionRubrica } from "@/types/pitch";

// Cliente de la Gemini API (docs/alcance.md §13). Corre ÚNICAMENTE server-side
// (API routes): la clave GEMINI_API_KEY se lee de variables de entorno y nunca
// se expone al cliente.
//
// Configuración vía variables de entorno (ver .env.example):
//   - GEMINI_MODEL                modelo principal (verificado con generateContent)
//   - GEMINI_FALLBACK_MODELS      lista separada por comas de modelos de respaldo
//   - GEMINI_RETRY_ATTEMPTS       intentos por modelo (fallback interno ante errores
//                                 transitorios: 429/5xx/red/timeout), por defecto 3
//   - GEMINI_RETRY_DELAY_MS       delay base entre reintentos, por defecto 1000
//   - GEMINI_RETRY_MAX_DELAY_MS   tope del backoff exponencial, por defecto 8000
//
// Se usa salida estructurada (responseMimeType: "application/json" +
// responseSchema) para forzar JSON válido, en vez de depender solo del prompt.

/** Timeout de cada intento de la llamada (un análisis debe responder en segundos). */
const TIMEOUT_MS = 20_000;

/** Códigos HTTP que tienen sentido reintentar (transitorios o de límite). */
const ESTADOS_REINTENTABLES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Porción del resultado que devuelve Gemini. Los campos `muletillas` y los
 * tiempos no entran en el esquema: se detectan/ensamblan server-side en la
 * API route (las muletillas no requieren IA — docs/alcance.md §8).
 */
export interface ResultadoGemini {
  score: number;
  veredicto_corto: string;
  rubrica: EvaluacionRubrica[];
}

// Esquema de salida estructurada (formato OpenAPI que espera Gemini).
// Coincide con ResultadoGemini; los nombres con guion bajo son los mismos del
// contrato JSON del alcance (§13).
const SCHEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    veredicto_corto: { type: "STRING" },
    rubrica: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          punto: { type: "STRING" },
          cumplido: { type: "BOOLEAN" },
          comentario: { type: "STRING" },
        },
      },
    },
  },
} as const;

interface ConfigGemini {
  modeloPrincipal: string;
  modelosFallback: string[];
  intentosPorModelo: number;
  delayBaseMs: number;
  delayMaxMs: number;
}

/** Lee y normaliza la configuración desde variables de entorno. */
function leerConfig(): ConfigGemini {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return {
    modeloPrincipal: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    modelosFallback: fallbacks,
    intentosPorModelo: parsearEnteroPositivo(process.env.GEMINI_RETRY_ATTEMPTS, 3),
    delayBaseMs: parsearEnteroPositivo(process.env.GEMINI_RETRY_DELAY_MS, 1000),
    delayMaxMs: parsearEnteroPositivo(process.env.GEMINI_RETRY_MAX_DELAY_MS, 8000),
  };
}

function parsearEnteroPositivo(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porDefecto;
}

/** Pausa promisificada. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía el prompt a Gemini y devuelve el análisis tipado.
 *
 * Estrategia de resiliencia (configurable vía entorno):
 * 1. Se recorre la lista [modelo principal, ...fallbacks].
 * 2. Por cada modelo se hacen hasta `intentosPorModelo` intentos, con backoff
 *    exponencial (delay base * 2^n, con tope en delay máximo).
 * 3. Solo se reintenta ante errores transitorios (429/5xx/timeout/red); un 400
 *    (o 404 de modelo no disponible) NO se reintenta y hace saltar al siguiente
 *    modelo de la lista.
 * 4. Si todo falla, se lanza Error con el mensaje más claro del último fallo.
 */
export async function analizarConGemini(prompt: string): Promise<ResultadoGemini> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY en las variables de entorno (server-side). Revisa .env.local o Settings → Variables en Railway.",
    );
  }

  const config = leerConfig();
  const modelos = [config.modeloPrincipal, ...config.modelosFallback];
  let ultimoError: Error | null = null;

  for (const modelo of modelos) {
    for (let intento = 1; intento <= config.intentosPorModelo; intento++) {
      try {
        return await llamarModelo(modelo, prompt, apiKey);
      } catch (error) {
        const e = error as Error;
        ultimoError = e;

        if (!esReintentable(e)) {
          // Error permanente (400/404/etc.): no tiene sentido reintentar el
          // mismo modelo; se pasa al siguiente de la lista.
          break;
        }
        // Error transitorio: reintentar el mismo modelo salvo que sea el último
        // intento (entonces pasar al siguiente modelo).
        if (intento < config.intentosPorModelo) {
          const delay = Math.min(
            config.delayBaseMs * 2 ** (intento - 1),
            config.delayMaxMs,
          );
          await esperar(delay);
        }
      }
    }
  }

  throw new Error(
    `Gemini falló con todos los modelos tras ${modelos.length} modelo(s) y hasta ${config.intentosPorModelo} intento(s) por modelo. Último error: ${ultimoError?.message ?? "desconocido"}`,
  );
}

/** Determina si un error puede resolverse reintentando el mismo modelo. */
function esReintentable(error: Error): boolean {
  const codigo = (error as { codigoHttp?: number }).codigoHttp;
  // Sin código HTTP (red/timeout) también se reintenta.
  if (codigo === undefined) return true;
  return ESTADOS_REINTENTABLES.has(codigo);
}

/** Hace una llamada a generateContent de un modelo y devuelve el resultado validado. */
async function llamarModelo(
  modelo: string,
  prompt: string,
  apiKey: string,
): Promise<ResultadoGemini> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: SCHEMA_RESPUESTA,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const e = error as Error;
    // AbortSignal.timeout lanza TimeoutError en Node. Se marca como transitorio
    // (sin codigoHttp → esReintentable devuelve true).
    throw new Error(
      e.name === "TimeoutError"
        ? `El modelo ${modelo} no respondió a tiempo (timeout).`
        : `Error de red al conectar con el modelo ${modelo}: ${e.message}`,
    );
  }

  if (!respuesta.ok) {
    let detalle = "";
    try {
      detalle = await respuesta.text();
    } catch {
      // Sin cuerpo legible: el status alcanza para el mensaje.
    }
    const error = new Error(
      `El modelo ${modelo} respondió con error ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
    );
    // Marca el código HTTP para decidir reintento vs. siguiente modelo.
    (error as { codigoHttp?: number }).codigoHttp = respuesta.status;
    throw error;
  }

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    throw new Error(`El modelo ${modelo} devolvió una respuesta no JSON.`);
  }

  // Extrae el texto del primer candidato (estructura estándar de generateContent).
  const texto = extraerTexto(cuerpo);
  if (texto === null) {
    throw new Error(`El modelo ${modelo} devolvió una respuesta vacía o inesperada.`);
  }

  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error(`El modelo ${modelo} no devolvió JSON estructurado válido.`);
  }

  return validarResultado(datos);
}

/**
 * Extrae el texto concatenado del primer candidato. Devuelve null si no hay
 * candidato con texto.
 */
function extraerTexto(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== "object") return null;
  const candidatos = (cuerpo as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidatos) || candidatos.length === 0) return null;
  const contenido = candidatos[0] as { content?: { parts?: { text?: string }[] } };
  const partes = contenido?.content?.parts;
  if (!Array.isArray(partes) || partes.length === 0) return null;
  const textos = partes.map((p) => p.text ?? "").join("");
  return textos.length > 0 ? textos : null;
}

/** Valida que el JSON parseado tenga la forma esperada por ResultadoGemini. */
function validarResultado(datos: unknown): ResultadoGemini {
  if (datos === null || typeof datos !== "object") {
    throw new Error("Gemini devolvió un JSON que no es un objeto.");
  }
  const d = datos as Record<string, unknown>;

  if (typeof d.score !== "number" || Number.isNaN(d.score)) {
    throw new Error("Gemini no devolvió un score numérico válido.");
  }
  if (typeof d.veredicto_corto !== "string" || d.veredicto_corto.trim() === "") {
    throw new Error("Gemini no devolvió un veredicto_corto válido.");
  }
  if (!Array.isArray(d.rubrica)) {
    throw new Error("Gemini no devolvió una rúbrica (array) válida.");
  }

  // Normaliza cada evaluación: tolera campos faltantes pero exige la forma.
  const rubrica = d.rubrica.map((item) => {
    if (item === null || typeof item !== "object") {
      throw new Error("Gemini devolvió un ítem de rúbrica inválido.");
    }
    const e = item as Record<string, unknown>;
    return {
      punto: typeof e.punto === "string" ? e.punto : "",
      cumplido: typeof e.cumplido === "boolean" ? e.cumplido : false,
      comentario: typeof e.comentario === "string" ? e.comentario : "",
    } satisfies EvaluacionRubrica;
  });

  return {
    score: d.score,
    veredicto_corto: d.veredicto_corto,
    rubrica,
  };
}
