import { describe, expect, it } from "vitest";
import {
  DATA_COLLECTION,
  DEFAULT_ENVIRONMENT,
  IP_HEADER_NAMES,
  TRACE_LIFECYCLE,
  TRACE_PROPAGATION_TARGETS,
  sentryEnabled,
  sentryEnvironment,
  sentryTracesSampleRate,
} from "@/lib/sentry-options";

describe("sentry-options", () => {
  describe("sentryEnvironment", () => {
    it("prioriza SENTRY_ENVIRONMENT sobre NODE_ENV", () => {
      expect(
        sentryEnvironment({
          SENTRY_ENVIRONMENT: "staging",
          NODE_ENV: "production",
        })
      ).toBe("staging");
    });

    it("cae a NODE_ENV cuando no hay SENTRY_ENVIRONMENT", () => {
      expect(sentryEnvironment({ NODE_ENV: "development" })).toBe("development");
    });

    it("trata la cadena vacía como ausente (por eso se usa || y no ??)", () => {
      // Este es el caso real: una variable definida pero vacía en .env.local
      // llega como "" y `??` la dejaría pasar, reportando un entorno vacío.
      expect(
        sentryEnvironment({
          SENTRY_ENVIRONMENT: "",
          NODE_ENV: "development",
        })
      ).toBe("development");

      expect(sentryEnvironment({ SENTRY_ENVIRONMENT: "" })).toBe(
        DEFAULT_ENVIRONMENT
      );
    });

    it("usa 'production' como último recurso", () => {
      expect(sentryEnvironment({})).toBe("production");
      expect(DEFAULT_ENVIRONMENT).toBe("production");
    });
  });

  describe("sentryEnabled", () => {
    it("viene encendido por defecto", () => {
      expect(sentryEnabled({})).toBe(true);
    });

    it("se apaga solo con la cadena exacta 'false'", () => {
      expect(sentryEnabled({ SENTRY_ENABLED: "false" })).toBe(false);
      // Otros valores no lo apagan: el default es encendido.
      expect(sentryEnabled({ SENTRY_ENABLED: "true" })).toBe(true);
      expect(sentryEnabled({ SENTRY_ENABLED: "0" })).toBe(true);
      expect(sentryEnabled({ SENTRY_ENABLED: "" })).toBe(true);
      expect(sentryEnabled({ SENTRY_ENABLED: "False" })).toBe(true);
    });
  });

  describe("sentryTracesSampleRate", () => {
    it("muestrea todo en desarrollo", () => {
      expect(sentryTracesSampleRate("development")).toBe(1.0);
    });

    it("muestrea una de cada diez fuera de desarrollo", () => {
      expect(sentryTracesSampleRate("production")).toBe(0.1);
      expect(sentryTracesSampleRate("staging")).toBe(0.1);
    });
  });

  describe("DATA_COLLECTION", () => {
    it("apaga la recolección de datos de usuario (es lo que frena la IP)", () => {
      // Si esto se pone en true, el SDK vuelve a setear `user.ip_address`.
      expect(DATA_COLLECTION.userInfo).toBe(false);
    });

    it("deniega las cabeceras de IP en los spans", () => {
      // `userInfo: false` solo no alcanza: los atributos
      // `http.request.header.*` de los spans se filtran por
      // `dataCollection.httpHeaders.request`, no por `include.ip`.
      const deny = DATA_COLLECTION.httpHeaders.request.deny;
      for (const cabecera of IP_HEADER_NAMES) {
        expect(deny).toContain(cabecera);
      }
      expect(deny).toContain("x-forwarded-for");
      expect(deny).toContain("x-real-ip");
    });

    it("no nombra otras categorías (no cambia nada más de lo que ya estaba)", () => {
      // Cada campo no nombrado cae a su default, que es el que ya estaba
      // activo. Si alguien agrega una categoría acá, este test obliga a
      // revisar el efecto (ver el comentario de DATA_COLLECTION).
      expect(Object.keys(DATA_COLLECTION).sort()).toEqual([
        "httpHeaders",
        "userInfo",
      ]);
      expect(Object.keys(DATA_COLLECTION.httpHeaders)).toEqual(["request"]);
    });
  });

  describe("IP_HEADER_NAMES", () => {
    it("incluye las cabeceras de IP que usa el SDK", () => {
      // Misma lista que ipHeaderNames de
      // @sentry/core/build/cjs/vendor/getIpAddress.js.
      for (const esperada of [
        "x-forwarded-for",
        "x-real-ip",
        "forwarded",
        "cf-connecting-ip",
        "true-client-ip",
      ]) {
        expect(IP_HEADER_NAMES).toContain(esperada);
      }
    });

    it("están todas en minúsculas (la comparación del filtro lo asume)", () => {
      for (const cabecera of IP_HEADER_NAMES) {
        expect(cabecera).toBe(cabecera.toLowerCase());
      }
    });
  });

  describe("TRACE_LIFECYCLE", () => {
    it('es "static", que es lo que hace correr a beforeSendTransaction', () => {
      // Con el default del SDK ("stream"), beforeSendTransaction no se ejecuta:
      // el SDK lo ignora y lo dice por consola. El filtro de transacciones
      // quedaría como código muerto. Ver el porqué completo en
      // src/lib/sentry-options.ts.
      expect(TRACE_LIFECYCLE).toBe("static");
    });

    it("es un valor que el SDK entiende (cualquier otra cosa cae a 'stream')", () => {
      // client.js: traceLifecycle === "static" ? "static" : "stream". Un typo
      // acá no falla el build: degrada en silencio al modo que ignora el
      // callback. Este test es la única barrera contra eso.
      expect(["static", "stream"]).toContain(TRACE_LIFECYCLE);
    });
  });

  describe("TRACE_PROPAGATION_TARGETS", () => {
    it("incluye los dos dominios de producción", () => {
      expect(TRACE_PROPAGATION_TARGETS).toEqual([
        "https://pitch-coach.focampo.com",
        "https://pitch-coach-production-1c0c.up.railway.app",
      ]);
    });
  });
});
