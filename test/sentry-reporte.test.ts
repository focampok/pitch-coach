import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Se intercepta el SDK: estos tests verifican QUÉ se manda, no que el SDK
// funcione. Sin el mock, reportarFallo intentaría hablar con Sentry.
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import {
  errorSanitizado,
  reportarFallo,
  resumirError,
} from "@/lib/sentry-reporte";

// El centinela va en el `message`, que es exactamente por donde se filtraba el
// cuerpo de respuesta del proveedor (y con él, la transcripción del pitch).
const TRANSCRIPCION = "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA";

/** Imita a ErrorModelo: Error con `codigoHttp` y cuerpo del proveedor pegado. */
function errorConCuerpoDelProveedor(): Error {
  const error = new Error(
    `El modelo nvidia/nemotron respondió con error 400: {"error":{"message":"invalid request","prompt":"${TRANSCRIPCION}"}}`
  );
  error.name = "ErrorModelo";
  (error as Error & { codigoHttp?: number }).codigoHttp = 400;
  return error;
}

/** Todo lo que efectivamente viajó al SDK, serializado. */
function cargadoEnviado(): string {
  return JSON.stringify(captureException.mock.calls);
}

describe("sentry-reporte", () => {
  beforeEach(() => {
    captureException.mockClear();
    delete process.env.SENTRY_ENABLED;
  });

  afterEach(() => {
    delete process.env.SENTRY_ENABLED;
  });

  describe("resumirError", () => {
    it("extrae nombre y código HTTP", () => {
      expect(resumirError(errorConCuerpoDelProveedor())).toEqual({
        nombre: "ErrorModelo",
        codigoHttp: 400,
      });
    });

    it("nunca incluye el mensaje", () => {
      const resumen = resumirError(errorConCuerpoDelProveedor());
      expect(JSON.stringify(resumen)).not.toContain(TRANSCRIPCION);
      expect(Object.keys(resumen)).not.toContain("message");
    });

    it("omite codigoHttp si no es un número", () => {
      const error = new Error("x") as Error & { codigoHttp?: unknown };
      error.codigoHttp = "400";
      expect(resumirError(error)).toEqual({ nombre: "Error" });
    });

    it("sobrevive a valores que no son Error", () => {
      expect(resumirError("texto")).toEqual({ nombre: "ErrorDesconocido" });
      expect(resumirError(null)).toEqual({ nombre: "ErrorDesconocido" });
    });
  });

  describe("errorSanitizado", () => {
    it("reemplaza el mensaje por el seguro", () => {
      const seguro = errorSanitizado(errorConCuerpoDelProveedor(), "resumen");
      expect(seguro.message).toBe("resumen");
    });

    it("conserva los frames del stack original", () => {
      const original = errorConCuerpoDelProveedor();
      const seguro = errorSanitizado(original, "resumen");
      const framesOriginales = original.stack!.split("\n").slice(1);
      for (const frame of framesOriginales) {
        expect(seguro.stack).toContain(frame);
      }
    });

    it("descarta la primera línea del stack, que arrastra el mensaje original", () => {
      const seguro = errorSanitizado(errorConCuerpoDelProveedor(), "resumen");
      expect(seguro.stack).not.toContain("invalid request");
      expect(seguro.stack!.split("\n")[0]).toBe("ErrorModelo: resumen");
    });

    it("conserva el nombre del error", () => {
      expect(errorSanitizado(errorConCuerpoDelProveedor(), "x").name).toBe(
        "ErrorModelo"
      );
    });
  });

  describe("reportarFallo", () => {
    it("envía un evento con resumen, contexto y tags", () => {
      reportarFallo(
        errorConCuerpoDelProveedor(),
        { proveedor: "nebius", nivel: "ultra" },
        { proveedor: "nebius", nivel: "ultra" }
      );

      expect(captureException).toHaveBeenCalledTimes(1);
      const [error, opciones] = captureException.mock.calls[0] as [
        Error,
        { extra: Record<string, unknown>; tags: Record<string, string> },
      ];
      expect(error.message).toBe("ErrorModelo · proveedor=nebius · nivel=ultra · HTTP 400");
      expect(opciones.extra.proveedor).toBe("nebius");
      expect(opciones.extra.error).toEqual({
        nombre: "ErrorModelo",
        codigoHttp: 400,
      });
      expect(opciones.tags).toEqual({ proveedor: "nebius", nivel: "ultra" });
    });

    it("LA PRUEBA CLAVE: el cuerpo del proveedor no llega al SDK por ninguna vía", () => {
      reportarFallo(
        errorConCuerpoDelProveedor(),
        { proveedor: "nebius", nivel: "estandar" },
        { proveedor: "nebius" }
      );

      expect(cargadoEnviado()).not.toContain(TRANSCRIPCION);
    });

    it("LÍMITE CONOCIDO: el filtro por nombre no ve dentro de un string", () => {
      // Documenta el límite en vez de disimularlo: si alguien mete texto crudo
      // del proveedor en el contexto bajo una clave con nombre permitido, el
      // filtro NO lo detecta. Por eso `reportarFallo` nunca manda el mensaje
      // del error: la protección real está en sanitizar, no en filtrar.
      reportarFallo(
        errorConCuerpoDelProveedor(),
        { proveedor: "nebius", respuestaCruda: errorConCuerpoDelProveedor().message },
        {}
      );

      const [, opciones] = captureException.mock.calls[0] as [
        Error,
        { extra: Record<string, unknown> },
      ];
      // Esto PASA (es decir: se filtra) — queda fijado a propósito.
      expect(JSON.stringify(opciones.extra)).toContain(TRANSCRIPCION);

      // Y esto es lo que sí está garantizado: la vía real del error, cerrada.
      const [error] = captureException.mock.calls[0] as [Error];
      expect(error.message).not.toContain(TRANSCRIPCION);
      expect(String(error.stack)).not.toContain(TRANSCRIPCION);
    });

    it("no envía nada cuando SENTRY_ENABLED=false", () => {
      process.env.SENTRY_ENABLED = "false";
      reportarFallo(errorConCuerpoDelProveedor(), {}, {});
      expect(captureException).not.toHaveBeenCalled();
    });

    it("envía cuando SENTRY_ENABLED vale otra cosa", () => {
      process.env.SENTRY_ENABLED = "true";
      reportarFallo(errorConCuerpoDelProveedor(), {}, {});
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });
});
