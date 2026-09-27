import { describe, expect, it } from "vitest";
import {
  CONSOLE_BREADCRUMB_CATEGORY,
  REDACTED,
  SENSITIVE_KEYS,
  beforeSend,
  beforeSendTransaction,
  isConsoleBreadcrumb,
  isIpHeader,
  isSensitiveKey,
  scrub,
} from "@/lib/sentry-scrub";
import { IP_HEADER_NAMES, TRACE_LIFECYCLE } from "@/lib/sentry-options";

// Centinelas únicos: si alguno aparece en el JSON final, el filtro falló. Se
// afirma por VALOR además de por nombre de campo, porque un filtro que renombre
// la clave pero deje el contenido estaría tan roto como uno que no filtra.
const TRANSCRIPCION = "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA";
const COMENTARIO = "EL-PITCH-NO-EXPLICA-EL-MERCADO";
const COMENTARIO_2 = "FALTA-CIFRA-DE-TRACCION";
const TRAZA = "PASO-1-BUSQUE-EL-MERCADO";
const PREGUNTA = "CUANTO-VALE-TU-MERCADO";
const RESPUESTA = "NO-LO-TENGO-CLARO";
const VEREDICTO = "TU-PITCH-NECESITA-TRABAJO";
const AUDIO = "BLOB-DE-AUDIO-CRUDO";

/**
 * IP del cliente, por las dos vías por las que llegaba: `user.ip_address` y la
 * cabecera `x-forwarded-for`. Se afirma por valor: la IP no puede aparecer en el
 * JSON final por ningún camino.
 */
const IP_CLIENTE = "203.0.113.77";

const CENTINELAS = [
  TRANSCRIPCION,
  COMENTARIO,
  COMENTARIO_2,
  TRAZA,
  PREGUNTA,
  RESPUESTA,
  VEREDICTO,
  AUDIO,
  IP_CLIENTE,
];

/**
 * Navega la salida del filtro por una ruta de claves. Evita `any` (prohibido
 * por ESLint) sin obligar a castear en cada aserción.
 */
function leer(valor: unknown, ...ruta: string[]): unknown {
  return ruta.reduce<unknown>((actual, clave) => {
    if (Array.isArray(actual)) return actual[Number(clave)];
    if (actual && typeof actual === "object") {
      return (actual as Record<string, unknown>)[clave];
    }
    return undefined;
  }, valor);
}

/**
 * Evento con las formas reales del dominio (src/types/pitch.ts), anidado a
 * varios niveles: objetos dentro de objetos, arrays de objetos (`rubrica` y
 * `turnos`) y un array de strings (`traza`).
 */
function eventoRealista() {
  return {
    event_id: "abc123",
    message: "ErrorModelo",
    // Así llega la IP en un evento de servidor real detrás del proxy de
    // Railway: en `user.ip_address` y en la cabecera reenviada.
    user: { ip_address: IP_CLIENTE, id: "no-es-pii" },
    request: {
      url: "https://pitch-coach.focampo.com/api/analizar-pitch",
      headers: {
        host: "pitch-coach.focampo.com",
        "user-agent": "Mozilla/5.0",
        "x-forwarded-for": IP_CLIENTE,
        "X-Real-IP": IP_CLIENTE,
      },
      data: {
        transcripcion: TRANSCRIPCION,
        tipoPitch: "capital",
        nivel: "ultra",
        puntosNoCumplidosPrevios: ["Traccion"],
      },
    },
    extra: {
      proveedor: "nebius",
      modelo: "nvidia/nemotron-3-super-120b-a12b",
      statusCode: 502,
      analisis: {
        score: 72,
        veredicto_corto: VEREDICTO,
        traza: [TRAZA, "PASO-2-REVISE-LA-TRACCION"],
        // Array de objetos: la forma de `rubrica`.
        rubrica: [
          { punto: "Problema", cumplido: true, comentario: COMENTARIO },
          { punto: "Traccion", cumplido: false, comentario: COMENTARIO_2 },
        ],
      },
    },
    contexts: {
      sparring: {
        tipoPitch: "capital",
        // Array de objetos: la forma de los turnos de "Resolver hallazgos".
        turnos: [
          {
            punto: "Traccion",
            pregunta: PREGUNTA,
            respuesta: RESPUESTA,
            cumplido: false,
            comentario: COMENTARIO,
          },
        ],
      },
    },
    breadcrumbs: [
      {
        category: "fetch",
        data: {
          url: "/api/tts",
          status_code: 200,
          audio: AUDIO,
          respuesta: RESPUESTA,
        },
      },
    ],
  };
}

