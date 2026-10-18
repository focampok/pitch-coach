import { describe, expect, it } from "vitest";

import { DICCIONARIOS, diccionario, type Diccionario } from "@/lib/diccionarios";
import { IDIOMAS } from "@/types/idioma";

/**
 * Forma completa de un diccionario: una entrada por hoja, con su tipo.
 *
 * Comparar esto entre idiomas verifica lo que el compilador ya exige (mismas
 * claves, mismos tipos) y además la ARIDAD de las funciones: si alguien
 * reescribe `minutos(cantidad)` como `minutos()` en un idioma, la forma cambia.
 */
function forma(valor: unknown, prefijo = ""): Record<string, string> {
  if (typeof valor === "function") {
    return { [prefijo]: `funcion/${valor.length}` };
  }
  if (valor !== null && typeof valor === "object") {
    const salida: Record<string, string> = {};
    for (const [clave, hijo] of Object.entries(valor)) {
      Object.assign(salida, forma(hijo, prefijo === "" ? clave : `${prefijo}.${clave}`));
    }
    return salida;
  }
  return { [prefijo]: typeof valor };
}

/** Todas las hojas string, con su ruta, para revisar que ninguna esté vacía. */
function hojasString(valor: unknown, prefijo = ""): [string, string][] {
  if (typeof valor === "string") return [[prefijo, valor]];
  if (valor !== null && typeof valor === "object") {
    return Object.entries(valor).flatMap(([clave, hijo]) =>
      hojasString(hijo, prefijo === "" ? clave : `${prefijo}.${clave}`),
    );
  }
  return [];
}

const BASE: Diccionario = diccionario("es");

describe("paridad entre diccionarios", () => {
  it("hay exactamente un diccionario por idioma soportado", () => {
    expect(Object.keys(DICCIONARIOS).sort()).toEqual([...IDIOMAS].sort());
  });

  it("el español es la fuente de verdad de la forma", () => {
    expect(diccionario("es")).toBe(DICCIONARIOS.es);
    expect(diccionario("en")).toBe(DICCIONARIOS.en);
  });

  it("todos los idiomas tienen EXACTAMENTE las mismas claves y tipos", () => {
    const referencia = forma(BASE);

    for (const idioma of IDIOMAS) {
      const actual = forma(diccionario(idioma));
      // Se comparan las dos direcciones: falta una clave o sobra una.
      expect(actual, `forma del diccionario "${idioma}"`).toEqual(referencia);
    }
  });

  it("ninguna clave se quedó sin traducir (misma ruta, distinto texto)", () => {
    // Casos legítimos: son palabras iguales en los dos idiomas.
    const IGUALES_A_PROPOSITO = new Set([
      // El nombre del producto no se traduce.
      "meta.titulo",
      "comun.tipoPitch.capital",
      "progreso.ultra",
      "dashboard.analisisUltra",
      // Nombres de proveedor: marcas, no se traducen.
      "dashboard.proveedorModelo.nebius",
      "dashboard.proveedorModelo.gemini",
    ]);

    const enIngles = new Map(hojasString(DICCIONARIOS.en));

    for (const [ruta, textoEs] of hojasString(BASE)) {
      if (IGUALES_A_PROPOSITO.has(ruta)) continue;
      expect(enIngles.get(ruta), `clave "${ruta}" sin traducir`).not.toBe(textoEs);
    }
  });

  it("el aviso de la demo pausada queda en los dos idiomas", () => {
    expect(diccionario("es").evaluacion.demoPausada).toBe(
      "La demo en vivo está pausada a propósito para cuidar los créditos compartidos. Estará disponible del 1 al 15 de diciembre para la evaluación. Mientras tanto, mira el video de demo.",
    );
    expect(diccionario("en").evaluacion.demoPausada).toBe(
      "The live demo is paused on purpose to protect shared credits. It will be available December 1–15 for judging. In the meantime, watch the demo video.",
    );
    expect(diccionario("es").evaluacion.restantes(3, 10)).toBe("Te quedan 3 de 10 prácticas");
    expect(diccionario("en").evaluacion.restantes(3, 10)).toBe("3 of 10 practices left");
  });

  it("ningún texto visible quedó vacío", () => {
    for (const idioma of IDIOMAS) {
      for (const [ruta, texto] of hojasString(diccionario(idioma))) {
        expect(texto.trim(), `${idioma}: "${ruta}" vacío`).not.toBe("");
      }
    }
  });

  it("las funciones de plural devuelven singular y plural distintos", () => {
    for (const idioma of IDIOMAS) {
      const textos = diccionario(idioma);
      expect(textos.comun.minutos(1)).not.toBe(textos.comun.minutos(2));
      expect(textos.dashboard.muletillas(0)).toContain("0");
      expect(textos.sparring.oferta(1)).not.toBe(textos.sparring.oferta(2));
    }
  });
});
