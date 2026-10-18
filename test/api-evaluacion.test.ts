import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { POST as analizar } from "@/app/api/analizar-pitch/route";
import { GET as estado } from "@/app/api/estado/route";
import { POST as enriquecer } from "@/app/api/enriquecer/route";
import { POST as linea } from "@/app/api/linea-tiempo/route";
import { POST as toma } from "@/app/api/segunda-toma/route";
import { POST as evaluar } from "@/app/api/sparring/evaluar/route";
import { POST as pregunta } from "@/app/api/sparring/pregunta/route";
import { POST as transcribir } from "@/app/api/transcribir/route";
import { POST as tts } from "@/app/api/tts/route";
import { leerCupo, serializarCookie, type Cupo } from "@/lib/cupo-evaluacion";
import { diccionario } from "@/lib/diccionarios";
import { MAX_SOLICITUDES, consumir as consumirVentana, reiniciar } from "@/lib/rate-limit";

const SECRETO = "test-eval-cookie-secret-32bytes-min";

const ENV_KEYS = [
  "LIVE_DEMO",
  "EVAL_LIMIT",
  "EVAL_COOKIE_SECRET",
  "DEMO_VIDEO_URL",
  "CONTACTO",
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "NEBIUS_MODEL_ULTRA",
  "NEBIUS_MODEL_NANO",
  "MODEL",
  "MODEL_RETRY_ATTEMPTS",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID_MALE",
  "ELEVENLABS_VOICE_ID_FEMALE",
  "ELEVENLABS_VOICE_ID_EN_MALE",
  "ELEVENLABS_VOICE_ID_EN_FEMALE",
  "TAVILY_API_KEY",
  "SENTRY_ENABLED",
] as const;

let previo: Record<string, string | undefined> = {};
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.LIVE_DEMO = "true";
  process.env.EVAL_LIMIT = "10";
  process.env.EVAL_COOKIE_SECRET = SECRETO;
  process.env.MODEL_PROVIDER = "nebius";
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.MODEL_RETRY_ATTEMPTS = "1";
  process.env.ELEVENLABS_API_KEY = "test-eleven-key";
  process.env.ELEVENLABS_VOICE_ID_MALE = "es-male";
  process.env.ELEVENLABS_VOICE_ID_FEMALE = "es-female";
  process.env.ELEVENLABS_VOICE_ID_EN_MALE = "en-male";
  process.env.ELEVENLABS_VOICE_ID_EN_FEMALE = "en-female";
  process.env.SENTRY_ENABLED = "false";
  reiniciar();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
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

const ANALISIS = {
  veredicto_corto: "Buen arranque, cierra con el ask.",
  claridad: 14,
  rubrica: [
    { cumplido: true, comentario: "Claro." },
    { cumplido: false, comentario: "Falta cifra." },
    { cumplido: true, comentario: "Ok." },
    { cumplido: false, comentario: "Sin métricas." },
    { cumplido: false, comentario: "Sin ask." },
  ],
};

const SOLICITUD = {
  transcripcion: "Tenemos un problema real y una solución distinta.",
  tipoPitch: "capital",
  duracionMaxima: 3,
  tiempoRealSegundos: 45,
};

function respuestaNebius(content: object, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

/** Cada llamada necesita un Response nuevo: el cuerpo solo se lee una vez. */
function mockModelo(contenido: object): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respuestaNebius(contenido)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function cookieDe(usadas: number, sid = "sid-test"): string {
  const cupo: Cupo = { v: 1, sid, usadas, iat: 1_700_000_000 };
  return serializarCookie(cupo);
}

function valorSetCookie(res: Response): string | null {
  const lista =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const linea = lista.find((item) => item.startsWith("pc_eval="));
  if (!linea) return null;
  return (linea.split(";")[0] ?? "").slice("pc_eval=".length);
}

function usadasDe(cookie: string): number {
  return leerCupo(
    new Request("http://localhost/", { headers: { cookie: `pc_eval=${cookie}` } }),
  ).usadas;
}

function postJson(url: string, body: unknown, ip: string, cookie?: string): Request {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": ip,
  });
  if (cookie) headers.set("cookie", `pc_eval=${cookie}`);
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function postVacio(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "x-forwarded-for": "8.8.8.8" },
  });
}

