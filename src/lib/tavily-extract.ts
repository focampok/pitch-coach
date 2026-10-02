/**
 * Cliente server-side de Tavily EXTRACT (Fase B, §12 del alcance).
 *
 * A diferencia de `/search` (que devuelve snippets cortos), Extract trae el
 * contenido real de una URL. Es el insumo del paso de validación obligatorio:
 * sin contenido extraído no hay nada que validar ni que citar.
 *
 * Contrato (https://docs.tavily.com/documentation/api-reference/extract):
 *   POST https://api.tavily.com/extract
 *   Authorization: Bearer {TAVILY_API_KEY}
 *   { urls: string[], query?, chunks_per_source?, extract_depth?, format?, timeout? }
 *
 * OJO: la API puede responder 200 y aun así fallar por URL (cada entrada de
 * `failed_results` es una URL que no se pudo extraer). Por eso el llamador debe
 * revisar SIEMPRE los dos arreglos, no solo el status HTTP.
 *
 * `query` (opcional) reordena los chunks extraídos hacia lo que importa
 * (la cifra), en vez de devolver los primeros párrafos de la página.
 *
 * Es "best effort": el enriquecimiento es opcional. Si Extract falla, el punto
 * se queda sin sugerencia y el dashboard no se rompe.
 */

/** Tope de contenido extraído que se le entrega al validador (caracteres). */
export const MAX_CONTENIDO_EXTRAIDO = 6000;

/** Timeout defensivo: Tavily no debe colgar el análisis. */
const TIMEOUT_MS = 12000;

interface ExtractResult {
  url?: string;
  raw_content?: string;
}

interface ExtractResponse {
  results?: ExtractResult[];
  failed_results?: unknown[];
}

export interface ContenidoExtraido {
  url: string;
  contenido: string;
}

/**
 * Extrae el contenido de una URL. Devuelve `null` si no se pudo extraer nada
 * utilizable (URL inválida, fallo de red, HTTP no-ok, sin `raw_content`).
 *
 * `personalizar` es el texto de enfoque (normalmente la query de búsqueda): se
 * manda como `query` para que Tavily priorice los chunks relevantes a la cifra.
 */
export async function extraerContenido(
  url: string,
  opciones: { personalizar?: string; timeoutMs?: number } = {},
): Promise<ContenidoExtraido | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: [url],
        ...(opciones.personalizar ? { query: opciones.personalizar } : {}),
        chunks_per_source: 3,
        extract_depth: "basic",
        format: "markdown",
        timeout: 10,
      }),
      signal: AbortSignal.timeout(opciones.timeoutMs ?? TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as ExtractResponse;
    const primero = data.results?.[0];
    const contenido = primero?.raw_content?.trim();
    if (!contenido) return null;

    return { url: primero?.url ?? url, contenido: contenido.slice(0, MAX_CONTENIDO_EXTRAIDO) };
  } catch {
    // Timeout, red caída, JSON inválido: enriquecimiento opcional, se degrada.
    return null;
  }
}
