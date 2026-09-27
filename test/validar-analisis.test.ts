import { describe, expect, it } from "vitest";

import type { PuntoRubrica } from "@/lib/rubricas";
import {
  CLARIDAD_MAXIMA,
  ErrorValidacion,
  calcularScore,
  construirEsquemaAnalisisRestringido,
  validarAnalisis,
} from "@/lib/validar-analisis";

const RUBRICA: readonly PuntoRubrica[] = [
  { punto: "Problema", queBuscar: "describe un problema real" },
  { punto: "Solución", queBuscar: "explica cómo lo resuelve" },
  { punto: "Mercado", queBuscar: "menciona el tamaño de mercado" },
  { punto: "Tracción", queBuscar: "muestra métricas de avance" },
];

describe("calcularScore", () => {
  it("devuelve 0 sin puntos cumplidos ni claridad", () => {
    expect(calcularScore(0, 4, 0)).toBe(0);
  });

  it("devuelve 100 con todo cumplido y claridad máxima", () => {
    expect(calcularScore(4, 4, CLARIDAD_MAXIMA)).toBe(100);
  });

  it("reparte 80 puntos de cobertura de forma proporcional", () => {
    // 2 de 4 puntos => 40; + claridad 10 => 50.
    expect(calcularScore(2, 4, 10)).toBe(50);
  });

  it("acota la claridad al rango 0-20", () => {
    expect(calcularScore(0, 4, 999)).toBe(20);
    expect(calcularScore(4, 4, 100)).toBe(100);
    expect(calcularScore(0, 4, -50)).toBe(0);
  });

  it("nunca supera 100 aunque la aritmética diera más", () => {
    expect(calcularScore(4, 4, 20)).toBe(100);
  });

  it("devuelve 0 si no hay puntos en la rúbrica", () => {
    expect(calcularScore(0, 0, 15)).toBe(0);
  });
});

describe("validarAnalisis", () => {
  const respuestaValida = {
    veredicto_corto: "Buen arranque, cierra con más datos.",
    claridad: 15,
    rubrica: [
      { cumplido: true, comentario: "Bien planteado." },
      { cumplido: true, comentario: "Clara." },
      { cumplido: false, comentario: "Falta la cifra de mercado." },
      { cumplido: false, comentario: "Sin métricas." },
    ],
  };

  it("asigna los nombres de punto desde la rúbrica por índice (no del modelo)", () => {
    const resultado = validarAnalisis(respuestaValida, RUBRICA);
    expect(resultado.rubrica.map((r) => r.punto)).toEqual([
      "Problema",
      "Solución",
      "Mercado",
      "Tracción",
    ]);
  });

  it("calcula el score de forma determinista", () => {
    // 2 de 4 => 40; + claridad 15 => 55.
    const resultado = validarAnalisis(respuestaValida, RUBRICA);
    expect(resultado.score).toBe(55);
  });

  it("lanza ErrorValidacion si el número de ítems no coincide con la rúbrica", () => {
    const incompleta = {
      ...respuestaValida,
      rubrica: respuestaValida.rubrica.slice(0, 3),
    };
    expect(() => validarAnalisis(incompleta, RUBRICA)).toThrow(ErrorValidacion);
  });

  it("lanza ErrorValidacion si 'cumplido' no es booleano", () => {
    const invalida = {
      ...respuestaValida,
      rubrica: [{ cumplido: "sí", comentario: "x" }, ...respuestaValida.rubrica.slice(1)],
    };
    expect(() => validarAnalisis(invalida, RUBRICA)).toThrow(ErrorValidacion);
  });

  it("lanza ErrorValidacion si 'claridad' no es numérica", () => {
    const invalida = { ...respuestaValida, claridad: "mucha" };
    expect(() => validarAnalisis(invalida, RUBRICA)).toThrow(ErrorValidacion);
  });

  it("lanza ErrorValidacion si el veredicto viene vacío", () => {
    const invalida = { ...respuestaValida, veredicto_corto: "   " };
    expect(() => validarAnalisis(invalida, RUBRICA)).toThrow(ErrorValidacion);
  });

  it("lanza ErrorValidacion si la respuesta no es un objeto", () => {
    expect(() => validarAnalisis(null, RUBRICA)).toThrow(ErrorValidacion);
    expect(() => validarAnalisis("texto", RUBRICA)).toThrow(ErrorValidacion);
  });

  it("tolera que falte el comentario y lo deja vacío", () => {
    const sinComentario = {
      ...respuestaValida,
      rubrica: respuestaValida.rubrica.map(({ cumplido }) => ({ cumplido })),
    };
    const resultado = validarAnalisis(sinComentario, RUBRICA);
    expect(resultado.rubrica.every((r) => r.comentario === "")).toBe(true);
  });

  it("ignora campos extra del modelo (ej. 'punto') en vez de rechazarlos", () => {
    // El modelo puede alucinar el nombre del punto o agregar claves de más: eso
    // NO invalida la respuesta. El servidor asigna el nombre por índice.
    const conExtra = {
      ...respuestaValida,
      rubrica: respuestaValida.rubrica.map((item, i) => ({
        punto: `nombre inventado ${i}`,
        score: 99,
        cumplido: item.cumplido,
        comentario: item.comentario,
      })),
    };
    const resultado = validarAnalisis(conExtra, RUBRICA);
    expect(resultado.rubrica.map((r) => r.punto)).toEqual([
      "Problema",
      "Solución",
      "Mercado",
      "Tracción",
    ]);
    expect(resultado.rubrica.every((r) => !("score" in r))).toBe(true);
  });

  it("incluye traza cuando viene un array de strings y exige si se pide", () => {
    const conTraza = {
      ...respuestaValida,
      traza: [
        "Busqué cifra de mercado: no hay número.",
        "El problema sí está nombrado.",
        "  ",
        "Sin métricas de tracción.",
      ],
    };
    const resultado = validarAnalisis(conTraza, RUBRICA);
    expect(resultado.traza).toEqual([
      "Busqué cifra de mercado: no hay número.",
      "El problema sí está nombrado.",
      "Sin métricas de tracción.",
    ]);
    expect(() => validarAnalisis(respuestaValida, RUBRICA, { exigirTraza: true })).toThrow(
      ErrorValidacion,
    );
  });

  it("lanza ErrorValidacion si se exige traza y viene un tipo inválido", () => {
    expect(() =>
      validarAnalisis({ ...respuestaValida, traza: "paso único" }, RUBRICA, {
        exigirTraza: true,
      }),
    ).toThrow(ErrorValidacion);
  });
});

describe("construirEsquemaAnalisisRestringido", () => {
  const puntos = ["Problema", "Solución"];

  it("en modo base no incluye traza", () => {
    const esquema = construirEsquemaAnalisisRestringido(puntos) as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(esquema.required).toEqual(["veredicto_corto", "claridad", "rubrica"]);
    expect(esquema.properties).not.toHaveProperty("traza");
  });

  it("con incluirTraza exige traza de 4 a 8 pasos", () => {
    const esquema = construirEsquemaAnalisisRestringido(puntos, {
      incluirTraza: true,
    }) as {
      required: string[];
      properties: { traza: { minItems?: number; maxItems?: number } };
    };
    expect(esquema.required).toEqual(["veredicto_corto", "claridad", "rubrica", "traza"]);
    expect(esquema.properties.traza.minItems).toBe(4);
    expect(esquema.properties.traza.maxItems).toBe(8);
  });
});
