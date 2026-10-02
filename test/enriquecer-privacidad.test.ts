import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// El centinela y el espía se construyen en `vi.hoisted` porque `vi.mock` se
// eleva al inicio del archivo: sin esto, la fábrica del mock correría antes de
// que existan las constantes (TDZ).
const h = vi.hoisted(() => ({
  TRANSCRIPCION:
    "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA y busco inversión para escalarla.",
  captureException: vi.fn(),
}));

// Se intercepta el SDK para inspeccionar el payload que realmente saldría.
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => h.captureException(...args),
}));

// Se fuerza el ÚNICO camino que reporta a Sentry desde esta ruta: el catch
// externo. Los fallos del proveedor se tragan adentro (diseño best-effort), así
// que para llegar al catch se hace que enriquecerConTavily lance un ErrorModelo
// cuyo `message` arrastra el cuerpo del proveedor —que ecoa la petición con la
// transcripción—. Es la forma real de src/lib/proveedor-nebius.ts.
vi.mock("@/lib/tavily", () => ({
  enriquecerConTavily: vi.fn(async () => {
    const error = new Error(
      `El modelo respondió con error 400: {"error":{"message":"prompt inválido: ${h.TRANSCRIPCION}"}}`,
    );
    error.name = "ErrorModelo";
    (error as { codigoHttp?: number }).codigoHttp = 400;
    throw error;
  }),
}));

import { POST as POST_ENRIQUECER } from "@/app/api/enriquecer/route";
import { beforeSend } from "@/lib/sentry-scrub";
import { reiniciar } from "@/lib/rate-limit";

const ENV_KEYS = [
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "TAVILY_API_KEY",
  "SENTRY_ENABLED",
];

let previo: Record<string, string | undefined> = {};

// La ruta loguea el error crudo a consola a propósito (es la vía de depuración
// del mantenedor). Se captura ese log para probar que Sentry NO lo recibe: el
// SDK lo grabaría tal cual en un breadcrumb de consola. Se instala una sola vez
// para el archivo (cada archivo de test corre aislado).
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.MODEL_PROVIDER = "nebius";
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.TAVILY_API_KEY = "test-key";
  h.captureException.mockClear();
  consoleError.mockClear();
  reiniciar();
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  vi.unstubAllGlobals();
});

function peticion(body: unknown): NextRequest {
  return new Request("http://localhost/api/enriquecer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "9.9.9.9",
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const CUERPO = {
  tema: "capital",
  idioma: "es",
  transcripcion: h.TRANSCRIPCION,
  puntosSinCumplir: [{ punto: "ask", comentario: "Falta el monto del ask" }],
};

/** Serializa como Sentry guardaría un Error en un breadcrumb: message y stack. */
function serializar(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v,
  );
}

describe("/api/enriquecer — la transcripción no se filtra por el camino de error", () => {
  it("la respuesta al cliente no lleva la transcripción cuando el fallo llega al catch externo", async () => {
    const res = await POST_ENRIQUECER(peticion(CUERPO));

    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(JSON.parse(texto)).toEqual({ sugerencias: [] });
    expect(texto).not.toContain(h.TRANSCRIPCION);
    expect(texto).not.toContain("TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA");
  });

  it("el reporte a Sentry no lleva la transcripción por ninguna vía (mensaje, stack, extra, tags)", async () => {
    await POST_ENRIQUECER(peticion(CUERPO));

    expect(h.captureException).toHaveBeenCalledTimes(1);
    const [enviado, opciones] = h.captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown>; tags: Record<string, string> },
    ];

    // Se conserva lo útil para agrupar el fallo...
    expect(enviado.message).toBe("ErrorModelo · proveedor=tavily · HTTP 400");
    expect(opciones.tags).toEqual({ proveedor: "tavily" });
    expect(opciones.extra).toEqual({
      proveedor: "tavily",
      error: { nombre: "ErrorModelo", codigoHttp: 400 },
    });

    // ...y el cuerpo del proveedor —con la transcripción— no viaja por ninguna.
    const payload = serializar(h.captureException.mock.calls);
    expect(payload).not.toContain(h.TRANSCRIPCION);
    expect(payload).not.toContain("TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA");
    expect(String(enviado.stack)).not.toContain(h.TRANSCRIPCION);
  });

  it("el error crudo sí va a consola, pero beforeSend descarta el breadcrumb que Sentry armaría con él", async () => {
    await POST_ENRIQUECER(peticion(CUERPO));

    // 1) El log crudo de la ruta SÍ contiene la transcripción. Es deliberado.
    expect(consoleError).toHaveBeenCalledTimes(1);
    const args = consoleError.mock.calls[0] as unknown[];
    expect(serializar(args)).toContain(h.TRANSCRIPCION);

    // 2) Sentry grabaría esos argumentos tal cual en un breadcrumb de consola:
    //    `data.arguments` con el Error serializado (message + stack completos).
    //    Ese es el vector de fuga real, el mismo que se cerró para ElevenLabs.
    const evento = {
      breadcrumbs: [
        {
          category: "console",
          level: "error",
          message: String(args[0]),
          data: { arguments: args, logger: "console" },
        },
      ],
    };

    // 3) El filtro real del proyecto lo descarta entero: nada de la transcripción
    //    sobrevive la última barrera antes de salir hacia Sentry.
    const salida = beforeSend(evento);
    expect(serializar(salida)).not.toContain(h.TRANSCRIPCION);
    expect(salida?.breadcrumbs).toEqual([]);
  });
});
