import type { EsquemaJson, ProveedorModelo, SolicitudModelo } from "./modelo";
import { ErrorModelo } from "./error-modelo";
import { leerEnteroPositivo, leerTemperatura } from "./config-modelo";

// =============================================================================
// ADAPTADOR DE PROVEEDOR — GEMINI
// =============================================================================
// Este archivo es el ÚNICO con código específico de Gemini: endpoint,
// autenticación, forma del body, dialecto del esquema y ubicación del texto en
// la respuesta. Toda la política de reintentos/timeouts/parseo vive en
// `src/lib/modelo.ts`, que es neutro.
//
// El adaptador de Nebius (OpenAI-compatible) vive en `proveedor-nebius.ts`.
// Cuál se usa lo decide la fábrica de `modelo.ts` según `MODEL_PROVIDER`.
// =============================================================================

/** Gemini espera los tipos del esquema en MAYÚSCULAS (dialecto OpenAPI). */
function aEsquemaGemini(esquema: EsquemaJson): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(esquema)) {
    if (clave === "type" && typeof valor === "string") {
      salida.type = valor.toUpperCase();
    } else if (clave === "properties" && valor && typeof valor === "object") {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
        props[k] = aEsquemaGemini((v ?? {}) as EsquemaJson);
      }
      salida.properties = props;
    } else if (clave === "items" && valor && typeof valor === "object") {
      salida.items = aEsquemaGemini(valor as EsquemaJson);
    } else {
      salida[clave] = valor;
    }
  }
  return salida;
}

/**
 * Extrae el texto del primer candidato de `generateContent`. Es lo más
 * específico del proveedor: con un endpoint OpenAI-compatible hay que leer
 * `choices[0].message.content` (ver `proveedor-nebius.ts`).
 */
function extraerTextoGemini(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== "object") return null;
  const candidatos = (cuerpo as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidatos) || candidatos.length === 0) return null;
  const contenido = candidatos[0] as { content?: { parts?: { text?: string }[] } };
  const partes = contenido?.content?.parts;
  if (!Array.isArray(partes) || partes.length === 0) return null;
  const textos = partes.map((p) => p.text ?? "").join("");
  return textos.length > 0 ? textos : null;
}

export const proveedorGemini: ProveedorModelo = {
  nombre: "gemini",

  listarModelos(): string[] {
    const principal =
      process.env.MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
    const fallbacks = (process.env.MODEL_FALLBACK_MODELS ?? process.env.GEMINI_FALLBACK_MODELS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    return [principal, ...fallbacks];
  },

  async enviar({ modelo, solicitud, signal }: {
    modelo: string;
    solicitud: SolicitudModelo;
    signal: AbortSignal;
  }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ErrorModelo(
        "Falta GEMINI_API_KEY en las variables de entorno (server-side). Revisa .env.local o Settings → Variables en Railway.",
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
    const temperature = leerTemperatura(["MODEL_TEMPERATURE"], 0.7);
    const maxOutputTokens = leerEnteroPositivo(["MODEL_MAX_TOKENS"], 1024);

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: solicitud.system }] },
          contents: [{ parts: [{ text: solicitud.user }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: "application/json",
            responseSchema: aEsquemaGemini(solicitud.esquema),
          },
        }),
        signal,
      });
    } catch (error) {
      const e = error as Error;
      throw new ErrorModelo(
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
        // Sin cuerpo legible: el status alcanza para el mensaje (server-side).
      }
      throw new ErrorModelo(
        `El modelo ${modelo} respondió con error ${respuesta.status}${detalle ? `: ${detalle}` : ""}`,
        respuesta.status,
      );
    }

    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      throw new ErrorModelo(`El modelo ${modelo} devolvió una respuesta no JSON.`);
    }

    return extraerTextoGemini(cuerpo) ?? "";
  },
};
