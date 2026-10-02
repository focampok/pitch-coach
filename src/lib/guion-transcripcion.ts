import type { PalabraTranscripcion, TipoPalabraTranscripcion } from "@/types/pitch";

/** Silencio entre tokens (s) que abre una línea nueva del guion. */
const PAUSA_NUEVA_LINEA_S = 0.6;

/** Cierre de oración en el texto de un token `word` de Scribe. */
const CIERRE_ORACION = /[.!?…]["»”']?$/;

const TIPOS: ReadonlySet<string> = new Set(["word", "spacing", "audio_event"]);

function esNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/**
 * Extrae de la respuesta de Scribe solo lo que el producto conserva.
 * Ignora `logprob`, `speaker_id` y `characters`. Entradas sin `text` se tiran.
 */
export function extraerPalabrasScribe(cuerpo: unknown): PalabraTranscripcion[] {
  if (cuerpo === null || typeof cuerpo !== "object") return [];
  const rawWords = cuerpo as { words?: unknown; palabras?: unknown };
  const words = Array.isArray(rawWords.words)
    ? rawWords.words
    : Array.isArray(rawWords.palabras)
      ? rawWords.palabras
      : null;
  if (words === null) return [];

  const palabras: PalabraTranscripcion[] = [];
  for (const entrada of words) {
    if (entrada === null || typeof entrada !== "object") continue;
    const raw = entrada as { text?: unknown; type?: unknown; start?: unknown; end?: unknown };
    if (typeof raw.text !== "string") continue;
    const type: TipoPalabraTranscripcion = TIPOS.has(String(raw.type))
      ? (raw.type as TipoPalabraTranscripcion)
      : "word";
    palabras.push({
      text: raw.text,
      type,
      start: esNumeroFinito(raw.start) ? raw.start : null,
      end: esNumeroFinito(raw.end) ? raw.end : null,
    });
  }
  return palabras;
}

export function tieneMarcasDeTiempo(
  palabras: readonly PalabraTranscripcion[],
): boolean {
  return palabras.some((p) => p.type === "word" && p.start !== null);
}

/** `[mm:ss.cc]` en segundos de Scribe (p. ej. 4.16 → `00:04.16`). */
export function formatearMarcaTiempo(segundos: number): string {
  const seguro = Math.max(0, segundos);
  const minutos = Math.floor(seguro / 60);
  const resto = seguro - minutos * 60;
  const mm = String(minutos).padStart(2, "0");
  const ss = resto.toFixed(2).padStart(5, "0");
  return `${mm}:${ss}`;
}

/**
 * Guion de texto: una línea por frase o por pausa ≥ 0.6 s.
 * Vacío si no hay ninguna palabra con `start` (no hay línea de tiempo).
 */
export function construirGuion(palabras: readonly PalabraTranscripcion[]): string {
  if (!tieneMarcasDeTiempo(palabras)) return "";

  const lineas: { start: number; texto: string }[] = [];
  let buffer = "";
  let startLinea: number | null = null;
  let finAnterior: number | null = null;

  const flush = () => {
    const texto = buffer.replace(/\s+/g, " ").trim();
    if (texto !== "" && startLinea !== null) {
      lineas.push({ start: startLinea, texto });
    }
    buffer = "";
    startLinea = null;
  };

  for (const palabra of palabras) {
    if (palabra.type === "audio_event") continue;

    const inicio = palabra.start;
    if (
      inicio !== null &&
      finAnterior !== null &&
      inicio - finAnterior >= PAUSA_NUEVA_LINEA_S
    ) {
      flush();
    }

    if (palabra.type === "word" && startLinea === null && inicio !== null) {
      startLinea = inicio;
    }

    buffer += palabra.text;
    if (palabra.end !== null) finAnterior = palabra.end;
    else if (inicio !== null) finAnterior = inicio;

    if (palabra.type === "word" && CIERRE_ORACION.test(palabra.text)) {
      flush();
    }
  }
  flush();

  return lineas
    .map((linea) => `[${formatearMarcaTiempo(linea.start)}] ${linea.texto}`)
    .join("\n");
}
