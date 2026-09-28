import { describe, expect, it } from "vitest";

import {
  RUBRICAS,
  esIdDePunto,
  etiquetaPunto,
  idDePunto,
  obtenerPuntoPorId,
  obtenerRubrica,
  tiposPitch,
} from "@/lib/rubricas";
import { IDIOMAS } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";

/**
 * Los ids son un CONTRATO: viajan por la API y quedan guardados en el historial
 * de los usuarios. Renombrar uno rompe datos ya persistidos, así que este
 * snapshot existe para que el cambio sea deliberado y visible en el diff.
 */
const IDS_ESPERADOS: Record<TipoPitch, string[]> = {
  capital: ["problema", "mercado", "solucion", "traccion", "ask"],
  educacion: [
    "objetivo",
    "estructura",
    "ejemplo",
    "conocimiento-previo",
    "llamado-accion",
  ],
  innovacion: ["problema-oportunidad", "diferenciador", "validacion", "impacto", "proximos-pasos"],
  tecnologia: ["problema-tecnico", "funcionamiento", "diferenciador-tecnico", "estado", "stack"],
};

describe("paridad de rúbricas", () => {
  it("cubre exactamente los cuatro tipos de pitch", () => {
    expect(Object.keys(RUBRICAS).sort()).toEqual([...tiposPitch()].sort());
  });

  it("cada tipo tiene 5 puntos y los ids no cambiaron", () => {
    for (const tipo of tiposPitch()) {
      const puntos = obtenerRubrica(tipo);
      expect(puntos, `rúbrica de "${tipo}"`).toHaveLength(5);
      expect(puntos.map((punto) => punto.id)).toEqual(IDS_ESPERADOS[tipo]);
    }
  });

  it("los ids no se repiten dentro de un tipo", () => {
    for (const tipo of tiposPitch()) {
      const ids = obtenerRubrica(tipo).map((punto) => punto.id);
      expect(new Set(ids).size, `ids duplicados en "${tipo}"`).toBe(ids.length);
    }
  });

  it("cada punto está completo en TODOS los idiomas", () => {
    for (const tipo of tiposPitch()) {
      for (const punto of obtenerRubrica(tipo)) {
        for (const idioma of IDIOMAS) {
          expect(punto.nombre[idioma]?.trim(), `${tipo}/${punto.id}: nombre ${idioma}`).toBeTruthy();
          expect(
            punto.queBuscar[idioma]?.trim(),
            `${tipo}/${punto.id}: queBuscar ${idioma}`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("el nombre visible es distinto en cada idioma", () => {
    for (const tipo of tiposPitch()) {
      for (const punto of obtenerRubrica(tipo)) {
        expect(punto.nombre.en, `${tipo}/${punto.id}`).not.toBe(punto.nombre.es);
      }
    }
  });

  it("obtenerPuntoPorId encuentra cada punto por su id", () => {
    for (const tipo of tiposPitch()) {
      for (const punto of obtenerRubrica(tipo)) {
        expect(obtenerPuntoPorId(tipo, punto.id)).toBe(punto);
      }
    }
  });

  it("un id de otro tipo no resuelve", () => {
    expect(obtenerPuntoPorId("capital", "objetivo")).toBeUndefined();
    expect(esIdDePunto("objetivo", "capital")).toBe(false);
  });
});

describe("idDePunto (compatibilidad con el historial viejo)", () => {
  it("traduce el nombre en español de una entrada vieja a su id", () => {
    expect(idDePunto("capital", "Problema claro")).toBe("problema");
    expect(idDePunto("capital", "Tamaño del mercado / oportunidad")).toBe("mercado");
    expect(idDePunto("capital", "El ask")).toBe("ask");
    expect(idDePunto("educacion", "Conexión con conocimiento previo")).toBe("conocimiento-previo");
  });

  it("deja un id como está (es idempotente)", () => {
    for (const tipo of tiposPitch()) {
      for (const punto of obtenerRubrica(tipo)) {
        expect(idDePunto(tipo, punto.id)).toBe(punto.id);
        expect(idDePunto(tipo, idDePunto(tipo, punto.id))).toBe(punto.id);
      }
    }
  });

  it("NO traduce el nombre en inglés: no se inventa equivalencias entre idiomas", () => {
    expect(idDePunto("capital", "Clear problem")).toBe("Clear problem");
  });

  it("conserva tal cual un valor que no corresponde a ningún punto", () => {
    expect(idDePunto("capital", "Punto retirado")).toBe("Punto retirado");
    expect(idDePunto("capital", "")).toBe("");
  });
});

describe("etiquetaPunto", () => {
  it("devuelve el nombre visible del id en el idioma pedido", () => {
    expect(etiquetaPunto("problema", "es", "capital")).toBe("Problema claro");
    expect(etiquetaPunto("problema", "en", "capital")).toBe("Clear problem");
    expect(etiquetaPunto("ask", "en", "capital")).toBe("The ask");
  });

  it("devuelve el valor tal cual si no es un id de ese tipo", () => {
    // El caso real: una entrada vieja que no se pudo mapear.
    expect(etiquetaPunto("Punto retirado", "es", "capital")).toBe("Punto retirado");
    expect(etiquetaPunto("Punto retirado", "en", "capital")).toBe("Punto retirado");
    // Un id de otro tipo tampoco resuelve, para no etiquetar mal.
    expect(etiquetaPunto("objetivo", "es", "capital")).toBe("objetivo");
  });

  it("sin tipo de pitch, no intenta resolver", () => {
    expect(etiquetaPunto("problema", "es")).toBe("problema");
  });
});
