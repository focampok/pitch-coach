import { describe, expect, it } from "vitest";
import { citaLaCifra, construirQueryCifra, magnitudAproximada, mismaMagnitud, validarCifrasExtraidas } from "@/lib/cifras-dichas";
import { cambiosDeCobertura, normalizarSesion } from "@/lib/historial-sesiones";
import { fragmentarPorOracion, fusionarAsignaciones } from "@/lib/linea-tiempo";
import { citaEstaEnContenido } from "@/lib/objecion-sala";
import { construirQuerySala } from "@/lib/salas";
import type { SesionGuardada } from "@/types/historial";

const SESION = {
  fecha: "2026-10-08T12:00:00.000Z",
  tipoPitch: "capital",
  idioma: "es",
  duracionMaxima: 3,
  score: 40,
  claridad: 8,
  rubrica: [
    { punto: "problema", cumplido: true },
    { punto: "mercado", cumplido: false },
    { punto: "solucion", cumplido: true },
    { punto: "traccion", cumplido: false },
    { punto: "ask", cumplido: false },
  ],
  muletillas: {},
  ultraUsado: false,
} satisfies SesionGuardada;

describe("sala y cifras", () => {
  it("la query de sala no lleva puntuación de oración", () => {
    const query = construirQuerySala({
      idioma: "es",
      sala: "inversion",
      puntoNombre: "El ask",
      entidades: ["salon de te."],
      tipoNombre: "Capital",
    });
    expect(query).not.toMatch(/[.?!]/);
    expect(query).toContain("pregunta de inversor");
    expect(query).toContain("salon de te");
  });

  it("una cita que no está en la página no se acepta", () => {
    expect(citaEstaEnContenido("¿cuánto capital necesitas?", "El comité pregunta: ¿cuánto capital necesitas?")).toBe(true);
    expect(citaEstaEnContenido("¿cuánto capital necesitas?", "Artículo sobre cómo calcular el TAM")).toBe(false);
  });

  it("descarta una cifra que el modelo inventó", () => {
    expect(validarCifrasExtraidas({ cifras: ["USD 2 millones", "99"] }, "pedimos USD 2 millones")).toEqual([
      "USD 2 millones",
    ]);
  });

  it("la query de una cifra dicha no es una oración del pitch", () => {
    const query = construirQueryCifra({
      idioma: "es",
      cifra: "USD 2 millones",
      entidades: ["salon de te"],
      tipoNombre: "Capital",
    });
    expect(query.startsWith("estadistica")).toBe(true);
    expect(query).not.toMatch(/[.?!]/);
  });

  it("compara el orden de magnitud y no el primer dígito suelto", () => {
    expect(magnitudAproximada("en 2024 el mercado fue de 2 millones")).toBe(2_000_000);
    expect(mismaMagnitud("2 millones", "USD 2.4 millones")).toBe(true);
    expect(mismaMagnitud("2 millones", "USD 2 mil millones")).toBe(false);
  });

  it("la segunda toma cita la cifra si los dígitos o el texto aparecen", () => {
    expect(citaLaCifra("2 millones", "el ask es de 2 millones")).toBe(true);
    expect(citaLaCifra("$2,400,000", "el ask es 2400000")).toBe(true);
    expect(citaLaCifra("$2,000,000", "busco dos millones")).toBe(false);
  });
});

describe("línea de tiempo", () => {
  it("agrupa oraciones con inicio y fin", () => {
    const fragmentos = fragmentarPorOracion([
      { text: "Hola", type: "word", start: 0, end: 0.4 },
      { text: " ", type: "spacing", start: 0.4, end: 0.45 },
      { text: "mundo.", type: "word", start: 0.5, end: 1.2 },
      { text: "Mercado", type: "word", start: 1.4, end: 2 },
      { text: " ", type: "spacing", start: 2, end: 2.1 },
      { text: "grande.", type: "word", start: 2.1, end: 3 },
    ]);
    expect(fragmentos).toHaveLength(2);
    expect(fragmentos[0]).toMatchObject({ inicio: 0, fin: 1.2 });
    expect(fragmentos[1]?.texto).toBe("Mercado grande.");
  });

  it("fusiona fragmentos seguidos del mismo punto y tira ids ajenos", () => {
    const fragmentos = [
      { indice: 0, inicio: 0, fin: 2, texto: "a" },
      { indice: 1, inicio: 2, fin: 4, texto: "b" },
      { indice: 2, inicio: 4, fin: 6, texto: "c" },
    ];
    const tramos = fusionarAsignaciones(
      fragmentos,
      [
        { indice: 0, punto: "problema" },
        { indice: 1, punto: "problema" },
        { indice: 2, punto: "inventado" },
      ],
      new Set(["problema"]),
    );
    expect(tramos).toEqual([{ punto: "problema", inicio: 0, fin: 4 }]);
  });

  it("sin marcas no hay fragmentos", () => {
    expect(fragmentarPorOracion([{ text: "hola", type: "word", start: null, end: null }])).toEqual([]);
  });
});

describe("delta de cobertura", () => {
  it("marca cerrado cuando la segunda toma cubre un punto que faltaba", () => {
    const previa = normalizarSesion(SESION);
    const actual = normalizarSesion({ ...SESION, fecha: "2026-10-08T13:00:00.000Z", puntosCerrados: ["mercado"] });
    expect(previa && actual && cambiosDeCobertura(actual, previa)).toEqual([
      { punto: "mercado", cambio: "cerrado" },
    ]);
  });

  it("ignora un id que no es de la rúbrica", () => {
    const sesion = normalizarSesion({ ...SESION, puntosCerrados: ["mercado", "no-existe"] });
    expect(sesion?.puntosCerrados).toEqual(["mercado"]);
  });

  it("una sesión vieja sin el campo sigue siendo válida", () => {
    const sesion = normalizarSesion(SESION);
    expect(sesion?.puntosCerrados).toBeUndefined();
  });
});
