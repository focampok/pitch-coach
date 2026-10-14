import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consumir,
  encabezadoCookie,
  leerCupo,
  puedeGastar,
  restantes,
  serializarCookie,
  type Cupo,
} from "@/lib/cupo-evaluacion";
import {
  contactoEvaluacion,
  demoEnVivo,
  limiteEvaluacion,
  secretoCookieEvaluacion,
  urlVideoDemo,
  verificarDemoActiva,
} from "@/lib/config-evaluacion";
import { diccionario } from "@/lib/diccionarios";

const SECRETO = "test-eval-cookie-secret-32bytes-min";

function conCookie(valor: string | null): Request {
  const headers = new Headers();
  if (valor !== null) headers.set("cookie", `pc_eval=${valor}`);
  return new Request("http://localhost/", { headers });
}

function cupo(usadas: number, sid = "sid-fijo"): Cupo {
  return { v: 1, sid, usadas, iat: 1_700_000_000 };
}

beforeEach(() => {
  process.env.EVAL_LIMIT = "10";
  process.env.EVAL_COOKIE_SECRET = SECRETO;
  process.env.LIVE_DEMO = "true";
  delete process.env.DEMO_VIDEO_URL;
  delete process.env.CONTACTO;
});

afterEach(() => {
  delete process.env.EVAL_LIMIT;
  delete process.env.EVAL_COOKIE_SECRET;
  delete process.env.DEMO_VIDEO_URL;
  delete process.env.CONTACTO;
  process.env.LIVE_DEMO = "true";
});

describe("cookie del cupo", () => {
  it("firma y verifica de ida y vuelta", () => {
    const original = cupo(4, "sid-ida");
    const valor = serializarCookie(original);
    const leido = leerCupo(conCookie(valor));
    expect(leido).toEqual(original);
    expect(serializarCookie(leido)).toBe(valor);
    expect(restantes(leido)).toBe(6);
  });

  it("una cookie alterada en el payload abre un cupo nuevo y finito", () => {
    const valor = serializarCookie(cupo(7, "sid-original"));
    const [payload, firma] = valor.split(".");
    const ultimo = payload.slice(-1) === "a" ? "b" : "a";
    const alterado = `${payload.slice(0, -1)}${ultimo}.${firma}`;
    const leido = leerCupo(conCookie(alterado));
    expect(leido.sid).not.toBe("sid-original");
    expect(leido.usadas).toBe(0);
    expect(restantes(leido)).toBe(10);
    expect(puedeGastar(leido, 1)).toBe(true);
    expect(puedeGastar(leido, 11)).toBe(false);
  });

  it("una firma alterada no se acepta", () => {
    const valor = serializarCookie(cupo(3, "sid-firma"));
    const [payload, firma] = valor.split(".");
    const ultimo = firma.slice(-1) === "a" ? "b" : "a";
    const leido = leerCupo(conCookie(`${payload}.${firma.slice(0, -1)}${ultimo}`));
    expect(leido.sid).not.toBe("sid-firma");
    expect(leido.usadas).toBe(0);
    expect(restantes(leido)).toBe(10);
  });

  it("una cookie malformada abre un cupo nuevo, sin tirar", () => {
    for (const valor of ["no-hay-punto", "a.b.c", "", "@@@.@@@", "solo-payload."]) {
      const leido = leerCupo(conCookie(valor));
      expect(leido.usadas).toBe(0);
      expect(restantes(leido)).toBe(10);
    }
    const ausente = leerCupo(conCookie(null));
    expect(ausente.usadas).toBe(0);
    expect(restantes(ausente)).toBe(10);
  });

  it("normaliza usadas negativa o por encima del límite", () => {
    const negativa = leerCupo(conCookie(serializarCookie(cupo(-4, "sid-neg"))));
    expect(negativa.sid).toBe("sid-neg");
    expect(negativa.usadas).toBe(0);
    expect(restantes(negativa)).toBe(10);

    const pasada = leerCupo(conCookie(serializarCookie(cupo(40, "sid-tope"))));
    expect(pasada.sid).toBe("sid-tope");
    expect(pasada.usadas).toBe(10);
    expect(restantes(pasada)).toBe(0);
    expect(puedeGastar(pasada, 1)).toBe(false);
  });

  it("consumir no baja de 0 ni pasa del límite", () => {
    expect(consumir(cupo(0), 0)).toEqual(cupo(0));
    expect(consumir(cupo(0), -3)).toEqual(cupo(0));
    expect(consumir(cupo(3), 1).usadas).toBe(4);
    expect(consumir(cupo(10), 1).usadas).toBe(10);
    expect(consumir(cupo(9), 5).usadas).toBe(10);
    expect(restantes(consumir(cupo(10), 1))).toBe(0);
  });

  it("la cabecera es HttpOnly, SameSite=Lax, Path=/ y Secure solo en producción", () => {
    const header = encabezadoCookie(cupo(1));
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=2592000");
    expect(header).not.toContain("Secure");
    expect(header).not.toContain(SECRETO);

    const previo = process.env.NODE_ENV;
    const entorno = process.env as { NODE_ENV?: string };
    entorno.NODE_ENV = "production";
    try {
      expect(encabezadoCookie(cupo(1))).toContain("Secure");
    } finally {
      entorno.NODE_ENV = previo;
    }
  });
});