const rutas = [
  { nombre: "/api/analizar-pitch", llamar: (req: Request) => analizar(req) },
  { nombre: "/api/enriquecer", llamar: (req: Request) => enriquecer(req as unknown as NextRequest) },
  { nombre: "/api/linea-tiempo", llamar: (req: Request) => linea(req as unknown as NextRequest) },
  { nombre: "/api/segunda-toma", llamar: (req: Request) => toma(req) },
  { nombre: "/api/sparring/pregunta", llamar: (req: Request) => pregunta(req) },
  { nombre: "/api/sparring/evaluar", llamar: (req: Request) => evaluar(req) },
  { nombre: "/api/transcribir", llamar: (req: Request) => transcribir(req) },
  { nombre: "/api/tts", llamar: (req: Request) => tts(req as unknown as NextRequest) },
] as const;

function audio(proposito?: string, cookie?: string): Request {
  const form = new FormData();
  form.append("audio", new File(["clip"], "grabacion.webm", { type: "audio/webm" }));
  form.append("idioma", "es");
  if (proposito) form.append("proposito", proposito);
  const headers = new Headers({ "x-forwarded-for": "7.7.7.7" });
  if (cookie) headers.set("cookie", `pc_eval=${cookie}`);
  return new Request("http://localhost/api/transcribir", { method: "POST", headers, body: form });
}

