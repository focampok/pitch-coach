import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SolicitudModelo } from "@/lib/modelo";
import { llamarModelo, proveedorActivo } from "@/lib/modelo";
import { esquemaAnalisis } from "@/lib/validar-analisis";
import { crearProveedorNebius, proveedorNebius } from "@/lib/proveedor-nebius";
import { proveedorGemini } from "@/lib/proveedor-gemini";

// Pruebas del adaptador de Nebius con fetch mockeado: ninguna llamada sale a la
// red real. Se verifica el contrato HTTP (URL, headers, body y envoltorio
// json_schema), los modos estandar/ultra, el reintento por finish_reason
// "length" y la selección de proveedor en modelo.ts.

const PUNTOS = ["Problema claro", "El ask"];

const SOLICITUD: SolicitudModelo = {
  system: "SISTEMA",
  user: "USUARIO",
  idioma: "es",
  esquema: esquemaAnalisis("es"),
  puntosRubrica: PUNTOS,
};

const ENV_KEYS = [
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "NEBIUS_BASE_URL",
  "NEBIUS_MODEL_ULTRA",
  "NEBIUS_MODEL_NANO",
  "MODEL",
  "MODEL_FALLBACK_MODELS",
  "MODEL_MAX_TOKENS",
  "MODEL_TEMPERATURE",
  "MODEL_RETRY_ATTEMPTS",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_FALLBACK_MODELS",
];

