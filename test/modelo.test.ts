import { describe, expect, it } from "vitest";

import { extraerJson } from "@/lib/modelo";

describe("extraerJson", () => {
  it("devuelve el JSON tal cual cuando ya es JSON puro", () => {
    expect(extraerJson('{"a":1}')).toBe('{"a":1}');
  });

  it("extrae el JSON de un bloque de código ```json", () => {
    const texto = 'Aquí va:\n```json\n{"veredicto_corto":"ok"}\n```\n';
    expect(extraerJson(texto)).toBe('{"veredicto_corto":"ok"}');
  });

  it("extrae el JSON de un bloque de código sin lenguaje", () => {
    expect(extraerJson("```\n{\"a\":1}\n```")).toBe('{"a":1}');
  });

  it("recorta la prosa que rodea al objeto", () => {
    expect(extraerJson('Claro, este es el resultado: {"score": 42} espero que sirva')).toBe(
      '{"score": 42}',
    );
  });

  it("devuelve null cuando no hay ningún objeto JSON", () => {
    expect(extraerJson("no hay json aquí")).toBeNull();
  });

  it("devuelve null con entrada vacía o solo espacios", () => {
    expect(extraerJson("")).toBeNull();
    expect(extraerJson("   \n  ")).toBeNull();
  });
});
