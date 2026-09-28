import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { POST as POST_ANALIZAR } from "@/app/api/analizar-pitch/route";
import { POST as POST_ENRIQUECER } from "@/app/api/enriquecer/route";
import { POST as POST_EVALUAR } from "@/app/api/sparring/evaluar/route";
import { POST as POST_PREGUNTA } from "@/app/api/sparring/pregunta/route";
import { POST as POST_TRANSCRIBIR } from "@/app/api/transcribir/route";
import { POST as POST_TTS } from "@/app/api/tts/route";
import { diccionario } from "@/lib/diccionarios";
import { MAX_SOLICITUDES, reiniciar } from "@/lib/rate-limit";

// Contrato bilingüe de las rutas: `idioma` ('es' | 'en') gobierna TODOS los
// mensajes de error; ausente vale 'es'; cualquier otro valor es un 400.
//
// Ninguna llamada sale a la red: todos los casos cortan en la validación, antes
// de tocar al proveedor. El fetch queda mockeado como red de seguridad.
//
// /api/tts y /api/enriquecer tipan NextRequest. En runtime un Request común
// alcanza; el cast es solo para el compilador (mismo criterio que
// test/sentry-tags.test.ts).
const comoNextRequest = (req: Request) => req as unknown as NextRequest;

const ENV_KEYS = ["MODEL_PROVIDER", "NEBIUS_API_KEY", "ELEVENLABS_API_KEY", "TAVILY_API_KEY"];

let previo: Record<string, string | undefined> = {};
let consoleError: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.MODEL_PROVIDER = "nebius";
  process.env.NEBIUS_API_KEY = "test-key";
  reiniciar();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  consoleError.mockRestore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonPeticion(ruta: string, body: unknown, idiomaCabecera?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200) + 1}`,
  };
  if (idiomaCabecera) headers["x-idioma"] = idiomaCabecera;
  return new Request(`http://localhost${ruta}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function audioPeticion(campos: {
  audio?: File;
  idioma?: string;
  cabecera?: string;
}): Request {
  const form = new FormData();
  if (campos.audio) form.append("audio", campos.audio);
  if (campos.idioma) form.append("idioma", campos.idioma);
  const headers: Record<string, string> = {
    "x-forwarded-for": `10.1.0.${Math.floor(Math.random() * 200) + 1}`,
  };
  if (campos.cabecera) headers["x-idioma"] = campos.cabecera;
  return new Request("http://localhost/api/transcribir", {
    method: "POST",
    headers,
    body: form,
  });
}

function clipValido(): File {
  return new File(["clip"], "grabacion.webm", { type: "audio/webm" });
}

async function mensajeDe(res: Response): Promise<string> {
  const cuerpo = (await res.json()) as { error: string };
  return cuerpo.error;
}

