import { describe, expect, it } from "vitest";

import {
  MAX_AUDIO_BYTES,
  MAX_PREGUNTA_SPARRING_CARACTERES,
  MAX_RESPUESTA_SPARRING_CARACTERES,
  MAX_TRANSCRIPCION_CARACTERES,
  excedeLimiteAudio,
  excedeLimitePreguntaSparring,
  excedeLimiteRespuestaSparring,
  excedeLimiteTranscripcion,
  mimeAudioPermitido,
} from "@/lib/limites";

describe("excedeLimiteTranscripcion", () => {
  it("permite una transcripción justo en el máximo", () => {
    expect(excedeLimiteTranscripcion("a".repeat(MAX_TRANSCRIPCION_CARACTERES))).toBe(false);
  });

  it("rechaza una transcripción un carácter por encima del máximo", () => {
    expect(excedeLimiteTranscripcion("a".repeat(MAX_TRANSCRIPCION_CARACTERES + 1))).toBe(true);
  });

  it("permite texto corto y vacío", () => {
    expect(excedeLimiteTranscripcion("")).toBe(false);
    expect(excedeLimiteTranscripcion("pitch corto")).toBe(false);
  });
});

describe("límites de sparring", () => {
  it("el tope de respuesta es menor que el de transcripción", () => {
    expect(MAX_RESPUESTA_SPARRING_CARACTERES).toBeLessThan(MAX_TRANSCRIPCION_CARACTERES);
  });

  it("rechaza una respuesta de sparring un carácter por encima del máximo", () => {
    expect(excedeLimiteRespuestaSparring("a".repeat(MAX_RESPUESTA_SPARRING_CARACTERES))).toBe(
      false,
    );
    expect(
      excedeLimiteRespuestaSparring("a".repeat(MAX_RESPUESTA_SPARRING_CARACTERES + 1)),
    ).toBe(true);
  });

  it("rechaza una pregunta de sparring por encima del máximo", () => {
    expect(excedeLimitePreguntaSparring("a".repeat(MAX_PREGUNTA_SPARRING_CARACTERES + 1))).toBe(
      true,
    );
  });
});

describe("límites de audio (Scribe)", () => {
  it("permite un archivo justo en el máximo", () => {
    expect(excedeLimiteAudio(MAX_AUDIO_BYTES)).toBe(false);
  });

  it("rechaza un byte por encima del máximo", () => {
    expect(excedeLimiteAudio(MAX_AUDIO_BYTES + 1)).toBe(true);
  });

  it("acepta webm y mp4 con o sin codecs", () => {
    expect(mimeAudioPermitido("audio/webm")).toBe(true);
    expect(mimeAudioPermitido("audio/webm;codecs=opus")).toBe(true);
    expect(mimeAudioPermitido("audio/mp4")).toBe(true);
    expect(mimeAudioPermitido("video/mp4")).toBe(true);
    expect(mimeAudioPermitido("")).toBe(true);
  });

  it("rechaza un MIME que Scribe no lista", () => {
    expect(mimeAudioPermitido("application/pdf")).toBe(false);
    expect(mimeAudioPermitido("image/png")).toBe(false);
  });
});
