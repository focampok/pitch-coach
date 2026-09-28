import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Se intercepta el SDK: estos tests verifican QUÉ se manda a Sentry, no que el
// SDK funcione. Sin el mock, reportarFallo intentaría hablar con Sentry.
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import {
  ErrorElevenLabs,
  transcribirAudio,
  generarVerdictoHablado,
  resolveVoiceId,
} from "@/lib/elevenlabs";
import { reportarFallo } from "@/lib/sentry-reporte";

// El centinela imita el texto del veredicto: si el proveedor lo devuelve en el
// cuerpo de error, NO debe llegar a Sentry por ninguna vía.
const VEREDICTO = "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID_MALE",
  "ELEVENLABS_VOICE_ID_FEMALE",
  "ELEVENLABS_VOICE_ID_EN_MALE",
  "ELEVENLABS_VOICE_ID_EN_FEMALE",
  "ELEVENLABS_SCRIBE_MODEL",
  "SENTRY_ENABLED",
] as const;

let previo: Record<string, string | undefined> = {};

/** Respuesta de error de ElevenLabs, con el cuerpo del proveedor pegado. */
function respuesta402(): Response {
  return new Response(
    JSON.stringify({
      detail: {
        type: "payment_required",
        code: "paid_plan_required",
        message:
          "Free users cannot use library voices via the API. Please upgrade your subscription to use this voice.",
        // Simula un proveedor que hace eco de la petición.
        prompt: VEREDICTO,
      },
    }),
    { status: 402, headers: { "Content-Type": "application/json" } }
  );
}

beforeEach(() => {
  captureException.mockClear();
  previo = {};
  for (const clave of ENV_KEYS) previo[clave] = process.env[clave];

  process.env.ELEVENLABS_API_KEY = "sk_test";
  process.env.ELEVENLABS_VOICE_ID_MALE = "voz_hombre";
  process.env.ELEVENLABS_VOICE_ID_FEMALE = "voz_mujer";
  process.env.ELEVENLABS_VOICE_ID_EN_MALE = "voz_hombre_en";
  process.env.ELEVENLABS_VOICE_ID_EN_FEMALE = "voz_mujer_en";
  delete process.env.SENTRY_ENABLED;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
});

describe("ErrorElevenLabs", () => {
  it("conserva el código HTTP como propiedad", () => {
    const error = new ErrorElevenLabs("detalle", 402);
    expect(error.codigoHttp).toBe(402);
    expect(error.name).toBe("ErrorElevenLabs");
    expect(error).toBeInstanceOf(Error);
  });

  it("omite codigoHttp cuando no hay status (fallo de red)", () => {
    expect(new ErrorElevenLabs("sin red").codigoHttp).toBeUndefined();
  });
});

describe("generarVerdictoHablado", () => {
  it("lanza ErrorElevenLabs con el status cuando el proveedor responde error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta402()));

    const error = await generarVerdictoHablado(VEREDICTO, "male").catch((e) => e);

    expect(error).toBeInstanceOf(ErrorElevenLabs);
    expect(error.codigoHttp).toBe(402);
    // El detalle sigue disponible para los logs de consola.
    expect(error.message).toContain("402");
    expect(error.message).toContain("paid_plan_required");
  });

  it("devuelve el audio y el género resuelto cuando el proveedor responde 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    );

    const { audio, voiceGender } = await generarVerdictoHablado("Hola", "female");

    expect(audio.byteLength).toBe(3);
    expect(voiceGender).toBe("female");
  });
});

describe("selección de voz por idioma", () => {
  const esperado = {
    es: { male: "voz_hombre", female: "voz_mujer" },
    en: { male: "voz_hombre_en", female: "voz_mujer_en" },
  } as const;

  for (const idioma of ["es", "en"] as const) {
    for (const voz of ["male", "female"] as const) {
      it(`${idioma} / ${voz} usa el par de ese idioma y conserva el género`, async () => {
        expect(resolveVoiceId(voz, idioma)).toEqual({
          voiceId: esperado[idioma][voz],
          gender: voz,
        });

        const fetchMock = vi.fn(
          async () => new Response(new Uint8Array([1]), { status: 200 }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const { voiceGender } = await generarVerdictoHablado("texto", voz, undefined, idioma);
        const url = (fetchMock.mock.calls as unknown as [string][])[0][0];

        expect(voiceGender).toBe(voz);
        expect(url).toBe(
          `https://api.elevenlabs.io/v1/text-to-speech/${esperado[idioma][voz]}`,
        );
      });
    }
  }

  it("sin idioma usa el par en español", () => {
    expect(resolveVoiceId("female").voiceId).toBe("voz_mujer");
  });

  it("en inglés falla si falta el par EN, sin caer al par en español", () => {
    delete process.env.ELEVENLABS_VOICE_ID_EN_MALE;
    delete process.env.ELEVENLABS_VOICE_ID_EN_FEMALE;
    expect(() => resolveVoiceId("male", "en")).toThrow(/ELEVENLABS_VOICE_ID_EN_/);
  });
});

describe("transcribirAudio", () => {
  it("lanza ErrorElevenLabs con el status del STT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta402()));

    const error = await transcribirAudio(new Blob(["audio"])).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorElevenLabs);
    expect(error.codigoHttp).toBe(402);
  });

  it("manda language_code de la sesión y no toca el model_id", async () => {
    process.env.ELEVENLABS_SCRIBE_MODEL = "scribe_v2_custom";
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await transcribirAudio(new Blob(["audio"]), undefined, "en");
    const form = (fetchMock.mock.calls as unknown as [string, { body: FormData }][])[0][1]
      .body;

    expect(form.get("language_code")).toBe("en");
    expect(form.get("model_id")).toBe("scribe_v2_custom");
    expect(form.has("no_verbatim")).toBe(false);
  });
});

describe("reporte a Sentry del fallo de ElevenLabs", () => {
  it("el título lleva el status: deja de ser un `Error` opaco", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta402()));
    const error = await generarVerdictoHablado(VEREDICTO, "male").catch((e) => e);

    reportarFallo(error, { proveedor: "elevenlabs" }, { proveedor: "elevenlabs" });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [enviado] = captureException.mock.calls[0] as [Error];
    // Lo que hacía indiagnosticable PITCH-COACH-6: sin esto, solo "Error".
    expect(enviado.message).toBe("ErrorElevenLabs · proveedor=elevenlabs · HTTP 402");
  });

  it("el cuerpo del proveedor no llega al SDK por ninguna vía", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta402()));
    const error = await generarVerdictoHablado(VEREDICTO, "male").catch((e) => e);

    reportarFallo(error, { proveedor: "elevenlabs" }, { proveedor: "elevenlabs" });

    const enviado = JSON.stringify(captureException.mock.calls);
    expect(enviado).not.toContain(VEREDICTO);
    expect(enviado).not.toContain("paid_plan_required");
    const [evento] = captureException.mock.calls[0] as [Error];
    expect(String(evento.stack)).not.toContain(VEREDICTO);
  });
});