describe("idioma inválido → 400, en el idioma de la cabecera", () => {
  // Un `idioma` inválido no se puede usar para responder: la respuesta sale en
  // el idioma de la cabecera X-Idioma, que el cliente siempre manda.
  type Caso = {
    nombre: string;
    ejecutar: (idioma: string, cabecera?: string) => Promise<Response>;
  };

  const casos: Caso[] = [
    {
      nombre: "/api/analizar-pitch",
      ejecutar: (idioma, cabecera) =>
        POST_ANALIZAR(
          jsonPeticion("/api/analizar-pitch", { transcripcion: "x", idioma }, cabecera),
        ),
    },
    {
      nombre: "/api/sparring/pregunta",
      ejecutar: (idioma, cabecera) =>
        POST_PREGUNTA(
          jsonPeticion(
            "/api/sparring/pregunta",
            { tipoPitch: "capital", punto: "ask", idioma },
            cabecera,
          ),
        ),
    },
    {
      nombre: "/api/sparring/evaluar",
      ejecutar: (idioma, cabecera) =>
        POST_EVALUAR(
          jsonPeticion(
            "/api/sparring/evaluar",
            { tipoPitch: "capital", punto: "ask", pregunta: "¿?", respuesta: "sí", idioma },
            cabecera,
          ),
        ),
    },
    {
      nombre: "/api/tts",
      ejecutar: (idioma, cabecera) =>
        POST_TTS(comoNextRequest(jsonPeticion("/api/tts", { texto: "hola", idioma }, cabecera))),
    },
    {
      nombre: "/api/enriquecer",
      ejecutar: (idioma, cabecera) =>
        POST_ENRIQUECER(
          comoNextRequest(jsonPeticion("/api/enriquecer", { tema: "capital", idioma }, cabecera)),
        ),
    },
    {
      nombre: "/api/transcribir",
      ejecutar: (idioma, cabecera) =>
        POST_TRANSCRIBIR(audioPeticion({ audio: clipValido(), idioma, cabecera })),
    },
  ];

  for (const caso of casos) {
    it(`${caso.nombre}: un idioma no soportado es un 400`, async () => {
      const res = await caso.ejecutar("fr");
      expect(res.status).toBe(400);
      expect(await mensajeDe(res)).toBe(diccionario("es").api.idiomaInvalido);
    });

    it(`${caso.nombre}: ese 400 sale en inglés si la cabecera pide inglés`, async () => {
      // El cuerpo no sirve para elegir idioma (es justo el campo inválido), así
      // que manda la cabecera X-Idioma.
      const res = await caso.ejecutar("fr", "en");
      expect(res.status).toBe(400);
      expect(await mensajeDe(res)).toBe(diccionario("en").api.idiomaInvalido);
    });
  }

  it("un idioma inválido no llega al proveedor", async () => {
    await POST_ANALIZAR(jsonPeticion("/api/analizar-pitch", { transcripcion: "x", idioma: "de" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("idioma ausente → español", () => {
  it("/api/analizar-pitch valida en español", async () => {
    const res = await POST_ANALIZAR(jsonPeticion("/api/analizar-pitch", { transcripcion: "" }));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.transcripcionObligatoria);
  });

  it("/api/tts valida en español", async () => {
    const res = await POST_TTS(comoNextRequest(jsonPeticion("/api/tts", {})));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.faltaTexto);
  });

  it("/api/transcribir valida en español", async () => {
    const res = await POST_TRANSCRIBIR(audioPeticion({}));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.faltaAudio);
  });

  it("/api/sparring/pregunta valida en español", async () => {
    const res = await POST_PREGUNTA(jsonPeticion("/api/sparring/pregunta", {}));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.tipoPitchInvalido);
  });
});

describe("idioma 'en' → los mensajes salen en inglés", () => {
  it("/api/analizar-pitch", async () => {
    const res = await POST_ANALIZAR(
      jsonPeticion("/api/analizar-pitch", { transcripcion: "", idioma: "en" }),
    );
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.transcripcionObligatoria);
  });

  it("/api/analizar-pitch: el 413 también", async () => {
    const res = await POST_ANALIZAR(
      jsonPeticion("/api/analizar-pitch", {
        transcripcion: "a".repeat(8001),
        tipoPitch: "capital",
        duracionMaxima: 3,
        tiempoRealSegundos: 30,
        idioma: "en",
      }),
    );
    expect(res.status).toBe(413);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.transcripcionLarga);
  });

  it("/api/sparring/pregunta: un punto fuera de la rúbrica", async () => {
    const res = await POST_PREGUNTA(
      jsonPeticion("/api/sparring/pregunta", {
        tipoPitch: "capital",
        punto: "inventado",
        idioma: "en",
      }),
    );
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.puntoFueraDeRubrica);
  });

  it("/api/sparring/evaluar: 413 de respuesta larga", async () => {
    const res = await POST_EVALUAR(
      jsonPeticion("/api/sparring/evaluar", {
        tipoPitch: "capital",
        punto: "ask",
        pregunta: "¿?",
        respuesta: "a".repeat(2001),
        idioma: "en",
      }),
    );
    expect(res.status).toBe(413);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.respuestaSparringLarga);
  });

  it("/api/tts", async () => {
    const res = await POST_TTS(comoNextRequest(jsonPeticion("/api/tts", { idioma: "en" })));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.faltaTexto);
  });

  it("/api/transcribir: el idioma va como campo del FormData", async () => {
    const res = await POST_TRANSCRIBIR(audioPeticion({ idioma: "en" }));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.faltaAudio);
  });

  it("/api/transcribir: el 413 por content-length usa la cabecera (el FormData aún no se leyó)", async () => {
    const form = new FormData();
    form.append("audio", clipValido());
    form.append("idioma", "es");
    const res = await POST_TRANSCRIBIR(
      new Request("http://localhost/api/transcribir", {
        method: "POST",
        headers: { "content-length": String(20 * 1024 * 1024 + 1), "x-idioma": "en" },
        body: form,
      }),
    );
    expect(res.status).toBe(413);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.audioGrande);
  });

  it("/api/enriquecer", async () => {
    const res = await POST_ENRIQUECER(
      comoNextRequest(jsonPeticion("/api/enriquecer", { tema: "capital", idioma: "en" })),
    );
    // El enriquecimiento degrada en silencio (200 con lista vacía): acá se
    // comprueba que el campo `idioma` se ACEPTA sin romper la respuesta.
    expect(res.status).toBe(200);
  });
});

describe("un cuerpo ilegible responde en el idioma de la cabecera", () => {
  it("/api/analizar-pitch con JSON roto", async () => {
    const peticion = new Request("http://localhost/api/analizar-pitch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-idioma": "en" },
      body: "{esto no es json",
    });
    const res = await POST_ANALIZAR(peticion);
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.jsonInvalido);
  });

  it("/api/tts con JSON roto y sin cabecera cae a español", async () => {
    const peticion = new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{roto",
    });
    const res = await POST_TTS(comoNextRequest(peticion));
    expect(res.status).toBe(400);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.jsonInvalido);
  });
});

describe("429 en el idioma de la cabecera", () => {
  async function agotarLimite(ruta: string, idioma: string): Promise<Response> {
    const cabeceras = {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.7",
      "x-idioma": idioma,
    };

    let ultima: Response | null = null;
    for (let i = 0; i <= MAX_SOLICITUDES; i += 1) {
      ultima = await POST_TTS(
        comoNextRequest(
          new Request(`http://localhost${ruta}`, {
            method: "POST",
            headers: cabeceras,
            // Cuerpo inválido a propósito: corta antes de tocar al proveedor.
            body: JSON.stringify({}),
          }),
        ),
      );
    }
    if (!ultima) throw new Error("sin respuesta");
    return ultima;
  }

  it("el mensaje del 429 sale en inglés cuando la cabecera lo pide", async () => {
    const res = await agotarLimite("/api/tts", "en");
    expect(res.status).toBe(429);
    expect(await mensajeDe(res)).toBe(diccionario("en").api.demasiadasSolicitudes);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("sin cabecera, el 429 sale en español", async () => {
    const res = await agotarLimite("/api/tts", "es");
    expect(res.status).toBe(429);
    expect(await mensajeDe(res)).toBe(diccionario("es").api.demasiadasSolicitudes);
  });
});
