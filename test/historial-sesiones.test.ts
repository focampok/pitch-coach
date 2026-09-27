import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLAVE_HISTORIAL_SESIONES,
  MAX_SESIONES_GUARDADAS,
  actualizarSesion,
  agregarSesion,
  borrarHistorial,
  construirSesionGuardada,
  nombresNoCumplidosPrevios,
  obtenerSesiones,
} from "@/lib/historial-sesiones";
import { calcularScore } from "@/lib/validar-analisis";
import type { HallazgosHistorial, SesionGuardada } from "@/types/historial";
import type { ResultadoAnalisis } from "@/types/pitch";

const SECRETOS = [
  "COMENTARIO_SECRETO",
  "TRAZA_SECRETA",
  "PREGUNTA_SECRETA",
  "RESPUESTA_SECRETA",
  "TRANSCRIPCION_SECRETA",
  "VEREDICTO_SECRETO",
  "AUDIO_SECRETO",
];

function memoria(): Storage {
  const mapa = new Map<string, string>();
  return {
    get length() {
      return mapa.size;
    },
    clear() {
      mapa.clear();
    },
    getItem(clave: string) {
      return mapa.has(clave) ? (mapa.get(clave) ?? null) : null;
    },
    key(indice: number) {
      return [...mapa.keys()][indice] ?? null;
    },
    removeItem(clave: string) {
      mapa.delete(clave);
    },
    setItem(clave: string, valor: string) {
      mapa.set(clave, valor);
    },
  };
}

function sesion(fecha: string, cambios: Partial<SesionGuardada> = {}): SesionGuardada {
  return {
    fecha,
    tipoPitch: "capital",
    duracionMaxima: 3,
    score: 46,
    claridad: 14,
    rubrica: [
      { punto: "Problema claro", cumplido: true },
      { punto: "El ask", cumplido: false },
    ],
    muletillas: { "o sea": 2 },
    ultraUsado: false,
    ...cambios,
  };
}

function crudo(): string {
  return localStorage.getItem(CLAVE_HISTORIAL_SESIONES) ?? "";
}

