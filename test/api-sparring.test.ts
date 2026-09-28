import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as POST_PREGUNTA } from "@/app/api/sparring/pregunta/route";
import { POST as POST_EVALUAR } from "@/app/api/sparring/evaluar/route";
import { MAX_RESPUESTA_SPARRING_CARACTERES } from "@/lib/limites";
import { MAX_SOLICITUDES as MAX_RATE, consumir, reiniciar } from "@/lib/rate-limit";

const ENV_KEYS = [
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "NEBIUS_MODEL_NANO",
  "MODEL",
  "MODEL_RETRY_ATTEMPTS",
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
  process.env.NEBIUS_MODEL_NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
  process.env.MODEL_RETRY_ATTEMPTS = "1";
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

function respuestaNebius(content: object): Response {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function peticion(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "2.2.2.2" },
    body: JSON.stringify(body),
  });
}

function cuerpoDe(fetchMock: ReturnType<typeof vi.fn>, indice = 0): Record<string, unknown> {
  const llamada = fetchMock.mock.calls[indice] as [string, { body: string }];
  return JSON.parse(llamada[1].body) as Record<string, unknown>;
}

describe("POST /api/sparring/pregunta", () => {
  it("usa el nivel rapido (Nano) y devuelve la pregunta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaNebius({ pregunta: "¿Cuánto capital buscas y para qué?" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_PREGUNTA(
      peticion("http://localhost/api/sparring/pregunta", {
        tipoPitch: "capital",
        punto: "ask",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pregunta: "¿Cuánto capital buscas y para qué?" });

    const cuerpo = cuerpoDe(fetchMock);
    expect(cuerpo.model).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
    expect(cuerpo.chat_template_kwargs).toEqual({ enable_thinking: false });
    const format = cuerpo.response_format as { json_schema: { name: string } };
    expect(format.json_schema.name).toBe("pregunta_sparring");
  });

  it("rechaza un punto que no está en la rúbrica", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_PREGUNTA(
      peticion("http://localhost/api/sparring/pregunta", {
        tipoPitch: "capital",
        punto: "Punto inventado",
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al fallar el proveedor responde 502 genérico", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("token factory down"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_PREGUNTA(
      peticion("http://localhost/api/sparring/pregunta", {
        tipoPitch: "capital",
        punto: "ask",
      }),
    );
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).not.toMatch(/token factory|nebius/i);
  });
});

describe("POST /api/sparring/evaluar", () => {
  it("usa Nano y valida la evaluación (ignora campos extra del modelo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaNebius({
        cumplido: true,
        comentario: "Ahora sí queda el monto y el uso.",
        punto: "alucinado",
        score: 99,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_EVALUAR(
      peticion("http://localhost/api/sparring/evaluar", {
        tipoPitch: "capital",
        punto: "ask",
        pregunta: "¿Cuánto capital buscas y para qué?",
        respuesta: "Pedimos 200 mil dólares para contratar dos ingenieros.",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      cumplido: true,
      comentario: "Ahora sí queda el monto y el uso.",
    });
    expect(cuerpoDe(fetchMock).model).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
    const format = cuerpoDe(fetchMock).response_format as { json_schema: { name: string } };
    expect(format.json_schema.name).toBe("evaluacion_sparring");
  });

  it("rechaza una respuesta que supera el límite propio", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_EVALUAR(
      peticion("http://localhost/api/sparring/evaluar", {
        tipoPitch: "capital",
        punto: "ask",
        pregunta: "¿Cuánto?",
        respuesta: "x".repeat(MAX_RESPUESTA_SPARRING_CARACTERES + 1),
      }),
    );
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aplica rate limiting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < MAX_RATE; i++) {
      consumir("sparring-evaluar:2.2.2.2");
    }

    const bloqueada = await POST_EVALUAR(
      peticion("http://localhost/api/sparring/evaluar", {
        tipoPitch: "capital",
        punto: "ask",
        pregunta: "¿Cuánto?",
        respuesta: "Todavía no lo sé.",
      }),
    );
    expect(bloqueada.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    const json = (await bloqueada.json()) as { error: string };
    expect(json.error).toMatch(/Demasiadas solicitudes/);
  });
});
