import { describe, expect, it } from "vitest";

import { MENSAJES_ASINTIENDO, MENSAJES_COACH } from "@/lib/reacciones";

// Solo las tres frases que GrabadorVoz muestra al terminar la transcripción.
// El motor (estremecido / sorprendido / mirandoReloj) está apagado y no se prueba.

describe("frases de asintiendo por idioma", () => {
  it("español conserva las tres frases que ya se mostraban", () => {
    expect(MENSAJES_ASINTIENDO.es).toEqual([
      "Escuché tu pitch completo.",
      "¡Bien, terminaste!",
      "Ahora te doy mi veredicto.",
    ]);
    expect(MENSAJES_COACH.asintiendo).toEqual(MENSAJES_ASINTIENDO.es);
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