describe("sentry-scrub", () => {
  describe("isSensitiveKey", () => {
    it.each(SENSITIVE_KEYS)("detecta la clave '%s'", (clave) => {
      expect(isSensitiveKey(clave)).toBe(true);
    });

    it("ignora mayúsculas y minúsculas", () => {
      expect(isSensitiveKey("Transcripcion")).toBe(true);
      expect(isSensitiveKey("TRANSCRIPCION")).toBe(true);
      expect(isSensitiveKey("CoMeNtArIo")).toBe(true);
      expect(isSensitiveKey("VEREDICTO_CORTO")).toBe(true);
    });

    it("no matchea por substring", () => {
      // Si matcheara por substring, estos campos legítimos se perderían.
      expect(isSensitiveKey("comentarios_count")).toBe(false);
      expect(isSensitiveKey("respuestas_validas")).toBe(false);
      expect(isSensitiveKey("audio_bitrate")).toBe(false);
      expect(isSensitiveKey("punto")).toBe(false);
    });
  });

  describe("isIpHeader", () => {
    it.each(IP_HEADER_NAMES)("detecta la cabecera '%s'", (cabecera) => {
      expect(isIpHeader(cabecera)).toBe(true);
    });

    it("ignora mayúsculas y minúsculas", () => {
      expect(isIpHeader("X-Forwarded-For")).toBe(true);
      expect(isIpHeader("X-FORWARDED-FOR")).toBe(true);
      expect(isIpHeader("X-Real-IP")).toBe(true);
    });

    it("no matchea por substring", () => {
      // `x-forwarded-host` NO lleva la IP. Acá se decide por nombre exacto, así
      // que sobrevive — a diferencia de la denegación de DATA_COLLECTION, que
      // sí matchea por substring y lo redacta (ver sentry-options.test.ts).
      expect(isIpHeader("x-forwarded-host")).toBe(false);
      expect(isIpHeader("x-forwarded-port")).toBe(false);
      expect(isIpHeader("x-forwarded-proto")).toBe(false);
      expect(isIpHeader("user-agent")).toBe(false);
    });
  });

  describe("isConsoleBreadcrumb", () => {
    it("detecta el breadcrumb de consola", () => {
      expect(
        isConsoleBreadcrumb({
          category: "console",
          data: { arguments: ["hola"], logger: "console" },
        })
      ).toBe(true);
      expect(isConsoleBreadcrumb({ category: "Console" })).toBe(true);
      expect(CONSOLE_BREADCRUMB_CATEGORY).toBe("console");
    });

    it("no confunde otras categorías (esas sí se mandan, redactadas)", () => {
      // Un breadcrumb de fetch es el que queremos conservar: lleva método,
      // url y status, y nada del texto del usuario.
      expect(isConsoleBreadcrumb({ category: "http" })).toBe(false);
      expect(isConsoleBreadcrumb({ category: "fetch" })).toBe(false);
      expect(isConsoleBreadcrumb({ category: "navigation" })).toBe(false);
      expect(isConsoleBreadcrumb({})).toBe(false);
      expect(isConsoleBreadcrumb(null)).toBe(false);
      expect(isConsoleBreadcrumb("console")).toBe(false);
    });
  });

  describe("scrub", () => {
    it("redacta en el primer nivel", () => {
      expect(scrub({ transcripcion: TRANSCRIPCION })).toEqual({
        transcripcion: REDACTED,
      });
    });

    it("redacta en objetos anidados", () => {
      const salida = scrub({
        a: { b: { c: { veredicto_corto: VEREDICTO, score: 10 } } },
      });
      expect(leer(salida, "a", "b", "c", "veredicto_corto")).toBe(REDACTED);
      expect(leer(salida, "a", "b", "c", "score")).toBe(10);
    });

    it("redacta dentro de arrays de objetos", () => {
      const salida = scrub({
        rubrica: [
          { punto: "Problema", cumplido: true, comentario: COMENTARIO },
          { punto: "Traccion", cumplido: false, comentario: COMENTARIO_2 },
        ],
      });
      expect(leer(salida, "rubrica", "0", "comentario")).toBe(REDACTED);
      expect(leer(salida, "rubrica", "1", "comentario")).toBe(REDACTED);
      // Los campos permitidos sobreviven dentro del mismo objeto del array.
      expect(leer(salida, "rubrica", "0", "punto")).toBe("Problema");
      expect(leer(salida, "rubrica", "0", "cumplido")).toBe(true);
      expect(leer(salida, "rubrica", "1", "cumplido")).toBe(false);
    });

    it("redacta el valor completo cuando la clave es sensible, aunque sea un array", () => {
      // `traza` es string[]: se redacta el array entero, no cada elemento. Es lo
      // más seguro: no queda ni la cantidad de pasos del razonamiento.
      const salida = scrub({ traza: [TRAZA, "PASO-2"] });
      expect(leer(salida, "traza")).toBe(REDACTED);
    });

    it("no muta la entrada", () => {
      const entrada = { transcripcion: TRANSCRIPCION };
      scrub(entrada);
      expect(entrada.transcripcion).toBe(TRANSCRIPCION);
    });

    it("sobrevive a estructuras cíclicas sin colgarse", () => {
      const ciclico: Record<string, unknown> = { punto: "Problema" };
      ciclico.yo = ciclico;
      expect(() => scrub(ciclico)).not.toThrow();
    });

    it("deja pasar los valores primitivos", () => {
      expect(scrub("texto")).toBe("texto");
      expect(scrub(42)).toBe(42);
      expect(scrub(null)).toBeNull();
      expect(scrub(true)).toBe(true);
    });
  });

  describe("beforeSend", () => {
    it("no descarta el evento", () => {
      expect(beforeSend(eventoRealista())).not.toBeNull();
    });

    it("ningún centinela sensible sobrevive al evento serializado", () => {
      const serializado = JSON.stringify(beforeSend(eventoRealista()));
      for (const centinela of CENTINELAS) {
        expect(serializado).not.toContain(centinela);
      }
    });

    it("borra la IP del cliente por las dos vías por las que llega", () => {
      const salida = beforeSend(eventoRealista());

      // La asignación directa al usuario.
      expect(leer(salida, "user", "ip_address")).toBeUndefined();
      expect(leer(salida, "user", "id")).toBe("no-es-pii");
      // Las cabeceras reenviadas, en cualquier capitalización.
      expect(leer(salida, "request", "headers", "x-forwarded-for")).toBeUndefined();
      expect(leer(salida, "request", "headers", "X-Real-IP")).toBeUndefined();
      // Las cabeceras que NO llevan la IP siguen ahí: el evento no se vacía.
      expect(leer(salida, "request", "headers", "host")).toBe(
        "pitch-coach.focampo.com"
      );
      expect(leer(salida, "request", "headers", "user-agent")).toBe("Mozilla/5.0");
    });

    it("no muta las cabeceras ni el usuario de la entrada", () => {
      const entrada = eventoRealista();
      beforeSend(entrada);

      expect(entrada.request.headers["x-forwarded-for"]).toBe(IP_CLIENTE);
      expect(entrada.user.ip_address).toBe(IP_CLIENTE);
    });

    it("cubre el path de error de /api/transcribir: audio y breadcrumbs de consola", () => {
      const eventoTranscribir = {
        request: {
          url: "https://pitch-coach.focampo.com/api/transcribir",
          data: { audio: AUDIO },
        },
        extra: { proveedor: "elevenlabs", audio: AUDIO },
        breadcrumbs: [
          {
            category: "console",
            message: `[/api/transcribir] fallo ElevenLabs: ${AUDIO}`,
            data: { arguments: ["[/api/transcribir] fallo ElevenLabs:", AUDIO] },
          },
          {
            category: "fetch",
            data: { url: "/api/transcribir", audio: AUDIO, status_code: 502 },
          },
        ],
      };

      const salida = beforeSend(eventoTranscribir);
      const serializado = JSON.stringify(salida);
      expect(serializado).not.toContain(AUDIO);
      expect(leer(salida, "request", "data", "audio")).toBe(REDACTED);
      expect(leer(salida, "extra", "audio")).toBe(REDACTED);
      expect(leer(salida, "extra", "proveedor")).toBe("elevenlabs");
      const breadcrumbs = leer(salida, "breadcrumbs") as unknown[];
      expect(breadcrumbs).toHaveLength(1);
      expect(leer(breadcrumbs, "0", "data", "audio")).toBe(REDACTED);
    });

    it("REGRESIÓN: descarta el breadcrumb de consola que filtró el pitch", () => {
      // La fuga real, reproducida contra `npm run dev` con un proveedor que
      // devolvía eco: el `console.error` del catch de la ruta graba el mensaje
      // de `ErrorModelo`, que arrastra el cuerpo de respuesta del proveedor —y
      // ese cuerpo repite la petición, con la transcripción—. Sentry serializa
      // el Error entero dentro de `data.arguments`.
      //
      // Por eso este test NO se conforma con que el filtro redacte: comprueba
      // que ese breadcrumb no sale, y además fija POR QUÉ, que es que el filtro
      // por nombre no puede ver dentro de un string.
      const errorDelProveedor = new Error(
        `El modelo respondió con error 400: recibido {"transcripcion":"${TRANSCRIPCION}"}`
      );
      const breadcrumbDeConsola = {
        category: "console",
        level: "error",
        message: `[/api/analizar-pitch] fallo el análisis: ${errorDelProveedor.message}`,
        data: {
          arguments: ["[/api/analizar-pitch] fallo el análisis:", errorDelProveedor],
          logger: "console",
        },
      };

      // 1) El filtro por nombre, solo, NO alcanza: el texto va dentro de un
      //    string, y `scrub` decide por nombre de propiedad.
      const soloScrub = JSON.stringify(scrub(breadcrumbDeConsola));
      expect(soloScrub).toContain(TRANSCRIPCION);

      // 2) Con beforeSend, el breadcrumb de consola no sale.
      const conConsola = beforeSend({
        breadcrumbs: [
          breadcrumbDeConsola,
          { category: "http", data: { url: "https://api/chat", status_code: 400 } },
        ],
      });
      const serializado = JSON.stringify(conConsola);
      expect(serializado).not.toContain(TRANSCRIPCION);
      expect(serializado).not.toContain("El modelo respondió con error");

      // 3) Y no se lleva puesto lo útil: el de fetch sobrevive, redactado.
      const breadcrumbs = leer(conConsola, "breadcrumbs") as unknown[];
      expect(breadcrumbs).toHaveLength(1);
      expect(leer(breadcrumbs, "0", "category")).toBe("http");
      expect(leer(breadcrumbs, "0", "data", "status_code")).toBe(400);
    });

    it("aplica el mismo descarte en beforeSendTransaction", () => {
      // Los eventos de transacción también llevan breadcrumbs, así que el
      // descarte tiene que estar en los dos callbacks. Es la razón por la que
      // TRACE_LIFECYCLE es "static": sin transacciones, este callback no corría.
      expect(TRACE_LIFECYCLE).toBe("static");

      const salida = beforeSendTransaction({
        breadcrumbs: [
          {
            category: "console",
            data: { arguments: ["error:", TRANSCRIPCION] },
          },
          { category: "http", data: { status_code: 200 } },
        ],
      });
      const serializado = JSON.stringify(salida);
      expect(serializado).not.toContain(TRANSCRIPCION);
      expect(leer(salida, "breadcrumbs") as unknown[]).toHaveLength(1);
    });

    it("no agrega `user` cuando el evento no lo trae", () => {
      // `beforeSend` es genérico sobre la forma mínima que tocamos, así que un
      // evento de prueba tiene que compartir al menos una clave con esa forma.
      const eventoMinimo = { extra: { proveedor: "nebius" } };
      const salida = beforeSend(eventoMinimo);

      expect(leer(salida, "user")).toBeUndefined();
      // Tampoco se agregan claves nuevas: el objeto queda con las que tenía.
      expect(Object.keys(salida as object)).toEqual(["extra"]);
      expect(leer(salida, "extra", "proveedor")).toBe("nebius");
    });

    it("limpia las cinco superficies: request.data, request.headers, extra, contexts y breadcrumbs", () => {
      const salida = beforeSend(eventoRealista());

      expect(leer(salida, "request", "data", "transcripcion")).toBe(REDACTED);
      expect(leer(salida, "extra", "analisis", "veredicto_corto")).toBe(REDACTED);
      expect(leer(salida, "extra", "analisis", "traza")).toBe(REDACTED);
      expect(leer(salida, "extra", "analisis", "rubrica", "0", "comentario")).toBe(
        REDACTED
      );
      expect(leer(salida, "contexts", "sparring", "turnos", "0", "pregunta")).toBe(
        REDACTED
      );
      expect(leer(salida, "contexts", "sparring", "turnos", "0", "respuesta")).toBe(
        REDACTED
      );
      expect(leer(salida, "contexts", "sparring", "turnos", "0", "comentario")).toBe(
        REDACTED
      );
      expect(leer(salida, "breadcrumbs", "0", "data", "audio")).toBe(REDACTED);
      expect(leer(salida, "breadcrumbs", "0", "data", "respuesta")).toBe(REDACTED);
    });

    it("conserva intactos los campos permitidos, en todos los niveles", () => {
      const salida = beforeSend(eventoRealista());

      // Metadatos operativos: son justamente los que hacen útil el evento.
      expect(leer(salida, "extra", "proveedor")).toBe("nebius");
      expect(leer(salida, "extra", "modelo")).toBe(
        "nvidia/nemotron-3-super-120b-a12b"
      );
      expect(leer(salida, "extra", "statusCode")).toBe(502);
      expect(leer(salida, "extra", "analisis", "score")).toBe(72);
      expect(leer(salida, "request", "data", "tipoPitch")).toBe("capital");
      expect(leer(salida, "request", "data", "nivel")).toBe("ultra");
      // Nombres de puntos de rúbrica: son texto de producto, no del usuario.
      expect(leer(salida, "request", "data", "puntosNoCumplidosPrevios")).toEqual([
        "Traccion",
      ]);
      expect(leer(salida, "extra", "analisis", "rubrica", "0", "punto")).toBe(
        "Problema"
      );
      expect(leer(salida, "contexts", "sparring", "tipoPitch")).toBe("capital");
      expect(leer(salida, "breadcrumbs", "0", "data", "status_code")).toBe(200);
      expect(leer(salida, "breadcrumbs", "0", "category")).toBe("fetch");
      // Lo que no es dato de usuario sigue su curso.
      expect(leer(salida, "event_id")).toBe("abc123");
      expect(leer(salida, "message")).toBe("ErrorModelo");
    });

    it("mantiene la forma del evento (no borra las claves, las redacta)", () => {
      const salida = beforeSend(eventoRealista());
      expect(Object.keys(leer(salida, "extra", "analisis", "rubrica", "0") as object))
        .toEqual(expect.arrayContaining(["punto", "cumplido", "comentario"]));
    });
  });

  describe("beforeSendTransaction", () => {
    it("aplica el mismo filtro a los eventos de traza", () => {
      const salida = beforeSendTransaction(eventoRealista());
      const serializado = JSON.stringify(salida);
      for (const centinela of CENTINELAS) {
        expect(serializado).not.toContain(centinela);
      }
      expect(leer(salida, "extra", "proveedor")).toBe("nebius");
    });
  });
});
