import { describe, expect, it } from "vitest";
import { normalizarNumerosEnPalabras } from "@/lib/numeros-en-palabras";
import { cifraEstaDicha, validarCifrasExtraidas } from "@/lib/cifras-dichas";

// Scribe dicta los números en palabras. El contraste de "cifras que dijiste"
// compara dígitos, así que la copia que va al extractor se normaliza antes.

describe("normalizarNumerosEnPalabras — inglés", () => {
  it("convierte los dos casos reales del QA", () => {
    expect(
      normalizarNumerosEnPalabras("We already have four hundred and twenty paying users.", "en"),
    ).toBe("We already have 420 paying users.");
    expect(
      normalizarNumerosEnPalabras("We are raising five hundred thousand dollars.", "en"),
    ).toBe("We are raising 500000 dollars.");
  });

  it("compone millones, miles, guiones y decimales", () => {
    expect(normalizarNumerosEnPalabras("two million five hundred thousand", "en")).toBe("2500000");
    expect(normalizarNumerosEnPalabras("twenty-five percent of SMEs", "en")).toBe("25 percent of SMEs");
    expect(normalizarNumerosEnPalabras("two point five million", "en")).toBe("2500000");
    expect(normalizarNumerosEnPalabras("a hundred thousand customers", "en")).toBe("100000 customers");
    expect(normalizarNumerosEnPalabras("$1.5 million and 500 thousand", "en")).toBe("$1500000 and 500000");
  });

  it("respeta lo que no es una cifra", () => {
    // Escalas sueltas, artículos y años dichos de a dos no se suman.
    expect(normalizarNumerosEnPalabras("millions of people want a product", "en")).toBe(
      "millions of people want a product",
    );
    expect(normalizarNumerosEnPalabras("hundreds of thousands", "en")).toBe("hundreds of thousands");
    expect(normalizarNumerosEnPalabras("in twenty twenty-four", "en")).toBe("in 20 24");
    expect(normalizarNumerosEnPalabras("No numbers here.", "en")).toBe("No numbers here.");
    expect(normalizarNumerosEnPalabras("", "en")).toBe("");
  });
});

describe("normalizarNumerosEnPalabras — español", () => {
  it("convierte los equivalentes de los casos del QA", () => {
    expect(normalizarNumerosEnPalabras("Ya tenemos cuatrocientos veinte clientes.", "es")).toBe(
      "Ya tenemos 420 clientes.",
    );
    expect(normalizarNumerosEnPalabras("Buscamos quinientos mil dólares.", "es")).toBe(
      "Buscamos 500000 dólares.",
    );
  });

  it("compone decenas con 'y', centenas, mil, millones y decimales", () => {
    expect(normalizarNumerosEnPalabras("treinta y cinco por ciento", "es")).toBe("35 por ciento");
    expect(normalizarNumerosEnPalabras("ciento veinte mil usuarios", "es")).toBe("120000 usuarios");
    expect(normalizarNumerosEnPalabras("un millón de pesos", "es")).toBe("1000000 de pesos");
    expect(normalizarNumerosEnPalabras("mil millones", "es")).toBe("1000000000");
    expect(normalizarNumerosEnPalabras("dos coma cinco millones", "es")).toBe("2500000");
    expect(normalizarNumerosEnPalabras("veintiún países", "es")).toBe("21 países");
    expect(normalizarNumerosEnPalabras("1.500 millones", "es")).toBe("1500000000");
  });

  it("no toca artículos ni 'por ciento'", () => {
    expect(normalizarNumerosEnPalabras("una empresa y un equipo", "es")).toBe("una empresa y un equipo");
    expect(normalizarNumerosEnPalabras("millones de personas", "es")).toBe("millones de personas");
  });
});

describe("cifras dichas en palabras", () => {
  it("una cifra en dígitos se reconoce como dicha sobre la transcripción normalizada", () => {
    const dicho = normalizarNumerosEnPalabras(
      "We have four hundred and twenty users and we are raising five hundred thousand dollars.",
      "en",
    );
    expect(cifraEstaDicha("420 users", dicho)).toBe(true);
    expect(cifraEstaDicha("$500,000", dicho)).toBe(true);
    expect(validarCifrasExtraidas({ cifras: ["500000 dollars"] }, dicho)).toEqual(["500000 dollars"]);
    // Sin normalizar, los dígitos no están y la cifra se descartaba.
    expect(
      cifraEstaDicha("420 users", "We have four hundred and twenty users."),
    ).toBe(false);
  });
});