let previo: Record<string, string | undefined> = {};

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Respuesta 200 con la forma de `/chat/completions`. */
function respuestaNebius(content: string, finishReason = "stop"): Response {
  return new Response(
    JSON.stringify({ choices: [{ finish_reason: finishReason, message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Cuerpo JSON enviado en la llamada `indice` del fetch mockeado. */
function cuerpoDe(fetchMock: ReturnType<typeof vi.fn>, indice = 0): Record<string, unknown> {
  const llamada = fetchMock.mock.calls[indice] as [string, { body: string }];
  return JSON.parse(llamada[1].body) as Record<string, unknown>;
}

describe("proveedor Nebius — contrato HTTP", () => {
  it("arma URL, headers y body con el envoltorio json_schema", async () => {
    process.env.MODEL_PROVIDER = "nebius";
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.MODEL = "nvidia/nemotron-3-super-120b-a12b";
    process.env.MODEL_MAX_TOKENS = "1024";
    process.env.MODEL_TEMPERATURE = "0.4";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);

    const texto = await proveedorNebius.enviar({
      modelo: "nvidia/nemotron-3-super-120b-a12b",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    expect(texto).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("https://api.tokenfactory.nebius.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const cuerpo = cuerpoDe(fetchMock);
    expect(cuerpo.model).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(cuerpo.temperature).toBe(0.4);
    expect(cuerpo.max_tokens).toBe(1024);
    expect(cuerpo.messages).toEqual([
      { role: "system", content: "SISTEMA" },
      { role: "user", content: "USUARIO" },
    ]);
    expect(cuerpo.chat_template_kwargs).toEqual({ enable_thinking: false });

    const envoltorio = cuerpo.response_format as {
      type: string;
      json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
    };
    expect(envoltorio.type).toBe("json_schema");
    expect(envoltorio.json_schema.name).toBe("analisis_pitch");
    expect(envoltorio.json_schema.strict).toBe(true);

    const schema = envoltorio.json_schema.schema as {
      required?: string[];
      additionalProperties?: boolean;
      properties: {
        rubrica: {
          minItems?: number;
          maxItems?: number;
          items: {
            required?: string[];
            additionalProperties?: boolean;
            properties: Record<string, { enum?: string[] }>;
          };
        };
      };
    };
    expect(schema.properties.rubrica.minItems).toBe(PUNTOS.length);
    expect(schema.properties.rubrica.maxItems).toBe(PUNTOS.length);

    // El modelo NO nombra los puntos: el ítem es solo { cumplido, comentario }.
    const items = schema.properties.rubrica.items;
    expect(Object.keys(items.properties).sort()).toEqual(["comentario", "cumplido"]);
    expect(items.required).toEqual(["cumplido", "comentario"]);
    expect(items.additionalProperties).toBe(false);
    expect(items.properties).not.toHaveProperty("punto");
    expect(JSON.stringify(items)).not.toContain("enum");

    expect(schema.required).toEqual(["veredicto_corto", "claridad", "rubrica"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("respeta NEBIUS_BASE_URL cuando está definida (sin barra final duplicada)", async () => {
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.NEBIUS_BASE_URL = "https://proxy.example.com/v1/";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await proveedorNebius.enviar({
      modelo: "m",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://proxy.example.com/v1/chat/completions");
  });
});

describe("proveedor Nebius — modos estandar, ultra y rapido", () => {
  it("estandar usa MODEL y envía chat_template_kwargs", async () => {
    process.env.MODEL = "nvidia/nemotron-3-super-120b-a12b";
    process.env.MODEL_FALLBACK_MODELS = "fallback-a, fallback-b";
    process.env.NEBIUS_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const proveedor = crearProveedorNebius("estandar");
    expect(proveedor.listarModelos()).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "fallback-a",
      "fallback-b",
    ]);

    await proveedor.enviar({
      modelo: "nvidia/nemotron-3-super-120b-a12b",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    const cuerpo = cuerpoDe(fetchMock);
    expect(cuerpo.model).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(cuerpo.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("ultra usa NEBIUS_MODEL_ULTRA y OMITE chat_template_kwargs", async () => {
    process.env.NEBIUS_MODEL_ULTRA = "nvidia/Nemotron-3-Ultra-550b-a55b";
    process.env.MODEL = "nvidia/nemotron-3-super-120b-a12b";
    process.env.NEBIUS_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const proveedor = crearProveedorNebius("ultra");
    expect(proveedor.listarModelos()).toEqual(["nvidia/Nemotron-3-Ultra-550b-a55b"]);

    await proveedor.enviar({
      modelo: "ignorado-en-ultra",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    const cuerpo = cuerpoDe(fetchMock);
    expect(cuerpo.model).toBe("nvidia/Nemotron-3-Ultra-550b-a55b");
    expect(cuerpo).not.toHaveProperty("chat_template_kwargs");
  });

  it("rapido usa NEBIUS_MODEL_NANO y envía chat_template_kwargs", async () => {
    process.env.NEBIUS_MODEL_NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
    process.env.MODEL = "nvidia/nemotron-3-super-120b-a12b";
    process.env.NEBIUS_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const proveedor = crearProveedorNebius("rapido");
    expect(proveedor.listarModelos()).toEqual(["nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"]);

    await proveedor.enviar({
      modelo: "ignorado-en-rapido",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    const cuerpo = cuerpoDe(fetchMock);
    expect(cuerpo.model).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
    expect(cuerpo.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("rapido usa el default de Nano si NEBIUS_MODEL_NANO no está definida", async () => {
    process.env.NEBIUS_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const proveedor = crearProveedorNebius("rapido");
    expect(proveedor.listarModelos()).toEqual(["nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"]);

    await proveedor.enviar({
      modelo: "ignorado",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    expect(cuerpoDe(fetchMock).model).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
  });
});

describe("proveedor Nebius — finish_reason length", () => {
  it("reintenta una vez con max_tokens duplicado", async () => {
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.MODEL_MAX_TOKENS = "1024";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuestaNebius("", "length"))
      .mockResolvedValueOnce(respuestaNebius('{"ok":true}', "stop"));
    vi.stubGlobal("fetch", fetchMock);

    const texto = await proveedorNebius.enviar({
      modelo: "nvidia/nemotron-3-super-120b-a12b",
      solicitud: SOLICITUD,
      signal: AbortSignal.timeout(1000),
    });

    expect(texto).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cuerpoDe(fetchMock, 0).max_tokens).toBe(1024);
    expect(cuerpoDe(fetchMock, 1).max_tokens).toBe(2048);
  });

  it("no reintenta más allá del tope: lanza error claro si ya está en 8192", async () => {
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.MODEL_MAX_TOKENS = "8192";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius("", "length"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      proveedorNebius.enviar({
        modelo: "nvidia/nemotron-3-super-120b-a12b",
        solicitud: SOLICITUD,
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow(/truncó la respuesta/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lanza error si el reintento truncado también llega a length", async () => {
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.MODEL_MAX_TOKENS = "1024";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuestaNebius("", "length"))
      .mockResolvedValueOnce(respuestaNebius("", "length"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      proveedorNebius.enviar({
        modelo: "nvidia/nemotron-3-super-120b-a12b",
        solicitud: SOLICITUD,
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow(/otra vez/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("proveedor Nebius — configuración faltante", () => {
  it("sin NEBIUS_API_KEY lanza error claro antes de cualquier fetch", async () => {
    process.env.MODEL_PROVIDER = "nebius";
    process.env.NEBIUS_API_KEY = "";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      proveedorNebius.enviar({
        modelo: "nvidia/nemotron-3-super-120b-a12b",
        solicitud: SOLICITUD,
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow(/NEBIUS_API_KEY/);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("modelo.ts — selección de proveedor por MODEL_PROVIDER", () => {
  it("MODEL_PROVIDER=nebius selecciona Nebius", () => {
    process.env.MODEL_PROVIDER = "nebius";
    expect(proveedorActivo().nombre).toBe("nebius");
  });

  it("MODEL_PROVIDER=gemini selecciona Gemini y sigue apuntando a generateContent", () => {
    process.env.MODEL_PROVIDER = "gemini";
    expect(proveedorActivo().nombre).toBe("gemini");
  });

  it("sin MODEL_PROVIDER usa Nebius por defecto", () => {
    expect(proveedorActivo().nombre).toBe("nebius");
  });

  it("un MODEL_PROVIDER desconocido lanza un error claro", () => {
    process.env.MODEL_PROVIDER = "openai";
    expect(() => proveedorActivo()).toThrow(/MODEL_PROVIDER inválido/);
  });

  it("proveedorActivo('rapido') con Nebius lista el modelo Nano", () => {
    process.env.MODEL_PROVIDER = "nebius";
    process.env.NEBIUS_MODEL_NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
    expect(proveedorActivo("rapido").listarModelos()).toEqual([
      "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    ]);
  });

  it("proveedorActivo('ultra') con Nebius lista el modelo Ultra", () => {
    process.env.MODEL_PROVIDER = "nebius";
    process.env.NEBIUS_MODEL_ULTRA = "nvidia/Nemotron-3-Ultra-550b-a55b";
    expect(proveedorActivo("ultra").listarModelos()).toEqual([
      "nvidia/Nemotron-3-Ultra-550b-a55b",
    ]);
  });

  it("llamarModelo propaga nivel 'rapido' hasta el modelo Nano", async () => {
    process.env.MODEL_PROVIDER = "nebius";
    process.env.NEBIUS_API_KEY = "test-key";
    process.env.NEBIUS_MODEL_NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
    process.env.MODEL_RETRY_ATTEMPTS = "1";

    const fetchMock = vi.fn().mockResolvedValue(respuestaNebius('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await llamarModelo({ ...SOLICITUD, validar: (d) => d }, "rapido");
    expect(resultado).toEqual({ ok: true });
    expect(cuerpoDe(fetchMock).model).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
    expect(cuerpoDe(fetchMock).chat_template_kwargs).toEqual({ enable_thinking: false });
  });
});

describe("proveedor Gemini — no se rompió", () => {
  it("usa el endpoint generateContent con la key como query param", async () => {
    process.env.MODEL_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "g-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const proveedor = proveedorActivo();
    const texto = await proveedor.enviar({
      modelo: "gemini-3.5-flash",
      solicitud: { system: "S", user: "U", idioma: "es", esquema: esquemaAnalisis("es") },
      signal: AbortSignal.timeout(1000),
    });

    expect(texto).toBe('{"ok":true}');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-3.5-flash:generateContent");
    expect(url).toContain("key=g-key");
    expect(proveedorGemini.nombre).toBe("gemini");
  });

  it("ignora el parámetro nivel (rapido/ultra) sin romperse", async () => {
    process.env.MODEL_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "g-key";
    process.env.GEMINI_MODEL = "gemini-2.0-flash";

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const nivel of ["rapido", "ultra", "estandar"] as const) {
      const proveedor = proveedorActivo(nivel);
      expect(proveedor.nombre).toBe("gemini");
      expect(proveedor.listarModelos()[0]).toBe("gemini-2.0-flash");

      const texto = await proveedor.enviar({
        modelo: "gemini-2.0-flash",
        solicitud: { system: "S", user: "U", idioma: "es", esquema: esquemaAnalisis("es") },
        signal: AbortSignal.timeout(1000),
      });
      expect(texto).toBe('{"ok":true}');
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const llamada of fetchMock.mock.calls) {
      const [url] = llamada as [string];
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(url).toContain("generateContent");
    }
  });
});