describe("límite y pausa leídos en runtime", () => {
  it("EVAL_LIMIT vacío, 0 o inválido es ilimitado", () => {
    for (const valor of [undefined, "", "0", "00", "10.5", "no", "-3", "  ", "+10"]) {
      if (valor === undefined) delete process.env.EVAL_LIMIT;
      else process.env.EVAL_LIMIT = valor;
      expect(limiteEvaluacion()).toBeNull();
      expect(puedeGastar(cupo(100), 1)).toBe(true);
      expect(restantes(cupo(100))).toBeNull();
    }
    process.env.EVAL_LIMIT = " 10 ";
    expect(limiteEvaluacion()).toBe(10);
  });

  it("LIVE_DEMO solo es true con la cadena exacta", () => {
    process.env.LIVE_DEMO = "true";
    expect(demoEnVivo()).toBe(true);
    expect(verificarDemoActiva("es")).toBeNull();

    for (const valor of [undefined, "", "false", "TRUE", "1", "yes"]) {
      if (valor === undefined) delete process.env.LIVE_DEMO;
      else process.env.LIVE_DEMO = valor;
      expect(demoEnVivo()).toBe(false);
      const respuesta = verificarDemoActiva("en");
      expect(respuesta?.status).toBe(503);
    }
  });

  it("el 503 de la pausa trae el texto del idioma y no llama a un proveedor", async () => {
    delete process.env.LIVE_DEMO;
    const respuesta = verificarDemoActiva("es");
    expect(respuesta).not.toBeNull();
    const cuerpo = (await respuesta!.json()) as { error: string; mensaje: string };
    expect(cuerpo.error).toBe("demo_pausada");
    expect(cuerpo.mensaje).toBe(diccionario("es").evaluacion.demoPausada);

    process.env.LIVE_DEMO = "false";
    const en = verificarDemoActiva("en");
    const cuerpoEn = (await en!.json()) as { mensaje: string };
    expect(cuerpoEn.mensaje).toBe(diccionario("en").evaluacion.demoPausada);
  });

  it("el secreto corto o ausente no cuenta como configurado y no se devuelve", () => {
    delete process.env.EVAL_COOKIE_SECRET;
    expect(secretoCookieEvaluacion()).toBeNull();
    process.env.EVAL_COOKIE_SECRET = "corto";
    expect(secretoCookieEvaluacion()).toBeNull();
    process.env.EVAL_COOKIE_SECRET = SECRETO;
    expect(secretoCookieEvaluacion()).toBe(SECRETO);
  });

  it("la URL del video y el contacto se ocultan si no sirven", () => {
    expect(urlVideoDemo()).toBeNull();
    expect(contactoEvaluacion()).toBeNull();
    process.env.DEMO_VIDEO_URL = "javascript:alert(1)";
    expect(urlVideoDemo()).toBeNull();
    process.env.DEMO_VIDEO_URL = "no es url";
    expect(urlVideoDemo()).toBeNull();
    process.env.DEMO_VIDEO_URL = "https://example.com/demo";
    expect(urlVideoDemo()).toBe("https://example.com/demo");
    process.env.CONTACTO = "  hola@example.com  ";
    expect(contactoEvaluacion()).toBe("hola@example.com");
    process.env.CONTACTO = "";
    expect(contactoEvaluacion()).toBeNull();
  });
});
