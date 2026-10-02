import { beforeEach, describe, expect, it } from "vitest";

import {
  LIMITES_POR_AMBITO,
  MAX_SOLICITUDES,
  VENTANA_MS,
  consumir,
  maximoDe,
  reiniciar,
} from "@/lib/rate-limit";

describe("rate limit en memoria", () => {
  beforeEach(() => {
    reiniciar();
  });

  it("permite hasta el máximo de solicitudes por clave", () => {
    for (let i = 0; i < MAX_SOLICITUDES; i++) {
      expect(consumir("ip:1", 0).permitido).toBe(true);
    }
  });

  it("bloquea la solicitud que excede el máximo", () => {
    for (let i = 0; i < MAX_SOLICITUDES; i++) consumir("ip:1", 0);

    const resultado = consumir("ip:1", 0);
    expect(resultado.permitido).toBe(false);
    expect(resultado.restantes).toBe(0);
    expect(resultado.retryAfterSegundos).toBeGreaterThan(0);
  });

  it("libera la clave cuando la ventana caduca", () => {
    for (let i = 0; i < MAX_SOLICITUDES; i++) consumir("ip:1", 0);
    expect(consumir("ip:1", 0).permitido).toBe(false);

    // Justo después de que la ventana expire, vuelve a permitir.
    expect(consumir("ip:1", VENTANA_MS + 1).permitido).toBe(true);
  });

  it("lleva contadores independientes por clave", () => {
    for (let i = 0; i < MAX_SOLICITUDES; i++) consumir("ip:1", 0);

    expect(consumir("ip:1", 0).permitido).toBe(false);
    expect(consumir("ip:2", 0).permitido).toBe(true);
  });

  it("descarta las marcas antiguas al contar dentro de la ventana", () => {
    // 5 marcas al inicio y 5 a mitad de ventana (10 en total, ventana llena)...
    for (let i = 0; i < MAX_SOLICITUDES / 2; i++) consumir("ip:1", 0);
    for (let i = 0; i < MAX_SOLICITUDES / 2; i++) {
      consumir("ip:1", VENTANA_MS / 2);
    }
    // ...justo después de que caducan las 5 primeras, vuelve a haber cupo.
    expect(consumir("ip:1", VENTANA_MS + 1).permitido).toBe(true);
  });
});

describe("límite por ámbito (costo real por invocación)", () => {
  beforeEach(() => {
    reiniciar();
  });

  it("enriquecer tiene un techo propio, más bajo que el global", () => {
    // Decisión explícita de la Fase A: la ruta dispara 2+ llamadas externas por
    // invocación (Nano + hasta una búsqueda de Tavily por punto) y con el techo
    // global de 10 vaciaría el free tier de Tavily en horas de abuso.
    expect(LIMITES_POR_AMBITO.enriquecer).toBe(5);
    expect(maximoDe("enriquecer")).toBe(5);
    expect(maximoDe("analizar-pitch")).toBe(MAX_SOLICITUDES);
    expect(maximoDe("tts")).toBe(MAX_SOLICITUDES);
  });

  it("consumir respeta un máximo inyectado", () => {
    for (let i = 0; i < 5; i++) {
      expect(consumir("enriquecer:ip:1", 0, maximoDe("enriquecer")).permitido).toBe(
        true,
      );
    }

    const sexta = consumir("enriquecer:ip:1", 0, maximoDe("enriquecer"));
    expect(sexta.permitido).toBe(false);
    expect(sexta.restantes).toBe(0);
  });

  it("un ámbito con techo bajo no afecta al techo global de otro ámbito", () => {
    for (let i = 0; i < maximoDe("enriquecer"); i++) {
      consumir("enriquecer:ip:1", 0, maximoDe("enriquecer"));
    }
    expect(consumir("enriquecer:ip:1", 0, maximoDe("enriquecer")).permitido).toBe(
      false,
    );

    // Otra ruta, misma IP: sigue con su propio cupo de 10.
    for (let i = 0; i < MAX_SOLICITUDES; i++) {
      expect(consumir("analizar-pitch:ip:1", 0, maximoDe("analizar-pitch")).permitido).toBe(
        true,
      );
    }
  });
});
