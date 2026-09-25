import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_SOLICITUDES,
  VENTANA_MS,
  consumir,
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
