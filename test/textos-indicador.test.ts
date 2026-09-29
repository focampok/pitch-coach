import { describe, expect, it } from "vitest";

import { diccionario } from "@/lib/diccionarios";
import {
  elegirMensajeAsintiendo,
  MENSAJES_ASINTIENDO,
  textoIndicadorCoach,
} from "@/lib/mensajes-coach";
import { IDIOMAS } from "@/types/idioma";

// El indicador de estado es lo único que el usuario ve del coach (alcance §5.1).
// Los dos flujos — pitch y "Resolver hallazgos" (SparringCoach) — montan el
// mismo GrabadorVoz, así que el mapeo estado → texto se prueba una vez por
// idioma.

describe("indicador de estado del coach", () => {
  it("cada estado devuelve el texto del idioma de la sesión", () => {
    const esperado = {
      es: { grabando: "Escuchando…", transcribiendo: "Transcribiendo…" },
      en: { grabando: "Listening…", transcribiendo: "Transcribing…" },
    } as const;

    for (const idioma of IDIOMAS) {
      const textos = diccionario(idioma);
      expect(textoIndicadorCoach("grabando", null, textos)).toBe(esperado[idioma].grabando);
      expect(textoIndicadorCoach("transcribiendo", null, textos)).toBe(
        esperado[idioma].transcribiendo,
      );
    }
  });

  it("inactivo no muestra nada", () => {
    for (const idioma of IDIOMAS) {
      expect(textoIndicadorCoach("inactivo", "lo que sea", diccionario(idioma))).toBeNull();
    }
  });

  it("al finalizar muestra la frase de asintiendo ya elegida, sin traducirla", () => {
    for (const idioma of IDIOMAS) {
      for (const frase of MENSAJES_ASINTIENDO[idioma]) {
        expect(textoIndicadorCoach("finalizado", frase, diccionario(idioma))).toBe(frase);
      }
    }
  });

  it("los textos del indicador cambian con el idioma", () => {
    for (const estado of ["grabando", "transcribiendo"] as const) {
      expect(textoIndicadorCoach(estado, null, diccionario("es"))).not.toBe(
        textoIndicadorCoach(estado, null, diccionario("en")),
      );
    }
  });
});

describe("selección aleatoria de la frase final", () => {
  it("las tres frases de cada idioma son alcanzables", () => {
    for (const idioma of IDIOMAS) {
      const elegidas = [0, 0.34, 0.99].map((valor) =>
        elegirMensajeAsintiendo(idioma, () => valor),
      );
      expect(new Set(elegidas)).toEqual(new Set(MENSAJES_ASINTIENDO[idioma]));
    }
  });

  it("siempre devuelve una frase del idioma pedido", () => {
    for (const idioma of IDIOMAS) {
      for (const valor of [0, 0.5, 0.999]) {
        expect(MENSAJES_ASINTIENDO[idioma]).toContain(elegirMensajeAsintiendo(idioma, () => valor));
      }
    }
  });
});