describe("pausa y cupo en las rutas de proveedor", () => {
  it("LIVE_DEMO ausente, false u otro valor responde 503 sin llamar al proveedor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const valor of [undefined, "false", "yes"] as const) {
      if (valor === undefined) delete process.env.LIVE_DEMO;
      else process.env.LIVE_DEMO = valor;
      for (const ruta of rutas) {
        const res = await ruta.llamar(postVacio(`http://localhost${ruta.nombre}`));
        expect(res.status, ruta.nombre).toBe(503);
        const cuerpo = (await res.json()) as { error: string };
        expect(cuerpo.error, ruta.nombre).toBe("demo_pausada");
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el mensaje del 503 sale en el idioma de X-Idioma o, sin ella, del Accept-Language", async () => {
    process.env.LIVE_DEMO = "false";
    vi.stubGlobal("fetch", vi.fn());
    const casos: { cabeceras: Record<string, string>; idioma: "es" | "en" }[] = [
      { cabeceras: { "x-idioma": "en" }, idioma: "en" },
      { cabeceras: { "x-idioma": "es", "accept-language": "en-US" }, idioma: "es" },
      // Una petición hecha a mano (curl, un juez) no manda X-Idioma.
      { cabeceras: { "accept-language": "en-US,en;q=0.9,es;q=0.8" }, idioma: "en" },
      { cabeceras: { "accept-language": "es-MX,es;q=0.9" }, idioma: "es" },
      { cabeceras: {}, idioma: "es" },
    ];
    for (const caso of casos) {
      const res = await analizar(
        new Request("http://localhost/api/analizar-pitch", {
          method: "POST",
          headers: { "x-forwarded-for": "8.8.8.8", ...caso.cabeceras },
        }),
      );
      expect(res.status).toBe(503);
      const cuerpo = (await res.json()) as { error: string; mensaje: string };
      expect(cuerpo.error).toBe("demo_pausada");
      expect(cuerpo.mensaje, JSON.stringify(caso.cabeceras)).toBe(
        diccionario(caso.idioma).evaluacion.demoPausada,
      );
    }
  });

  it("EVAL_LIMIT activo sin secreto responde 503 y no imprime el secreto", async () => {
    process.env.LIVE_DEMO = "true";
    process.env.EVAL_COOKIE_SECRET = "secreto-corto-no";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const ruta of rutas) {
      const res = await ruta.llamar(postVacio(`http://localhost${ruta.nombre}`));
      expect(res.status, ruta.nombre).toBe(503);
      const cuerpo = (await res.json()) as { error: string };
      expect(cuerpo.error, ruta.nombre).toBe("evaluacion_no_configurada");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    const log = consoleError.mock.calls.flat().join("\n");
    expect(log).toMatch(/EVAL_COOKIE_SECRET/);
    expect(log).not.toContain("secreto-corto-no");
    expect(log).not.toContain("pc_eval=");
  });

  it("con el cupo apagado no pone cookie ni cabeceras nuevas", async () => {
    delete process.env.EVAL_LIMIT;
    delete process.env.EVAL_COOKIE_SECRET;
    mockModelo(ANALISIS);
    const res = await analizar(postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.3.4"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Eval-Restantes")).toBeNull();
    expect(res.headers.get("X-Eval-Limite")).toBeNull();
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("un análisis estándar descuenta 1 y devuelve restantes y Set-Cookie", async () => {
    mockModelo(ANALISIS);
    const res = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.3.5", cookieDe(3)),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Eval-Restantes")).toBe("6");
    expect(res.headers.get("X-Eval-Limite")).toBe("10");
    const cookie = valorSetCookie(res);
    expect(cookie).not.toBeNull();
    expect(usadasDe(cookie!)).toBe(4);
  });

  it("ultra y rápido descuentan 1 cada uno; estándar y luego ultra suman 2", async () => {
    const fetchMock = mockModelo({ ...ANALISIS, traza: ["Revisé el ask."] });

    const ultra = await analizar(
      postJson(
        "http://localhost/api/analizar-pitch",
        { ...SOLICITUD, nivel: "ultra" },
        "1.2.3.6",
        cookieDe(1, "sid-ultra"),
      ),
    );
    expect(ultra.status).toBe(200);
    expect(usadasDe(valorSetCookie(ultra)!)).toBe(2);

    const rapido = await analizar(
      postJson(
        "http://localhost/api/analizar-pitch",
        { ...SOLICITUD, nivel: "rapido" },
        "1.2.3.7",
        cookieDe(0, "sid-rapido"),
      ),
    );
    expect(rapido.status).toBe(200);
    expect(usadasDe(valorSetCookie(rapido)!)).toBe(1);

    fetchMock.mockImplementation(() => Promise.resolve(respuestaNebius(ANALISIS)));
    const primero = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.3.8", cookieDe(0, "sid-par")),
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(respuestaNebius({ ...ANALISIS, traza: ["Revisé el ask."] })),
    );
    const segundo = await analizar(
      postJson(
        "http://localhost/api/analizar-pitch",
        { ...SOLICITUD, nivel: "ultra" },
        "1.2.3.9",
        valorSetCookie(primero)!,
      ),
    );
    expect(usadasDe(valorSetCookie(segundo)!)).toBe(2);
    expect(segundo.headers.get("X-Eval-Restantes")).toBe("8");
  });

  it("diez análisis estándar pasan y el undécimo no llama al proveedor", async () => {
    const fetchMock = mockModelo(ANALISIS);
    let cookie = cookieDe(0, "sid-diez");
    for (let i = 0; i < 10; i += 1) {
      const res = await analizar(
        postJson("http://localhost/api/analizar-pitch", SOLICITUD, `10.0.0.${i + 1}`, cookie),
      );
      expect(res.status, `análisis ${i + 1}`).toBe(200);
      cookie = valorSetCookie(res)!;
      expect(usadasDe(cookie)).toBe(i + 1);
    }
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const bloqueado = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "10.0.0.99", cookie),
    );
    expect(bloqueado.status).toBe(429);
    const cuerpo = (await bloqueado.json()) as { error: string };
    expect(cuerpo.error).toBe("cupo_evaluacion_agotado");
    expect(bloqueado.headers.get("X-Eval-Restantes")).toBe("0");
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("un 502 o un resultado inválido no descuentan", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("fallo", { status: 502 })));
    vi.stubGlobal("fetch", fetchMock);
    const caido = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.4.1", cookieDe(4, "sid-502")),
    );
    expect(caido.status).toBe(502);
    expect(caido.headers.get("X-Eval-Restantes")).toBe("6");
    expect(valorSetCookie(caido)).toBeNull();

    fetchMock.mockImplementation(() => Promise.resolve(respuestaNebius({})));
    const invalido = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.4.2", cookieDe(4, "sid-invalido")),
    );
    expect(invalido.status).toBe(502);
    expect(invalido.headers.get("X-Eval-Restantes")).toBe("6");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("sparring/evaluar y la segunda toma descuentan 1 solo si el resultado es válido", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(respuestaNebius({ cumplido: true, comentario: "Ahora sí queda el monto." })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const hallazgo = await evaluar(
      postJson(
        "http://localhost/api/sparring/evaluar",
        {
          tipoPitch: "capital",
          punto: "ask",
          pregunta: "¿Cuánto capital buscas?",
          respuesta: "Pedimos 200 mil dólares para contratar.",
        },
        "1.2.5.1",
        cookieDe(2, "sid-hallazgo"),
      ),
    );
    expect(hallazgo.status).toBe(200);
    expect(usadasDe(valorSetCookie(hallazgo)!)).toBe(3);

    const segunda = await toma(
      postJson(
        "http://localhost/api/segunda-toma",
        {
          tipoPitch: "capital",
          punto: "ask",
          respuesta: "Pedimos 200 mil dólares para contratar.",
        },
        "1.2.5.2",
        cookieDe(2, "sid-toma"),
      ),
    );
    expect(segunda.status).toBe(200);
    expect(usadasDe(valorSetCookie(segunda)!)).toBe(3);

    fetchMock.mockImplementation(() => Promise.resolve(respuestaNebius({ comentario: "sin bandera" })));
    const rota = await evaluar(
      postJson(
        "http://localhost/api/sparring/evaluar",
        {
          tipoPitch: "capital",
          punto: "ask",
          pregunta: "¿Cuánto?",
          respuesta: "No lo sé todavía.",
        },
        "1.2.5.3",
        cookieDe(2, "sid-rota"),
      ),
    );
    expect(rota.status).toBe(502);
    expect(rota.headers.get("X-Eval-Restantes")).toBe("8");
    expect(valorSetCookie(rota)).toBeNull();
  });

  it("pregunta, enriquecer, línea de tiempo y tts no descuentan", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(respuestaNebius({ pregunta: "¿Cuánto capital buscas y para qué?" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const cookie = cookieDe(4, "sid-gratis");

    const preg = await pregunta(
      postJson(
        "http://localhost/api/sparring/pregunta",
        { tipoPitch: "capital", punto: "ask" },
        "1.2.6.1",
        cookie,
      ),
    );
    expect(preg.status).toBe(200);
    expect(preg.headers.get("X-Eval-Restantes")).toBe("6");
    expect(valorSetCookie(preg)).toBeNull();

    process.env.TAVILY_API_KEY = "test-tavily";
    fetchMock.mockRejectedValue(new Error("tavily caído"));
    const enr = await enriquecer(
      postJson(
        "http://localhost/api/enriquecer",
        { tema: "capital", transcripcion: "El mercado existe.", puntosSinCumplir: [{ punto: "ask" }] },
        "1.2.6.2",
        cookie,
      ) as unknown as NextRequest,
    );
    expect(enr.status).toBe(200);
    expect(enr.headers.get("X-Eval-Restantes")).toBe("6");

    const tiempo = await linea(
      postJson(
        "http://localhost/api/linea-tiempo",
        {
          tipoPitch: "capital",
          transcripcion: "Hay un problema.",
          palabras: [{ text: "problema", type: "word", start: 0.1, end: 0.4 }],
          puntosCumplidos: ["problema"],
        },
        "1.2.6.3",
        cookie,
      ) as unknown as NextRequest,
    );
    expect(tiempo.status).toBe(200);
    expect(tiempo.headers.get("X-Eval-Restantes")).toBe("6");

    fetchMock.mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1, 2]), { status: 200 })));
    const voz = await tts(
      postJson(
        "http://localhost/api/tts",
        { texto: "Buen pitch.", voz: "female", idioma: "es" },
        "1.2.6.4",
        cookie,
      ) as unknown as NextRequest,
    );
    expect(voz.status).toBe(200);
    expect(voz.headers.get("X-Eval-Restantes")).toBe("6");
    expect(valorSetCookie(voz)).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("con el cupo en 0 las rutas de costo 1 no llaman al proveedor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cookie = cookieDe(10, "sid-cero");
    const casos: { nombre: string; res: Response }[] = [];
    casos.push({
      nombre: "analizar",
      res: await analizar(postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.7.1", cookie)),
    });
    casos.push({
      nombre: "ultra",
      res: await analizar(
        postJson(
          "http://localhost/api/analizar-pitch",
          { ...SOLICITUD, nivel: "ultra" },
          "1.2.7.2",
          cookie,
        ),
      ),
    });
    casos.push({
      nombre: "evaluar",
      res: await evaluar(
        postJson(
          "http://localhost/api/sparring/evaluar",
          {
            tipoPitch: "capital",
            punto: "ask",
            pregunta: "¿Cuánto?",
            respuesta: "Doscientos mil.",
          },
          "1.2.7.3",
          cookie,
        ),
      ),
    });
    casos.push({
      nombre: "toma",
      res: await toma(
        postJson(
          "http://localhost/api/segunda-toma",
          { tipoPitch: "capital", punto: "ask", respuesta: "Doscientos mil." },
          "1.2.7.4",
          cookie,
        ),
      ),
    });
    for (const caso of casos) {
      expect(caso.res.status, caso.nombre).toBe(429);
      const cuerpo = (await caso.res.json()) as { error: string };
      expect(cuerpo.error, caso.nombre).toBe("cupo_evaluacion_agotado");
      expect(caso.res.headers.get("Retry-After"), caso.nombre).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("transcribir con proposito pitch y cupo 0 no llama a ElevenLabs; toma sí", async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify({ text: "hola", words: [] }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const cookie = cookieDe(10, "sid-audio");

    const pitch = await transcribir(audio(undefined, cookie));
    expect(pitch.status).toBe(429);
    expect(((await pitch.json()) as { error: string }).error).toBe("cupo_evaluacion_agotado");
    expect(fetchMock).not.toHaveBeenCalled();

    const explicito = await transcribir(audio("pitch", cookie));
    expect(explicito.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();

    const deToma = await transcribir(audio("toma", cookie));
    expect(deToma.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deToma.headers.get("X-Eval-Restantes")).toBe("0");
  });

  it("el 429 del rate limit no usa el código del cupo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < MAX_SOLICITUDES; i += 1) consumirVentana("analizar-pitch:1.2.8.1");
    const res = await analizar(
      postJson("http://localhost/api/analizar-pitch", SOLICITUD, "1.2.8.1", cookieDe(0, "sid-rate")),
    );
    expect(res.status).toBe(429);
    const cuerpo = (await res.json()) as { error: string };
    expect(cuerpo.error).not.toBe("cupo_evaluacion_agotado");
    expect(cuerpo.error).toMatch(/Demasiadas solicitudes/);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/estado", () => {
  it("refleja las variables leídas en cada llamada", async () => {
    delete process.env.EVAL_LIMIT;
    process.env.LIVE_DEMO = "true";
    delete process.env.DEMO_VIDEO_URL;
    delete process.env.CONTACTO;
    const abierto = await estado(new Request("http://localhost/api/estado"));
    expect(abierto.headers.get("Cache-Control")).toContain("no-store");
    expect(abierto.headers.get("X-Eval-Restantes")).toBeNull();
    expect(await abierto.json()).toEqual({
      liveDemo: true,
      limite: null,
      restantes: null,
      demoVideoUrl: null,
      contacto: null,
    });

    process.env.LIVE_DEMO = "false";
    process.env.EVAL_LIMIT = "10";
    process.env.EVAL_COOKIE_SECRET = SECRETO;
    process.env.DEMO_VIDEO_URL = "https://example.com/demo";
    process.env.CONTACTO = "hola@example.com";
    const pausado = await estado(new Request("http://localhost/api/estado"));
    const cuerpo = (await pausado.json()) as {
      liveDemo: boolean;
      limite: number;
      restantes: number;
      demoVideoUrl: string;
      contacto: string;
    };
    expect(cuerpo.liveDemo).toBe(false);
    expect(cuerpo.limite).toBe(10);
    expect(cuerpo.restantes).toBe(10);
    expect(cuerpo.demoVideoUrl).toBe("https://example.com/demo");
    expect(cuerpo.contacto).toBe("hola@example.com");
    expect(pausado.headers.get("X-Eval-Restantes")).toBe("10");
    expect(pausado.headers.get("X-Eval-Limite")).toBe("10");
    expect(valorSetCookie(pausado)).not.toBeNull();

    delete process.env.EVAL_COOKIE_SECRET;
    const roto = await estado(new Request("http://localhost/api/estado"));
    expect(roto.status).toBe(503);
    const error = (await roto.json()) as { error: string; liveDemo: boolean };
    expect(error.error).toBe("evaluacion_no_configurada");
    expect(error.liveDemo).toBe(false);
  });
});
