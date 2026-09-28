import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { POST } from "@/app/api/tts/route";
import { reiniciar } from "@/lib/rate-limit";

// /api/tts tipa NextRequest. En runtime un Request común alcanza.
const comoNextRequest = (req: Request) => req as unknown as NextRequest;

const IDS = {
  es: { male: "es-male", female: "es-female" },
  en: { male: "en-male", female: "en-female" },
} as const;

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID_MALE",
  "ELEVENLABS_VOICE_ID_FEMALE",
  "ELEVENLABS_VOICE_ID_EN_MALE",
  "ELEVENLABS_VOICE_ID_EN_FEMALE",
] as const;

let previo: Record<string, string | undefined> = {};

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
  }
  process.env.ELEVENLABS_API_KEY = "sk_test";
  process.env.ELEVENLABS_VOICE_ID_MALE = IDS.es.male;
  process.env.ELEVENLABS_VOICE_ID_FEMALE = IDS.es.female;
  process.env.ELEVENLABS_VOICE_ID_EN_MALE = IDS.en.male;
  process.env.ELEVENLABS_VOICE_ID_EN_FEMALE = IDS.en.female;
  reiniciar();
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  vi.unstubAllGlobals();
});

function peticion(body: unknown, ip: string): NextRequest {
  return comoNextRequest(
    new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/tts — voz por idioma", () => {
  for (const idioma of ["es", "en"] as const) {
    for (const voz of ["male", "female"] as const) {
      it(`${idioma} / ${voz} llama al voice id de ese par y devuelve el género`, async () => {
        const fetchMock = vi.fn(
          async () =>
            new Response(new Uint8Array([7]), {
              status: 200,
              headers: { "Content-Type": "audio/mpeg" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const res = await POST(peticion({ texto: "verdict", voz, idioma }, `${idioma}-${voz}`));

        expect(res.status).toBe(200);
        expect(res.headers.get("X-Voice-Gender")).toBe(voz);
        const url = (fetchMock.mock.calls as unknown as [string][])[0][0];
        expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${IDS[idioma][voz]}`);
      });
    }
  }

  it("sin idioma usa el par en español y conserva el género pedido", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array([7]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(peticion({ texto: "veredicto", voz: "female" }, "sin-idioma"));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Voice-Gender")).toBe("female");
    const url = (fetchMock.mock.calls as unknown as [string][])[0][0];
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${IDS.es.female}`);
  });
});