function expectSinSecretos(texto: string): void {
  for (const secreto of SECRETOS) {
    expect(texto).not.toContain(secreto);
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoria());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("historial de sesiones", () => {
  it("agrega y lee la sesión más reciente primero", () => {
    agregarSesion(sesion("2026-09-27T10:00:00.000Z"));
    agregarSesion(sesion("2026-09-27T11:00:00.000Z", { score: 80, claridad: 20 }));

    const sesiones = obtenerSesiones();
    expect(sesiones.map((item) => item.fecha)).toEqual([
      "2026-09-27T11:00:00.000Z",
      "2026-09-27T10:00:00.000Z",
    ]);
    expect(sesiones[0]?.score).toBe(80);
  });

  it("conserva solo las últimas 20 y descarta las más antiguas", () => {
    for (let i = 1; i <= MAX_SESIONES_GUARDADAS + 1; i += 1) {
      agregarSesion(sesion(String(i)));
    }
    const fechas = obtenerSesiones().map((item) => item.fecha);
    expect(fechas).toHaveLength(MAX_SESIONES_GUARDADAS);
    expect(fechas[0]).toBe(String(MAX_SESIONES_GUARDADAS + 1));
    expect(fechas).not.toContain("1");
    expect(fechas.at(-1)).toBe("2");
  });

  it("borrarHistorial deja el almacenamiento vacío", () => {
    agregarSesion(sesion("2026-09-27T10:00:00.000Z"));
    borrarHistorial();
    expect(obtenerSesiones()).toEqual([]);
    expect(localStorage.getItem(CLAVE_HISTORIAL_SESIONES)).toBeNull();
  });

  it("descarta JSON corrupto y arranca de cero", () => {
    localStorage.setItem(CLAVE_HISTORIAL_SESIONES, "{esto no es json");
    expect(obtenerSesiones()).toEqual([]);
    expect(localStorage.getItem(CLAVE_HISTORIAL_SESIONES)).toBeNull();
  });

  it("descarta un valor que no es un array", () => {
    localStorage.setItem(
      CLAVE_HISTORIAL_SESIONES,
      JSON.stringify({ transcripcion: "TRANSCRIPCION_SECRETA" }),
    );
    expect(obtenerSesiones()).toEqual([]);
    expect(localStorage.getItem(CLAVE_HISTORIAL_SESIONES)).toBeNull();
  });

  it("no lanza si localStorage no está disponible", () => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(obtenerSesiones()).toEqual([]);
    expect(() => agregarSesion(sesion("1"))).not.toThrow();
    expect(() => borrarHistorial()).not.toThrow();
    expect(() => actualizarSesion("1", { ultraUsado: true })).not.toThrow();
  });

  it("no lanza si leer o escribir el storage falla", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("modo privado");
      },
      setItem() {
        throw new Error("cuota excedida");
      },
      removeItem() {
        throw new Error("modo privado");
      },
    });
    expect(obtenerSesiones()).toEqual([]);
    expect(() => agregarSesion(sesion("1"))).not.toThrow();
    expect(() => borrarHistorial()).not.toThrow();
  });

  it("actualiza la sesión por su fecha y no crea otra", () => {
    agregarSesion(sesion("vieja"));
    agregarSesion(sesion("actual"));
    actualizarSesion("actual", { ultraUsado: true });
    const sesiones = obtenerSesiones();
    expect(sesiones).toHaveLength(2);
    expect(sesiones[0]?.ultraUsado).toBe(true);
    expect(sesiones[1]?.ultraUsado).toBe(false);
  });

  it("reconstruye la claridad y no copia texto del análisis", () => {
    const resultado: ResultadoAnalisis = {
      score: 46,
      veredicto_corto: "VEREDICTO_SECRETO",
      rubrica: [
        { punto: "Problema claro", cumplido: true, comentario: "COMENTARIO_SECRETO" },
        { punto: "Tamaño del mercado / oportunidad", cumplido: false, comentario: "COMENTARIO_SECRETO" },
        { punto: "Solución / diferenciador", cumplido: true, comentario: "COMENTARIO_SECRETO" },
        { punto: "Tracción o evidencia", cumplido: false, comentario: "COMENTARIO_SECRETO" },
        { punto: "El ask", cumplido: false, comentario: "COMENTARIO_SECRETO" },
      ],
      muletillas: { "o sea": 2 },
      tiempo_real_segundos: 40,
      tiempo_maximo_segundos: 180,
      traza: ["TRAZA_SECRETA"],
    };
    const guardada = construirSesionGuardada({
      fecha: "2026-09-27T12:00:00.000Z",
      tipoPitch: "capital",
      duracionMaxima: 3,
      resultado,
    });
    const cumplidos = resultado.rubrica.filter((item) => item.cumplido).length;
    const cobertura = calcularScore(cumplidos, resultado.rubrica.length, 0);
    expect(guardada?.claridad).toBe(resultado.score - cobertura);
    expect(guardada?.ultraUsado).toBe(false);
    expect(guardada?.rubrica).toEqual([
      { punto: "Problema claro", cumplido: true },
      { punto: "Tamaño del mercado / oportunidad", cumplido: false },
      { punto: "Solución / diferenciador", cumplido: true },
      { punto: "Tracción o evidencia", cumplido: false },
      { punto: "El ask", cumplido: false },
    ]);
    expectSinSecretos(JSON.stringify(guardada));
  });

  it("la claridad reconstruida sigue a calcularScore si cambia COBERTURA_MAXIMA", () => {
    const rubrica: ResultadoAnalisis["rubrica"] = [
      { punto: "Problema claro", cumplido: true, comentario: "" },
      { punto: "Tamaño del mercado / oportunidad", cumplido: false, comentario: "" },
      { punto: "Solución / diferenciador", cumplido: true, comentario: "" },
      { punto: "Tracción o evidencia", cumplido: false, comentario: "" },
      { punto: "El ask", cumplido: false, comentario: "" },
    ];
    const claridad = 14;
    const cumplidos = rubrica.filter((item) => item.cumplido).length;
    const score = calcularScore(cumplidos, rubrica.length, claridad);
    const guardada = construirSesionGuardada({
      fecha: "2026-09-27T13:00:00.000Z",
      tipoPitch: "capital",
      duracionMaxima: 3,
      resultado: {
        score,
        veredicto_corto: "ok",
        rubrica,
        muletillas: {},
        tiempo_real_segundos: 40,
        tiempo_maximo_segundos: 180,
      },
    });
    expect(guardada?.claridad).toBe(claridad);
    expect(guardada?.score).toBe(score);
  });

  it("no serializa comentario, traza, pregunta, respuesta ni transcripción", () => {
    const contaminada = {
      ...sesion("2026-09-27T12:00:00.000Z"),
      comentario: "COMENTARIO_SECRETO",
      traza: ["TRAZA_SECRETA"],
      pregunta: "PREGUNTA_SECRETA",
      respuesta: "RESPUESTA_SECRETA",
      transcripcion: "TRANSCRIPCION_SECRETA",
      veredicto_corto: "VEREDICTO_SECRETO",
      audio: "AUDIO_SECRETO",
      rubrica: [
        {
          punto: "Problema claro",
          cumplido: false,
          comentario: "COMENTARIO_SECRETO",
        },
      ],
      muletillas: { "o sea": 2, nota: "TRANSCRIPCION_SECRETA" },
      hallazgos: {
        preguntasHechas: 1,
        puntosReforzados: 0,
        pregunta: "PREGUNTA_SECRETA",
        respuesta: "RESPUESTA_SECRETA",
        comentario: "COMENTARIO_SECRETO",
        puntos: [
          {
            punto: "El ask",
            cumplido: false,
            pregunta: "PREGUNTA_SECRETA",
            respuesta: "RESPUESTA_SECRETA",
            comentario: "COMENTARIO_SECRETO",
          },
        ],
      },
    } as unknown as SesionGuardada;

    agregarSesion(contaminada);
    expectSinSecretos(crudo());

    const guardada = obtenerSesiones()[0];
    expect(Object.keys(guardada ?? {}).sort()).toEqual(
      [
        "claridad",
        "duracionMaxima",
        "fecha",
        "hallazgos",
        "muletillas",
        "rubrica",
        "score",
        "tipoPitch",
        "ultraUsado",
      ].sort(),
    );
    expect(Object.keys(guardada?.rubrica[0] ?? {}).sort()).toEqual(["cumplido", "punto"]);
    expect(Object.keys(guardada?.hallazgos ?? {}).sort()).toEqual([
      "preguntasHechas",
      "puntos",
      "puntosReforzados",
    ]);
    expect(Object.keys(guardada?.hallazgos?.puntos[0] ?? {}).sort()).toEqual([
      "cumplido",
      "punto",
    ]);
    expect(guardada?.muletillas).toEqual({ "o sea": 2 });

    actualizarSesion("2026-09-27T12:00:00.000Z", {
      ultraUsado: true,
      hallazgos: {
        preguntasHechas: 1,
        puntosReforzados: 1,
        puntos: [
          {
            punto: "El ask",
            cumplido: true,
            respuesta: "RESPUESTA_SECRETA",
            comentario: "COMENTARIO_SECRETO",
          },
        ],
      } as unknown as HallazgosHistorial,
    });
    expectSinSecretos(crudo());
    expect(obtenerSesiones()[0]?.hallazgos?.puntos).toEqual([
      { punto: "El ask", cumplido: true },
    ]);
  });

  it("al leer, reescribe una entrada que traía campos de más", () => {
    localStorage.setItem(
      CLAVE_HISTORIAL_SESIONES,
      JSON.stringify([
        {
          ...sesion("2026-09-27T12:00:00.000Z"),
          transcripcion: "TRANSCRIPCION_SECRETA",
          traza: ["TRAZA_SECRETA"],
        },
      ]),
    );
    expect(obtenerSesiones()).toHaveLength(1);
    expectSinSecretos(crudo());
  });

  it("nombresNoCumplidosPrevios devuelve solo puntos no cubiertos del mismo tipo", () => {
    agregarSesion(
      sesion("vieja", {
        rubrica: [{ punto: "Problema claro", cumplido: false }],
      }),
    );
    agregarSesion(
      sesion("reciente", {
        rubrica: [
          { punto: "Problema claro", cumplido: true },
          { punto: "El ask", cumplido: false },
        ],
      }),
    );
    agregarSesion(
      sesion("otro-tipo", {
        tipoPitch: "educacion",
        rubrica: [{ punto: "Objetivo de aprendizaje claro", cumplido: false }],
      }),
    );
    expect(nombresNoCumplidosPrevios("capital")).toEqual(["El ask"]);
    expect(JSON.stringify(nombresNoCumplidosPrevios("capital"))).not.toContain("COMENTARIO");
  });
});
