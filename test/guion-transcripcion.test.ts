import { describe, expect, it } from "vitest";
import {
  construirGuion,
  extraerPalabrasScribe,
  formatearMarcaTiempo,
  tieneMarcasDeTiempo,
} from "@/lib/guion-transcripcion";
import type { PalabraTranscripcion } from "@/types/pitch";

function palabra(
  text: string,
  start: number | null,
  end: number | null,
  type: PalabraTranscripcion["type"] = "word",
): PalabraTranscripcion {
  return { text, type, start, end };
}

describe("formatearMarcaTiempo", () => {
  it("escribe mm:ss.cc con los segundos de Scribe", () => {
    expect(formatearMarcaTiempo(4.16)).toBe("00:04.16");
    expect(formatearMarcaTiempo(65.5)).toBe("01:05.50");
    expect(formatearMarcaTiempo(0)).toBe("00:00.00");
  });
});

describe("extraerPalabrasScribe", () => {
  it("conserva text/type/start/end y tira logprob", () => {
    const palabras = extraerPalabrasScribe({
      text: "Uno, dos",
      words: [
        {
          text: "Uno,",
          start: 4.16,
          end: 4.42,
          type: "word",
          logprob: -0.01,
          speaker_id: "speaker_0",
        },
        { text: " ", start: 4.42, end: 4.5, type: "spacing", logprob: 0 },
      ],
    });
    expect(palabras).toEqual([
      { text: "Uno,", type: "word", start: 4.16, end: 4.42 },
      { text: " ", type: "spacing", start: 4.42, end: 4.5 },
    ]);
  });

  it("lee el campo palabras de /api/transcribir", () => {
    expect(
      extraerPalabrasScribe({
        texto: "Hola",
        palabras: [{ text: "Hola", type: "word", start: 0.2, end: 0.5 }],
      }),
    ).toEqual([{ text: "Hola", type: "word", start: 0.2, end: 0.5 }]);
  });

  it("con timestamps_granularity none deja start/end en null", () => {
    const palabras = extraerPalabrasScribe({
      words: [{ text: "Uno,", type: "word", start: null, end: null }],
    });
    expect(palabras[0]).toEqual({
      text: "Uno,",
      type: "word",
      start: null,
      end: null,
    });
    expect(tieneMarcasDeTiempo(palabras)).toBe(false);
  });
});

describe("construirGuion", () => {
  it("vacío si no hay marcas de tiempo", () => {
    expect(
      construirGuion([palabra("Uno,", null, null), palabra(" ", null, null, "spacing")]),
    ).toBe("");
  });

  it("una línea por oración, con la marca del primer word", () => {
    const guion = construirGuion([
      palabra("Uno,", 4.16, 4.42),
      palabra(" ", 4.42, 4.5, "spacing"),
      palabra("dos,", 4.5, 4.72),
      palabra(" ", 4.72, 4.8, "spacing"),
      palabra("tres.", 4.8, 5.1),
      palabra(" ", 5.1, 5.2, "spacing"),
      palabra("Probando.", 5.2, 5.8),
    ]);
    expect(guion).toBe("[00:04.16] Uno, dos, tres.\n[00:05.20] Probando.");
  });

  it("abre línea nueva tras una pausa ≥ 0.6 s", () => {
    const guion = construirGuion([
      palabra("Hola", 1.0, 1.4),
      palabra(" ", 1.4, 1.5, "spacing"),
      palabra("seguimos", 2.3, 2.8),
    ]);
    expect(guion).toBe("[00:01.00] Hola\n[00:02.30] seguimos");
  });

  it("omite audio_event", () => {
    const guion = construirGuion([
      palabra("(risa)", 0.1, 0.4, "audio_event"),
      palabra("Hola.", 0.5, 0.9),
    ]);
    expect(guion).toBe("[00:00.50] Hola.");
  });
});
