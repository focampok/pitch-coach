import { describe, expect, it } from "vitest";

import { MENSAJES_ASINTIENDO } from "@/lib/mensajes-coach";

// Solo las tres frases que GrabadorVoz muestra al terminar la transcripción.
// El avatar y su motor de reacciones se eliminaron; ver textos-indicador.test.ts.

describe("frases de asintiendo por idioma", () => {
  it("español conserva las tres frases que ya se mostraban", () => {
    expect(MENSAJES_ASINTIENDO.es).toEqual([
      "Escuché tu pitch completo.",
      "¡Bien, terminaste!",
      "Ahora te doy mi veredicto.",
    ]);
  });

  it("inglés tiene exactamente tres frases, distintas de las españolas", () => {
    expect(MENSAJES_ASINTIENDO.en).toEqual([
      "I heard your whole pitch.",
      "Nice, you finished!",
      "Now I'll give you my verdict.",
    ]);
    expect(new Set(MENSAJES_ASINTIENDO.en).size).toBe(3);
    for (const frase of MENSAJES_ASINTIENDO.en) {
      expect(MENSAJES_ASINTIENDO.es).not.toContain(frase);
    }
  });
});
