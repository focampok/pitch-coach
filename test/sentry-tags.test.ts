import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Se intercepta el SDK para poder inspeccionar los tags que efectivamente
// viajan en cada evento. Sin el mock, los eventos se perderían en el vacío.
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import { POST as postAnalizar } from "@/app/api/analizar-pitch/route";
import { POST as postPregunta } from "@/app/api/sparring/pregunta/route";
import { POST as postEvaluar } from "@/app/api/sparring/evaluar/route";
import { POST as postTts } from "@/app/api/tts/route";
import { POST as postTranscribir } from "@/app/api/transcribir/route";
import { POST as postEnriquecer } from "@/app/api/enriquecer/route";
import { reiniciar } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const ENV_KEYS = [
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "MODEL_RETRY_ATTEMPTS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID_MALE",
  "ELEVENLABS_VOICE_ID_FEMALE",
  "TAVILY_API_KEY",
  "SENTRY_ENABLED",
];

let previo: Record<string, string | undefined> = {};

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.MODEL_PROVIDER = "nebius";
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.MODEL_RETRY_ATTEMPTS = "1";
  captureException.mockClear();
  reiniciar();
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function peticion(ruta: string, body: unknown, ip: string): Request {
  return new Request(`http://localhost${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/**
 * /api/tts y /api/enriquecer tipan NextRequest. En runtime un Request común
 * alcanza: esas rutas solo usan .json() y las cabeceras.
 */
const comoNextRequest = (req: Request) => req as unknown as NextRequest;

/** Tags del último evento capturado. */
function ultimosTags(): Record<string, string> {
  const llamada = captureException.mock.calls.at(-1) as
    | [unknown, { tags: Record<string, string> }]
    | undefined;
  return llamada?.[1].tags ?? {};
}

/** Fuerza el fallo del proveedor de modelo. */
function proveedorCaido() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red caída")));
}

describe("tags operativos en eventos de servidor", () => {
  it("analizar-pitch etiqueta proveedor y nivel reales", async () => {
    proveedorCaido();

    const res = await postAnalizar(
      peticion(
        "/api/analizar-pitch",
        {
          transcripcion: "Tenemos un problema real.",
          tipoPitch: "capital",
          duracionMaxima: 3,
          tiempoRealSegundos: 45,
          nivel: "ultra",
        },
        "10.0.0.1"
      )
    );

    expect(res.status).toBe(502);
    expect(ultimosTags()).toEqual({ proveedor: "nebius", nivel: "ultra" });
  });

  it("analizar-pitch cae a nivel 'estandar' cuando no se especifica", async () => {
    proveedorCaido();

    await postAnalizar(
      peticion(
        "/api/analizar-pitch",
        {
          transcripcion: "Tenemos un problema real.",
          tipoPitch: "capital",
          duracionMaxima: 3,
          tiempoRealSegundos: 45,
        },
        "10.0.0.2"
      )
    );

    expect(ultimosTags().nivel).toBe("estandar");
  });

  it("el tag proveedor sigue a MODEL_PROVIDER", async () => {
    process.env.MODEL_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    proveedorCaido();

    await postAnalizar(
      peticion(
        "/api/analizar-pitch",
        {
          transcripcion: "Tenemos un problema real.",
          tipoPitch: "capital",
          duracionMaxima: 3,
          tiempoRealSegundos: 45,
        },
        "10.0.0.3"
      )
    );

    expect(ultimosTags().proveedor).toBe("gemini");
  });

  it("sparring/pregunta etiqueta proveedor y nivel rapido", async () => {
    proveedorCaido();

    const res = await postPregunta(
      peticion(
        "/api/sparring/pregunta",
        { tipoPitch: "capital", punto: "problema" },
        "10.0.0.4"
      )
    );

    expect(res.status).toBe(502);
    expect(ultimosTags()).toEqual({ proveedor: "nebius", nivel: "rapido" });
  });

  it("sparring/evaluar etiqueta proveedor y nivel rapido", async () => {
    proveedorCaido();

    const res = await postEvaluar(
      peticion(
        "/api/sparring/evaluar",
        {
          tipoPitch: "capital",
          punto: "problema",
          pregunta: "¿Cuál es el problema?",
          respuesta: "No lo tengo claro.",
        },
        "10.0.0.5"
      )
    );

    expect(res.status).toBe(502);
    expect(ultimosTags()).toEqual({ proveedor: "nebius", nivel: "rapido" });
  });

  it("tts etiqueta a ElevenLabs como proveedor", async () => {
    // Sin ELEVENLABS_API_KEY la ruta falla y cae al catch.
    const res = await postTts(
      comoNextRequest(peticion("/api/tts", { texto: "Buen pitch." }, "10.0.0.6"))
    );

    expect(res.status).toBe(502);
    expect(ultimosTags()).toEqual({ proveedor: "elevenlabs" });
  });

  it("transcribir etiqueta a ElevenLabs como proveedor", async () => {
    const form = new FormData();
    form.append("audio", new File(["clip"], "grabacion.webm", { type: "audio/webm" }));
    const res = await postTranscribir(
      new Request("http://localhost/api/transcribir", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.9" },
        body: form,
      }),
    );

    expect(res.status).toBe(502);
    expect(ultimosTags()).toEqual({ proveedor: "elevenlabs" });
  });

  it("enriquecer etiqueta a Tavily como proveedor", async () => {
    // OJO: un fallo de RED de Tavily NO llega a este catch. enriquecerConTavily
    // aísla cada punto con su propio try/catch (es "best effort" por diseño),
    // así que se traga el error y devuelve menos sugerencias. El reporte es
    // defensivo: cubre entradas malformadas como esta, no fallos del proveedor.
    process.env.TAVILY_API_KEY = "test-key";

    await postEnriquecer(
      comoNextRequest(
        peticion(
          "/api/enriquecer",
          { tema: "capital", puntosSinCumplir: "no-es-un-array" },
          "10.0.0.7"
        )
      )
    );

    expect(ultimosTags()).toEqual({ proveedor: "tavily" });
  });

  it("con SENTRY_ENABLED=false no se captura nada", async () => {
    process.env.SENTRY_ENABLED = "false";
    proveedorCaido();

    await postAnalizar(
      peticion(
        "/api/analizar-pitch",
        {
          transcripcion: "Tenemos un problema real.",
          tipoPitch: "capital",
          duracionMaxima: 3,
          tiempoRealSegundos: 45,
        },
        "10.0.0.8"
      )
    );

    expect(captureException).not.toHaveBeenCalled();
  });
});
