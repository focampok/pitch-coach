import { describe, expect, it } from "vitest";

import {
  ErrorValidacionSparring,
  construirEsquemaPreguntaSparringRestringido,
  construirEsquemaSparringRestringido,
  validarEvaluacionSparring,
  validarPreguntaSparring,
} from "@/lib/validar-sparring";

describe("construirEsquemaSparringRestringido", () => {
  it("exige solo cumplido y comentario, sin propiedades extra", () => {
    const esquema = construirEsquemaSparringRestringido("es") as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(Object.keys(esquema.properties).sort()).toEqual(["comentario", "cumplido"]);
    expect(esquema.required).toEqual(["cumplido", "comentario"]);
    expect(esquema.additionalProperties).toBe(false);
    expect(esquema).not.toHaveProperty("punto");
    expect(JSON.stringify(esquema)).not.toContain("enum");
  });
});

describe("construirEsquemaPreguntaSparringRestringido", () => {
  it("exige solo pregunta, sin propiedades extra", () => {
    const esquema = construirEsquemaPreguntaSparringRestringido("es") as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(Object.keys(esquema.properties)).toEqual(["pregunta"]);
    expect(esquema.required).toEqual(["pregunta"]);
    expect(esquema.additionalProperties).toBe(false);
  });
});

describe("validarPreguntaSparring", () => {
  it("acepta una pregunta no vacía", () => {
    expect(validarPreguntaSparring({ pregunta: "  ¿Cuál es el ask?  " })).toEqual({
      pregunta: "¿Cuál es el ask?",
    });
  });

  it("ignora campos extra", () => {
    expect(validarPreguntaSparring({ pregunta: "¿Y la tracción?", extra: 1 })).toEqual({
      pregunta: "¿Y la tracción?",
    });
  });

  it("lanza si la pregunta falta o está vacía", () => {
    expect(() => validarPreguntaSparring({})).toThrow(ErrorValidacionSparring);
    expect(() => validarPreguntaSparring({ pregunta: "   " })).toThrow(ErrorValidacionSparring);
    expect(() => validarPreguntaSparring(null)).toThrow(ErrorValidacionSparring);
  });
});

describe("validarEvaluacionSparring", () => {
  it("acepta un objeto con cumplido y comentario", () => {
    const resultado = validarEvaluacionSparring({
      cumplido: true,
      comentario: "Ahora sí cubriste el ask.",
    });
    expect(resultado).toEqual({
      cumplido: true,
      comentario: "Ahora sí cubriste el ask.",
    });
  });

  it("acepta cumplido false", () => {
    const resultado = validarEvaluacionSparring({
      cumplido: false,
      comentario: "Sigue faltando el monto.",
    });
    expect(resultado.cumplido).toBe(false);
  });

  it("tolera que falte el comentario y lo deja vacío", () => {
    const resultado = validarEvaluacionSparring({ cumplido: true });
    expect(resultado.comentario).toBe("");
  });

  it("ignora campos extra del modelo en vez de rechazarlos", () => {
    const resultado = validarEvaluacionSparring({
      cumplido: false,
      comentario: "Falta evidencia.",
      punto: "nombre inventado",
      score: 99,
    });
    expect(resultado).toEqual({
      cumplido: false,
      comentario: "Falta evidencia.",
    });
    expect(resultado).not.toHaveProperty("punto");
    expect(resultado).not.toHaveProperty("score");
  });

  it("lanza si 'cumplido' no es booleano", () => {
    expect(() =>
      validarEvaluacionSparring({ cumplido: "sí", comentario: "x" }),
    ).toThrow(ErrorValidacionSparring);
  });

  it("lanza si la respuesta no es un objeto", () => {
    expect(() => validarEvaluacionSparring(null)).toThrow(ErrorValidacionSparring);
    expect(() => validarEvaluacionSparring("texto")).toThrow(ErrorValidacionSparring);
    expect(() => validarEvaluacionSparring([{ cumplido: true }])).toThrow(
      ErrorValidacionSparring,
    );
  });
});
