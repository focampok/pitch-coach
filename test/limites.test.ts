import { describe, expect, it } from "vitest";

import {
  MAX_TRANSCRIPCION_CARACTERES,
  excedeLimiteTranscripcion,
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
