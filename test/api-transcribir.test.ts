import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/transcribir/route";
import { MAX_AUDIO_BYTES } from "@/lib/limites";
import { diccionario } from "@/lib/diccionarios";
import { MAX_SOLICITUDES, reiniciar } from "@/lib/rate-limit";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const AUDIO_SENTINEL = "BYTES-DE-AUDIO-DEL-USUARIO-NUNCA-EN-LOGS";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_SCRIBE_MODEL",
  "SENTRY_ENABLED",
];

let previo: Record<string, string | undefined> = {};
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.ELEVENLABS_API_KEY = "test-eleven-key";
  process.env.SENTRY_ENABLED = "true";
  captureException.mockClear();
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

function archivoAudio(contenido: string = "clip", tipo = "audio/webm"): File {
  return new File([contenido], "grabacion.webm", { type: tipo });
}

function peticion(
  audio: File | null,
  ip = "1.1.1.1",
  extras?: { contentLength?: string; idioma?: string },
): Request {
  const form = new FormData();
  if (audio) form.append("audio", audio);
  if (extras?.idioma) form.append("idioma", extras.idioma);
  const headers = new Headers({ "x-forwarded-for": ip });
  if (extras?.contentLength) headers.set("content-length", extras.contentLength);
  return new Request("http://localhost/api/transcribir", {
    method: "POST",
    headers,
    body: form,
  });
}

function todoLoLogueado(): string {
  return JSON.stringify(consoleError.mock.calls);
}

function todoLoEnviadoASentry(): string {
  return JSON.stringify(captureException.mock.calls);
}

describe("POST /api/transcribir", () => {
  it("devuelve el texto cuando Scribe responde bien", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "Hola, este es el pitch." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(peticion(archivoAudio()));
    const cuerpo = (await res.json()) as { texto?: string };

    expect(res.status).toBe(200);
    expect(cuerpo.texto).toBe("Hola, este es el pitch.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe(
      "test-eleven-key",
    );
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("usa ELEVENLABS_SCRIBE_MODEL cuando está definido", async () => {
    process.env.ELEVENLABS_SCRIBE_MODEL = "scribe_v2_custom";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(peticion(archivoAudio()));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("model_id")).toBe("scribe_v2_custom");
    expect(body.get("language_code")).toBe("es");
  });

  it("sin idioma manda language_code es", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(peticion(archivoAudio()));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("language_code")).toBe("es");
    expect(body.get("model_id")).toBe("scribe_v2");
  });

  it("con idioma en manda language_code en", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "the pitch" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(peticion(archivoAudio(), "1.1.1.9", { idioma: "en" }));
    expect(res.status).toBe(200);
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("language_code")).toBe("en");
  });

  it("al fallar el proveedor responde 502 genérico y no filtra el audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "quota exceeded" }), { status: 429 }),
      ),
    );

    const res = await POST(peticion(archivoAudio(AUDIO_SENTINEL)));
    const cuerpo = (await res.json()) as { error?: string };

    expect(res.status).toBe(502);
    expect(cuerpo.error).toBe("No se pudo transcribir el audio en este momento.");
    expect(cuerpo.error).not.toContain("quota");
    expect(todoLoLogueado()).toContain("ElevenLabs STT respondió 429");
    expect(todoLoLogueado()).not.toContain(AUDIO_SENTINEL);
    expect(todoLoEnviadoASentry()).not.toContain(AUDIO_SENTINEL);
    expect(todoLoEnviadoASentry()).not.toContain("quota exceeded");
  });

  it("PRIVACIDAD: console.error y Sentry no reciben los bytes del audio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red caída")));

    await POST(peticion(archivoAudio(AUDIO_SENTINEL)));

    expect(todoLoLogueado()).not.toContain(AUDIO_SENTINEL);
    expect(todoLoEnviadoASentry()).not.toContain(AUDIO_SENTINEL);
    for (const args of consoleError.mock.calls) {
      expect(args.some((arg) => arg instanceof Blob)).toBe(false);
    }
  });

  it("rechaza un audio que supera el tope (Content-Length)", async () => {
    const res = await POST(
      peticion(archivoAudio(), "2.2.2.2", {
        contentLength: String(MAX_AUDIO_BYTES + 1),
      }),
    );
    const cuerpo = (await res.json()) as { error?: string };

    expect(res.status).toBe(413);
    expect(cuerpo.error).toBe(diccionario("es").api.audioGrande);
  });

  it("rechaza un audio que supera el tope (tamaño del Blob)", async () => {
    const grande = new File([new ArrayBuffer(MAX_AUDIO_BYTES + 1)], "grande.webm", {
      type: "audio/webm",
    });
    const res = await POST(peticion(grande, "3.3.3.3"));
    const cuerpo = (await res.json()) as { error?: string };

    expect(res.status).toBe(413);
    expect(cuerpo.error).toBe(diccionario("es").api.audioGrande);
  });

  it("rechaza un MIME que Scribe no acepta", async () => {
    const res = await POST(peticion(archivoAudio("x", "application/pdf"), "4.4.4.4"));
    expect(res.status).toBe(400);
  });

  it("rechaza si falta el campo audio", async () => {
    const res = await POST(peticion(null, "5.5.5.5"));
    expect(res.status).toBe(400);
  });

  it("aplica el mismo rate limit por IP que el resto de rutas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ text: "ok" }), { status: 200 }),
        ),
      ),
    );

    for (let i = 0; i < MAX_SOLICITUDES; i++) {
      const res = await POST(peticion(archivoAudio(), "9.9.9.9"));
      expect(res.status).toBe(200);
    }

    const bloqueada = await POST(peticion(archivoAudio(), "9.9.9.9"));
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.headers.get("Retry-After")).toBeTruthy();
    const cuerpo = (await bloqueada.json()) as { error?: string };
    expect(cuerpo.error).toMatch(/Demasiadas solicitudes/);
  });
});
