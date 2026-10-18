import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { POST as POST_ENRIQUECER } from "@/app/api/enriquecer/route";
import {
  DOMINIOS_EXCLUIDOS,
  MAX_CANDIDATOS,
  MAX_PUNTOS_ENRIQUECIDOS,
  MAX_QUERY_CARACTERES,
  MAX_RESULTADOS,
  construirQueryTavily,
  elegirCandidatos,
  elegirPuntosAEnriquecer,
  estaExcluido,
  limpiarTermino,
} from "@/lib/tavily";
import {
  PREFIJOS,
  construirUserQuery,
  esEntidadAmbigua,
  validarRespuestaQuery,
} from "@/lib/query-tavily";
import { MAX_ENTIDADES, MAX_ENTIDAD_CARACTERES } from "@/lib/entidades-tavily";
import { comparteEntidad, mismaRaiz, validarRespuestaValidacion } from "@/lib/validar-sugerencia";
import {
  construirUserObjecion,
  esObjecionDelPitch,
  validarObjecionCruda,
} from "@/lib/objecion-sala";
import { reiniciar } from "@/lib/rate-limit";

// -----------------------------------------------------------------------------
// Fase B: de "results[0] tal cual" a resultados VERIFICADOS.
//
// Este archivo prueba el flujo completo sin salir a la red: la búsqueda, la
// extracción, la validación obligatoria y la frase hablada se mockean; el
// despacho de cada respuesta se hace por el nombre del `json_schema` (modelo) o
// por la URL de Tavily (/search vs /extract).
// -----------------------------------------------------------------------------

const ENV_KEYS = [
  "MODEL_PROVIDER",
  "NEBIUS_API_KEY",
  "NEBIUS_MODEL_NANO",
  "MODEL",
  "MODEL_FALLBACK_MODELS",
  "MODEL_RETRY_ATTEMPTS",
  "TAVILY_API_KEY",
];

const MODELO_NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

const NOMBRE_ENTIDADES = "entidades_tavily";
const NOMBRE_QUERY = "query_tavily";
const NOMBRE_VALIDACION = "validacion_tavily";
const NOMBRE_FRASE = "frase_dato_tavily";
const NOMBRE_OBJECION = "objecion_sala";
const NOMBRE_CIFRAS = "cifras_dichas";

/** Respuesta degradada: ningún proveedor fue llamado, sin procedencia. */
const EVIDENCIA_VACIA = { sugerencias: [], sala: null, cifras: [] };

/**
 * Respuesta cuando el pipeline corrió (Nano + Tavily) y nada pasó el filtro:
 * declara igual la procedencia (ID exacto de Nano, proveedor y buscador).
 */
const EVIDENCIA_VACIA_VERIFICADA = {
  ...EVIDENCIA_VACIA,
  buscador: "tavily",
  modelo: MODELO_NANO,
  proveedor: "nebius",
};

const CIFRA_OK = "USD 320 millones en 2024";
const SECTOR_OK = "energía solar";
const CITA_OK = "El mercado de energía solar en Guatemala alcanzó USD 320 millones en 2024";
const FRASE_OK =
  "Según el informe del sector, el mercado de energía solar en Guatemala alcanzó 320 millones de dólares en 2024.";

/** Marca imposible de confundir: si aparece en un log, se filtró contenido. */
const MARCA_CONTENIDO = "SENTINELA-CONTENIDO-EXTRAIDO";
const CONTENIDO_EXTRAIDO = `${MARCA_CONTENIDO}. El mercado de energía solar en Guatemala alcanzó USD 320 millones en 2024, según el informe sectorial.`;

const RESULTADOS_BUSQUEDA = [
  {
    title: "¿Cómo calcular el TAM/SAM/SOM?",
    url: "https://www.quora.com/como-calcular-tam-sam-som",
    score: 0.97,
  },
  { title: "Informe del sector", url: "https://informe.test/solar", score: 0.52 },
  { title: "Nota de blog", url: "https://blog.test/solar-2024", score: 0.4 },
];

/** Forma mínima de un espía de consola: solo se leen las llamadas. */
interface Espia {
  mock: { calls: unknown[][] };
}

let previo: Record<string, string | undefined> = {};
let ip = 0;
let infoSpy: Espia;
let logSpy: Espia;

beforeEach(() => {
  previo = {};
  for (const clave of ENV_KEYS) {
    previo[clave] = process.env[clave];
    delete process.env[clave];
  }
  process.env.MODEL_PROVIDER = "nebius";
  process.env.NEBIUS_API_KEY = "test-key";
  process.env.NEBIUS_MODEL_NANO = MODELO_NANO;
  process.env.MODEL_RETRY_ATTEMPTS = "1";
  process.env.TAVILY_API_KEY = "test-key";
  reiniciar();
  ip += 1;
  // El diario de diagnóstico (§6) es lo que se inspecciona: se espía sin ruido.
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  for (const clave of ENV_KEYS) {
    if (previo[clave] === undefined) delete process.env[clave];
    else process.env[clave] = previo[clave];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers de mock
// -----------------------------------------------------------------------------

interface RespuestasModelo {
  entidades?: string[];
  query?: string;
  validacion?: {
    util: boolean;
    relevante?: boolean;
    sector?: string;
    cifra?: string;
    cita?: string;
    anio?: string;
  };
  frase?: string;
  objecion?: {
    util: boolean;
    objecion: string;
    cita: string;
    categoria?: string;
    sector?: string;
  };
  cifras?: string[];
  /** Nombres de esquema que deben FALLAR (para probar la degradación). */
  fallar?: string[];
}

interface CuerpoModelo {
  model?: string;
  messages?: { role: string; content: string }[];
  response_format?: { json_schema?: { name?: string; strict?: boolean } };
  chat_template_kwargs?: { enable_thinking?: boolean };
}

interface CuerpoBusqueda {
  query?: string;
  language?: string;
  filter_by_language?: boolean;
  exclude_domains?: string[];
  topic?: string;
  time_range?: string;
  max_results?: number;
  include_answer?: boolean;
  search_depth?: string;
}

interface CuerpoExtraccion {
  urls?: string[];
  query?: string;
  format?: string;
  extract_depth?: string;
  chunks_per_source?: number;
}

function jsonResponse(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Respuesta de /chat/completions (Nebius) con el JSON pedido como contenido. */
function respuestaChat(payload: unknown): Response {
  return jsonResponse({
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(payload) } },
    ],
  });
}

function esBusqueda(url: string): boolean {
  return url.includes("api.tavily.com/search");
}

function esExtraccion(url: string): boolean {
  return url.includes("api.tavily.com/extract");
}

function esModelo(url: string): boolean {
  return !esBusqueda(url) && !esExtraccion(url);
}

function respuestaSegunEsquema(nombre: string, respuestas: RespuestasModelo): Response {
  if (respuestas.fallar?.includes(nombre)) {
    throw new Error(`esquema no disponible: ${nombre}`);
  }

  switch (nombre) {
    case NOMBRE_ENTIDADES:
      return respuestaChat({ entidades: respuestas.entidades ?? [] });
    case NOMBRE_QUERY:
      return respuestaChat({
        query: respuestas.query ?? "tamaño del mercado energía solar Guatemala",
      });
    case NOMBRE_VALIDACION: {
      const v = respuestas.validacion ?? {
        util: true,
        relevante: true,
        sector: SECTOR_OK,
        cifra: CIFRA_OK,
        cita: CITA_OK,
        anio: "2024",
      };
      return respuestaChat({
        util: v.util,
        relevante: v.relevante ?? true,
        sector: v.sector ?? SECTOR_OK,
        cifra: v.cifra ?? "",
        cita: v.cita ?? "",
        anio: v.anio ?? "",
      });
    }
    case NOMBRE_FRASE:
      return respuestaChat({ frase: respuestas.frase ?? FRASE_OK });
    case NOMBRE_OBJECION: {
      const o = respuestas.objecion ?? { util: false, objecion: "", cita: "" };
      return respuestaChat({
        util: o.util,
        objecion: o.objecion,
        cita: o.cita,
        categoria: o.categoria ?? (o.util ? "financiacion" : "otra"),
        sector: o.sector ?? SECTOR_OK,
      });
    }
    case NOMBRE_CIFRAS:
      return respuestaChat({ cifras: respuestas.cifras ?? [] });
    default:
      throw new Error(`esquema inesperado: ${nombre || "(vacío)"}`);
  }
}

/**
 * fetch falso que separa las CUATRO llamadas del flujo de Fase B: entidades,
 * query, validación y frase (Nebius) más la búsqueda y la extracción (Tavily).
 */
function fetchConDispatch(
  respuestas: RespuestasModelo,
  opciones: {
    busqueda?: () => Response | Promise<Response>;
    extraccion?: (url: string) => Response | Promise<Response>;
  } = {},
) {
  return vi.fn(async (url: unknown, init?: { body?: string }) => {
    const destino = String(url);
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      response_format?: { json_schema?: { name?: string } };
      urls?: string[];
    };

    if (esBusqueda(destino)) {
      return opciones.busqueda ? await opciones.busqueda() : jsonResponse({ results: RESULTADOS_BUSQUEDA });
    }
    if (esExtraccion(destino)) {
      const solicitada = body.urls?.[0] ?? "";
      return opciones.extraccion
        ? await opciones.extraccion(solicitada)
        : jsonResponse({ results: [{ url: solicitada, raw_content: CONTENIDO_EXTRAIDO }] });
    }
    return respuestaSegunEsquema(body.response_format?.json_schema?.name ?? "", respuestas);
  });
}

/** Respuestas del camino feliz (entidades + query + validación + frase). */
function respuestasOk(): RespuestasModelo {
  return {
    entidades: ["energía solar", "Guatemala"],
    query: "tamaño del mercado energía solar Guatemala",
    validacion: {
      util: true,
      relevante: true,
      sector: SECTOR_OK,
      cifra: CIFRA_OK,
      cita: CITA_OK,
      anio: "2024",
    },
    frase: FRASE_OK,
  };
}

function cuerpoDe<T>(fetchMock: ReturnType<typeof vi.fn>, filtro: (url: string) => boolean): T {
  const llamada = fetchMock.mock.calls.find(([url]) => filtro(String(url))) as unknown as
    | [string, { body: string }]
    | undefined;
  if (!llamada) throw new Error("No se encontró la llamada esperada.");
  return JSON.parse(llamada[1].body) as T;
}

/** Cuerpo del modelo enviado con un `json_schema.name` concreto. */
function cuerpoDeEsquema<T>(fetchMock: ReturnType<typeof vi.fn>, nombre: string): T {
  for (const [url, init] of fetchMock.mock.calls) {
    if (!esModelo(String(url))) continue;
    const body = JSON.parse(String((init as { body?: string } | undefined)?.body ?? "{}")) as CuerpoModelo;
    if (body.response_format?.json_schema?.name === nombre) return body as T;
  }
  throw new Error(`No se encontró una llamada al modelo con el esquema ${nombre}.`);
}

function llamadasDe(fetchMock: ReturnType<typeof vi.fn>, filtro: (url: string) => boolean) {
  return fetchMock.mock.calls.filter(([url]) => filtro(String(url)));
}

/** La objeción de sala abre con el ángulo de la sala, no con el prefijo de cifra. */
function esQuerySala(query: string): boolean {
  return /^(pregunta de |investor question|classroom assessment|criterio de comite|innovation committee|technical buyer)/.test(
    query,
  );
}

function cuerposBusqueda(
  fetchMock: ReturnType<typeof vi.fn>,
): CuerpoBusqueda[] {
  return llamadasDe(fetchMock, esBusqueda).map(([, init]) =>
    JSON.parse(String((init as { body?: string } | undefined)?.body ?? "{}")) as CuerpoBusqueda,
  );
}

/** Búsquedas de la cifra del punto, sin la de la sala ni la del contraste. */
function busquedasDePunto(fetchMock: ReturnType<typeof vi.fn>): CuerpoBusqueda[] {
  return cuerposBusqueda(fetchMock).filter((cuerpo) => {
    const query = cuerpo.query ?? "";
    return !esQuerySala(query) && !/^(estadistica|statistic)\b/.test(query);
  });
}

function extraccionesDePunto(fetchMock: ReturnType<typeof vi.fn>) {
  return llamadasDe(fetchMock, esExtraccion).filter(([, init]) => {
    const body = JSON.parse(String((init as { body?: string } | undefined)?.body ?? "{}")) as CuerpoExtraccion;
    const query = body.query ?? "";
    return !esQuerySala(query) && !/^(estadistica|statistic)\b/.test(query);
  });
}

function comoNextRequest(req: Request): NextRequest {
  return req as unknown as NextRequest;
}

function peticion(body: unknown): NextRequest {
  return comoNextRequest(
    new Request("http://localhost/api/enriquecer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `3.3.3.${ip}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

const SALIDA_INFO = () => infoSpy.mock.calls.map(([mensaje]) => String(mensaje)).join("\n");
const SALIDA_LOG = () => logSpy.mock.calls.map(([mensaje]) => String(mensaje)).join("\n");

// =============================================================================
// Query pura (Tarea 2)
// =============================================================================

describe("validarRespuestaQuery", () => {
  it("acepta una frase corta y rechaza cifras inventadas o más de 12 palabras", () => {
    expect(validarRespuestaQuery({ query: "ice cream market size United States" })).toBe(
      "ice cream market size United States",
    );
    expect(() => validarRespuestaQuery({ query: "ice cream market usd 3200 million" })).toThrow();
    expect(() =>
      validarRespuestaQuery({
        query: "one two three four five six seven eight nine ten eleven twelve thirteen",
      }),
    ).toThrow();
  });
});

describe("limpiarTermino / construirQueryTavily (puro)", () => {
  it("quita puntuación de oración y colapsa espacios", () => {
    expect(limpiarTermino('  "mercado"  ¿crece?  ')).toBe("mercado crece");
    expect(limpiarTermino("a...b;c:d")).toBe("a b c d");
  });

  it("combina entidades y nombre del punto, SIN el comentario negativo de la Fase A", () => {
    const query = construirQueryTavily({
      entidades: ["energía solar", "Guatemala"],
      puntoNombre: "Tamaño del mercado / oportunidad",
      idioma: "es",
    });

    expect(query.startsWith(PREFIJOS.es)).toBe(true);
    expect(query).toContain("energía solar");
    expect(query).toContain("Guatemala");
    expect(query).toContain("Tamaño del mercado / oportunidad");
    // El comentario del modelo ("Carece de tracción: no da ninguna cifra")
    // sesgaba la búsqueda a páginas que EXPLICAN el concepto en vez de dar la
    // cifra. Ya no es parte de la query.
    expect(query).not.toMatch(/carece|no da|falta|sin cifra|no se menciona/i);
  });

  it("degrada al nombre del tipo de pitch cuando no hay entidades", () => {
    const query = construirQueryTavily({
      entidades: [],
      tipoNombre: "Capital",
      puntoNombre: "El ask",
      idioma: "es",
    });

    expect(query).toContain("Capital");
    expect(query).toContain("El ask");
    expect(query.startsWith(PREFIJOS.es)).toBe(true);
  });

  it("usa el prefijo en inglés cuando la sesión es en inglés", () => {
    const query = construirQueryTavily({
      entidades: ["solar energy"],
      puntoNombre: "The ask",
      idioma: "en",
    });

    expect(query.startsWith(PREFIJOS.en)).toBe(true);
  });

  it(`usa como máximo ${MAX_ENTIDADES} entidades`, () => {
    const query = construirQueryTavily({
      entidades: ["energía solar", "Guatemala central", "paneles térmicos", "cuatro terminos", "cinco terminos"],
      puntoNombre: "El ask",
      idioma: "es",
    });

    expect(query).toContain("energía solar");
    expect(query).toContain("Guatemala central");
    expect(query).toContain("paneles térmicos");
    expect(query).not.toContain("cuatro terminos");
    expect(query).not.toContain("cinco terminos");
  });

  it(`recorta cada entidad a ${MAX_ENTIDAD_CARACTERES} caracteres`, () => {
    const larga = "tecnología blockchain para trazabilidad agrícola certificada";
    const recortada = larga.slice(0, MAX_ENTIDAD_CARACTERES).trim();

    const query = construirQueryTavily({
      entidades: [larga],
      puntoNombre: "Uso de recursos o stack",
      idioma: "es",
    });

    expect(query).toContain(recortada);
    expect(query).not.toContain(larga);
  });

  it("una entidad ambigua NUNCA viaja sola (caso ELF vs e.l.f. Beauty)", () => {
    // Sin ninguna otra entidad ni tipo de pitch que la acompañe: se descarta.
    const sola = construirQueryTavily({
      entidades: ["ELF"],
      puntoNombre: "Tracción o evidencia",
      idioma: "es",
    });
    expect(sola).not.toContain("ELF");
    expect(sola).toBe(`${PREFIJOS.es} Tracción o evidencia`);
  });

  it("una entidad ambigua sí viaja acompañada por otra entidad", () => {
    const query = construirQueryTavily({
      entidades: ["ELF", "cortadora de papel"],
      puntoNombre: "Tracción o evidencia",
      idioma: "es",
    });

    expect(query).toContain("cortadora de papel");
    expect(query).toContain("ELF");
  });

  it("clasifica como ambiguas las siglas, los acrónimos y el camelCase", () => {
    expect(esEntidadAmbigua("ELF")).toBe(true);
    expect(esEntidadAmbigua("e.l.f.")).toBe(true);
    expect(esEntidadAmbigua("eBay")).toBe(true);
    expect(esEntidadAmbigua("TAM")).toBe(true);
    expect(esEntidadAmbigua("energía solar")).toBe(false);
    expect(esEntidadAmbigua("Guatemala")).toBe(false);
  });

  it("nunca puede incluir una oración completa de la transcripción", () => {
    const oracion = "Nuestro producto reduce un 30% el costo logístico en toda la región.";

    const query = construirQueryTavily({
      entidades: [oracion],
      puntoNombre: "Problema claro",
      tipoNombre: "Capital",
      idioma: "es",
    });

    expect(query.includes(oracion)).toBe(false);
    // Sin puntuación de oración: no puede parecer texto dictado por el usuario.
    expect(query).not.toMatch(/[.!?;:¿¡"]/);
    expect(query.length).toBeLessThanOrEqual(MAX_QUERY_CARACTERES);
  });

  it("respeta el tope total de la query aunque todas las piezas sean largas", () => {
    const query = construirQueryTavily({
      entidades: ["a".repeat(60), "b".repeat(60), "c".repeat(60)],
      puntoNombre: "x".repeat(60),
      idioma: "es",
    });

    expect(query.length).toBeLessThanOrEqual(MAX_QUERY_CARACTERES);
  });
});

// =============================================================================
// Selección del mejor resultado (Tarea 3)
// =============================================================================

describe("elegirCandidatos / estaExcluido (criterio de selección)", () => {
  it("excluye dominios metodológicos y ordena por score descendente", () => {
    const elegidos = elegirCandidatos([
      { title: "Quora", url: "https://www.quora.com/como-calcular", score: 0.9 },
      { title: "A", url: "https://a.test/1", score: 0.4 },
      { title: "B", url: "https://b.test/2", score: 0.8 },
    ]);

    // Quora queda fuera aunque tenga el score más alto.
    expect(elegidos.map((r) => r.url)).toEqual(["https://b.test/2", "https://a.test/1"]);
  });

  it("descarta los dominios sin cifras reales de las pruebas manuales", () => {
    const elegidos = elegirCandidatos([
      { title: "FasterCapital", url: "https://fastercapital.com/como-calcular", score: 0.9 },
      { title: "Quora", url: "https://quora.com/tam-sam-som", score: 0.8 },
      { title: "Informe", url: "https://informe.test/x", score: 0.2 },
    ]);

    // El único superviviente entra aunque su score esté por debajo del mínimo:
    // acá solo se prioriza, la cifra se valida después.
    expect(elegidos.map((r) => r.url)).toEqual(["https://informe.test/x"]);
  });

  it(`devuelve a lo sumo ${MAX_CANDIDATOS} candidatos`, () => {
    const elegidos = elegirCandidatos([
      { url: "https://a.test/1", score: 0.9 },
      { url: "https://b.test/2", score: 0.8 },
      { url: "https://c.test/3", score: 0.7 },
    ]);

    expect(elegidos).toHaveLength(MAX_CANDIDATOS);
  });

  it("descarta resultados sin URL", () => {
    const elegidos = elegirCandidatos([{ title: "sin url", score: 0.9 }]);
    expect(elegidos).toHaveLength(0);
  });

  it("cae a la lista sin filtrar solo si TODOS son de dominios excluidos", () => {
    const elegidos = elegirCandidatos([{ title: "F", url: "https://fastercapital.com/a" }]);
    expect(elegidos).toHaveLength(1);
  });

  it("reconoce los dominios excluidos por host y subdominio", () => {
    expect(estaExcluido("https://www.fastercapital.com/x")).toBe(true);
    expect(estaExcluido("https://quora.com/x")).toBe(true);
    expect(estaExcluido("https://sub.reddit.com/x")).toBe(true);
    expect(estaExcluido("https://informe.test/x")).toBe(false);
    // URL inválida no es candidato.
    expect(estaExcluido("no-es-una-url")).toBe(true);
    expect(DOMINIOS_EXCLUIDOS).toContain("fastercapital.com");
  });

  it("excluye los proxies de traducción automática (translate.goog y similares)", () => {
    // El proxy de Google sirve la misma página en otro idioma con el dominio
    // envuelto: el filtro de idioma de Tavily no lo ve, así que se bloquea acá.
    expect(estaExcluido("https://informe--solar-com.translate.goog/x?_x_tr_sl=en&_x_tr_tl=es")).toBe(
      true,
    );
    expect(estaExcluido("https://translate.google.com/translate?u=https://informe.test/x")).toBe(
      true,
    );
    expect(estaExcluido("https://www.microsofttranslator.com/bv.aspx?from=en&to=es")).toBe(true);
    expect(estaExcluido("https://translator.microsoft.com/x")).toBe(true);
    expect(DOMINIOS_EXCLUIDOS).toContain("translate.goog");
    expect(DOMINIOS_EXCLUIDOS).toContain("translate.google.com");

    // El filtro duro viaja completo a Tavily.
    const elegidos = elegirCandidatos([
      { title: "Proxy", url: "https://informe.test.translate.goog/x", score: 0.9 },
      { title: "Real", url: "https://informe.test/solar", score: 0.2 },
    ]);
    expect(elegidos.map((r) => r.url)).toEqual(["https://informe.test/solar"]);
  });
});

// =============================================================================
// Techo de puntos por invocación (ajuste pre-merge)
// =============================================================================

describe("elegirPuntosAEnriquecer (techo de costo por invocación)", () => {
  it(`procesa como máximo ${MAX_PUNTOS_ENRIQUECIDOS} puntos y en orden de rúbrica`, () => {
    const elegidos = elegirPuntosAEnriquecer(
      [{ punto: "ask" }, { punto: "mercado" }, { punto: "traccion" }],
      "capital",
    );

    expect(elegidos).toHaveLength(MAX_PUNTOS_ENRIQUECIDOS);
    expect(elegidos).toEqual([{ punto: "mercado" }, { punto: "traccion" }]);
  });

  it("conserva el comentario de los puntos que sí entran", () => {
    const elegidos = elegirPuntosAEnriquecer(
      [{ punto: "ask", comentario: "falta el monto" }, { punto: "problema", comentario: "difuso" }],
      "capital",
    );

    expect(elegidos).toEqual([
      { punto: "problema", comentario: "difuso" },
      { punto: "ask", comentario: "falta el monto" },
    ]);
  });

  it("no toca el arreglo original", () => {
    const original = [{ punto: "ask" }, { punto: "mercado" }];
    elegirPuntosAEnriquecer(original, "capital");
    expect(original).toEqual([{ punto: "ask" }, { punto: "mercado" }]);
  });
});

// =============================================================================
// Integración de la ruta (Tareas 2–7)
// =============================================================================

describe("POST /api/enriquecer — Fase B (validación obligatoria)", () => {
  it("muestra una sugerencia SOLO con cifra citada, fuente y frase hablada", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala y crecimos 40% el último año.",
        puntosSinCumplir: [{ punto: "ask", comentario: "Falta el monto del ask" }],
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { sugerencias: Record<string, string>[] };
    expect(json.sugerencias).toHaveLength(1);

    const s = json.sugerencias[0];
    expect(s.punto).toBe("ask");
    expect(s.cifra).toBe(CIFRA_OK);
    expect(s.cita).toBe(CITA_OK);
    expect(s.fecha).toBe("2024");
    expect(s.titulo).toBe("Informe del sector");
    expect(s.url).toBe("https://informe.test/solar");
    expect(s.frase).toBe(FRASE_OK);
    expect(typeof s.query).toBe("string");

    // La búsqueda de la cifra lleva filtros duros. La de la sala va aparte.
    const busqueda = busquedasDePunto(fetchMock)[0];
    if (!busqueda) throw new Error("No hubo búsqueda de cifra.");
    expect(String(busqueda.query)).toContain("tamaño del mercado");
    expect(busqueda.language).toBe("es");
    expect(busqueda.filter_by_language).toBe(true);
    expect(busqueda.topic).toBe("finance");
    expect(busqueda.time_range).toBe("year");
    expect(busqueda.max_results).toBe(MAX_RESULTADOS);
    expect(busqueda.include_answer).toBe(false);
    expect(busqueda.exclude_domains).toContain("fastercapital.com");
    expect(busqueda.exclude_domains).toContain("quora.com");

    const llamadaTavily = fetchMock.mock.calls.find(([url]) => esBusqueda(String(url))) as
      | [string, { headers: Record<string, string> }]
      | undefined;
    expect(llamadaTavily?.[1].headers.Authorization).toBe("Bearer test-key");

    // Extract de la cifra corre sobre el mejor candidato, nunca sobre el excluido.
    const extracciones = extraccionesDePunto(fetchMock);
    expect(extracciones).toHaveLength(1);
    const extraccion = JSON.parse(
      String((extracciones[0]?.[1] as { body?: string } | undefined)?.body ?? "{}"),
    ) as CuerpoExtraccion;
    expect(extraccion.urls).toEqual(["https://informe.test/solar"]);
    expect(String(extraccion.query)).toContain("tamaño del mercado");
    expect(extraccion.format).toBe("markdown");

    // Clasificación de niveles: entidades, query, validación y frase hablada
    // van en Nano (rapido). La frase reescribe campos ya validados.
    const entidades = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_ENTIDADES);
    expect(entidades.model).toBe(MODELO_NANO);
    expect(cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_QUERY).model).toBe(MODELO_NANO);
    expect(cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_VALIDACION).model).toBe(MODELO_NANO);
    expect(cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_FRASE).model).toBe(MODELO_NANO);

    // El validador recibe el contenido extraído; todo lo demás no.
    const validacion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_VALIDACION);
    expect(validacion.messages?.[1].content).toContain(CONTENIDO_EXTRAIDO);
  });

  it("rechaza una cifra real pero de OTRO tema (regresión: capitalización de mercado vs salón de té)", async () => {
    // Caso real de la prueba manual: para el "tamaño de mercado" de un salón de
    // té mexicano, el validador aprobó un artículo genérico de "qué es la
    // capitalización de mercado bursátil" con el rango "$2-10 mil millones"
    // (la definición de "empresa mid-cap"). Hay número y cita, pero de otro
    // sector: debe descartarse.
    const respuestas = respuestasOk();
    respuestas.entidades = ["salón de té", "México"];
    respuestas.validacion = {
      util: false,
      relevante: false,
      cifra: "$2-10 mil millones",
      cita: "Una empresa de mediana capitalización vale entre 2 y 10 mil millones de dólares.",
      anio: "",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      extraccion: (url) =>
        jsonResponse({
          results: [
            {
              url,
              raw_content:
                "La capitalización de mercado es el valor total de las acciones de una empresa. Una empresa de mediana capitalización (mid-cap) vale entre 2 y 10 mil millones de dólares.",
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Mi salón de té en México necesita crecer y busco el tamaño del mercado.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    // La relevancia se juzga con las entidades del pitch como contexto: deben
    // viajar al validador para comparar contra el sector buscado.
    const validacion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_VALIDACION);
    const user = validacion.messages?.[1].content ?? "";
    expect(user).toContain("salón de té");
    expect(user).toContain("México");
    // El esquema exige la confirmación explícita de relevancia.
    expect(validacion.response_format?.json_schema?.strict).toBe(true);
    // El tema debe pedirse en las instrucciones (system).
    expect(validacion.messages?.[0].content ?? "").toMatch(/RELEVANCIA|relevant/i);
  });

  it("descarta una cifra vecina aunque el modelo la marque relevante (helado vs lácteos de Nigeria)", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ["ice cream", "Ice Cream Canteen"];
    respuestas.validacion = {
      util: true,
      relevante: true,
      sector: "dairy",
      cifra: "1.60 billion liters in 2024",
      cita: "The Nigeria dairy market was valued at 1.60 billion Liters in 2024.",
      anio: "2024",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      busqueda: () =>
        jsonResponse({
          results: [
            {
              title: "Nigeria Dairy Market Growth Analysis Report 2025-2034",
              url: "https://uk.finance.yahoo.com/news/nigeria-dairy-market-growth-analysis-113300686.html",
              score: 0.81,
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion:
          "The Ice Cream Canteen keeps a pint of ice cream frozen for hours.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    expect(SALIDA_INFO()).toContain("motivo=otro-tema");
  });

  it("comparteEntidad exige una palabra del pitch en lo que se va a mostrar", () => {
    expect(
      comparteEntidad(
        "Nigeria Dairy Market. The Nigeria dairy market was valued at 1.60 billion Liters in 2024.",
        ["ice cream", "Ice Cream Canteen"],
      ),
    ).toBe(false);
    expect(
      comparteEntidad(
        "El mercado de energía solar en Guatemala alcanzó USD 320 millones en 2024",
        ["energía solar", "Guatemala"],
      ),
    ).toBe(true);
  });

  it("degrada a 'sin sugerencia' si el modelo no confirma relevancia aunque cite cifra", async () => {
    const respuestas = respuestasOk();
    // Trampa: cifra y cita presentes, pero sin confirmar `relevante: true`.
    respuestas.validacion = { util: true, relevante: false, cifra: CIFRA_OK, cita: CITA_OK };
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    // Sin relevancia confirmada, ni siquiera se pide la frase hablada.
    expect(
      fetchMock.mock.calls.some(([, init]) => {
        const body = JSON.parse(String((init as { body?: string })?.body ?? "{}")) as CuerpoModelo;
        return body.response_format?.json_schema?.name === NOMBRE_FRASE;
      }),
    ).toBe(false);
  });

  it("descarta la sugerencia cuando el validador no encuentra cifra", async () => {
    const respuestas = respuestasOk();
    respuestas.validacion = { util: false, cifra: "", cita: "", anio: "" };
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    // Se intentó extraer los dos candidatos, pero nunca se pidió la frase.
    expect(extraccionesDePunto(fetchMock)).toHaveLength(MAX_CANDIDATOS);
    expect(
      fetchMock.mock.calls.some(([, init]) => {
        const body = JSON.parse(String((init as { body?: string })?.body ?? "{}")) as CuerpoModelo;
        return body.response_format?.json_schema?.name === NOMBRE_FRASE;
      }),
    ).toBe(false);
    expect(SALIDA_INFO()).toContain("aprobado=false");
  });

  it("degrada a 'sin sugerencia' si el validador dice util=true pero no cita cifra", async () => {
    const respuestas = respuestasOk();
    // Trampa clásica del modelo: declara útil y no aporta la cifra.
    respuestas.validacion = { util: true, cifra: "", cita: "texto sin dato", anio: "2024" };
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
  });

  it("degrada a [] si la extracción no devuelve contenido", async () => {
    const fetchMock = fetchConDispatch(respuestasOk(), {
      extraccion: () => jsonResponse({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    // Sin contenido no hay nada que validar.
    expect(SALIDA_INFO()).toContain("motivo=sin-extraccion");
  });

  it("usa la query de respaldo (sin comentario) si el modelo de query falla", async () => {
    const respuestas = respuestasOk();
    respuestas.fallar = [NOMBRE_QUERY];
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    const busqueda = busquedasDePunto(fetchMock)[0];
    if (!busqueda) throw new Error("No hubo búsqueda de cifra.");
    expect(String(busqueda.query).startsWith(PREFIJOS.es)).toBe(true);
    expect(String(busqueda.query)).toContain("energía solar");
  });

  it("degrada a [] si Tavily falla (best effort)", async () => {
    const fetchMock = fetchConDispatch(respuestasOk(), {
      busqueda: () => {
        throw new Error("tavily caído");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Pitch sobre energía solar en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EVIDENCIA_VACIA_VERIFICADA);
  });

  it("usa topic 'general' cuando el tipo de pitch no es capital", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    await POST_ENRIQUECER(
      peticion({
        tema: "tecnologia",
        idioma: "es",
        puntosSinCumplir: [{ punto: "stack" }],
      }),
    );

    const busqueda = busquedasDePunto(fetchMock)[0];
    if (!busqueda) throw new Error("No hubo búsqueda de cifra.");
    expect(busqueda.topic).toBe("general");
    // Sin transcripción, la query degrada al nombre visible del tipo.
    expect(String(busqueda.query)).toContain("Tecnología");
    expect(String(busqueda.query)).toContain("Uso de recursos o stack");
  });

  it("propaga el idioma de la sesión a la búsqueda", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ["solar energy"];
    respuestas.query = "solar energy market size Guatemala";
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion: "We sell solar panels in Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    const busqueda = busquedasDePunto(fetchMock)[0];
    if (!busqueda) throw new Error("No hubo búsqueda de cifra.");
    expect(busqueda.language).toBe("en");
    expect(busqueda.filter_by_language).toBe(true);
    expect(String(busqueda.query)).toContain("solar energy market size");
  });

  it("descarta puntos que no pertenecen a la rúbrica del tipo", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        puntosSinCumplir: [{ punto: "punto-inventado" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EVIDENCIA_VACIA);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(`solo enriquece los ${MAX_PUNTOS_ENRIQUECIDOS} primeros puntos de la rúbrica; el resto no llama a nada`, async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    // El cliente los manda en orden INVERSO y con dos fuera del techo ("ask" y
    // "traccion"): deben procesarse "mercado" y "solucion" (los dos primeros
    // en el orden de la rúbrica de capital: problema, mercado, solucion,
    // traccion, ask).
    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [
          { punto: "ask" },
          { punto: "solucion" },
          { punto: "traccion" },
          { punto: "mercado" },
        ],
      }),
    );

    // Solo los 2 puntos dentro del techo disparan la búsqueda de cifra.
    // La sala suma una búsqueda más, sobre el primero de esos puntos.
    expect(busquedasDePunto(fetchMock)).toHaveLength(MAX_PUNTOS_ENRIQUECIDOS);
    expect(cuerposBusqueda(fetchMock).filter((cuerpo) => esQuerySala(cuerpo.query ?? ""))).toHaveLength(1);

    const json = (await res.json()) as { sugerencias: { punto: string }[] };
    expect([...json.sugerencias.map((s) => s.punto)].sort()).toEqual(["mercado", "solucion"]);
    // Los puntos fuera del techo no aparecen ni en el diario de diagnóstico.
    expect(SALIDA_INFO()).not.toContain("punto=ask");
    expect(SALIDA_INFO()).not.toContain("punto=traccion");
  });

  it("sin TAVILY_API_KEY responde [] sin llamar a ningún proveedor", async () => {
    delete process.env.TAVILY_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EVIDENCIA_VACIA);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve la objeción de sala cuando la página cita la pregunta", async () => {
    const cita = "How much capital are you raising and what will it fund?";
    const respuestas = respuestasOk();
    respuestas.objecion = {
      util: true,
      objecion: "¿Cuánto capital estás levantando y para qué?",
      cita,
    };
    const fetchMock = fetchConDispatch(respuestas, {
      extraccion: (url) =>
        jsonResponse({
          results: [{ url, raw_content: `${CONTENIDO_EXTRAIDO} ${cita}` }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    const json = (await res.json()) as {
      sala: { sala: string; punto: string; objecion: string; url: string } | null;
    };
    expect(json.sala).toMatchObject({
      sala: "inversion",
      punto: "ask",
      objecion: "¿Cuánto capital estás levantando y para qué?",
      url: "https://informe.test/solar",
    });
  });

  it("marca sin fuente una cifra dicha cuyo orden no aparece en la página", async () => {
    const respuestas = respuestasOk();
    respuestas.cifras = ["40%"];
    respuestas.validacion = {
      util: true,
      relevante: true,
      cifra: "USD 2 mil millones",
      cita: "El mercado de energía solar en Guatemala alcanzó USD 2 mil millones en 2024",
      anio: "2024",
    };
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala y crecimos 40% el último año.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    const json = (await res.json()) as { cifras: { cifra: string; estado: string }[] };
    expect(json.cifras).toEqual([{ cifra: "40%", estado: "sin_fuente" }]);
  });
});

// =============================================================================
// Idioma de los prompts de Tavily (hallazgo del QA en inglés)
// =============================================================================

describe("prompts de Tavily en el idioma de la sesión", () => {
  const datos = {
    puntoNombre: "Market size",
    tipoNombre: "Fundraising",
    entidades: ["accounting software", "SMEs", "Colombia"],
    queBuscar: "a figure for the market",
  };

  it("construirUserQuery rotula en inglés y en español", () => {
    const en = construirUserQuery({ ...datos, idioma: "en" });
    expect(en).toContain("Pitch data:");
    expect(en).toContain("Point that failed: Market size");
    expect(en).toContain("What to look for: a figure for the market");
    expect(en).toContain("Pitch type: Fundraising");
    expect(en).toContain("Pitch entities: accounting software, SMEs, Colombia");
    expect(en).not.toMatch(/Datos del pitch|Punto que falló|Entidades/);

    const es = construirUserQuery({ ...datos, idioma: "es", entidades: [] });
    expect(es).toContain("Datos del pitch:");
    expect(es).toContain("Punto que falló: Market size");
    expect(es).toContain("Entidades del pitch: (ninguna)");
    expect(es).not.toMatch(/Pitch data|Point that failed/);

    expect(construirUserQuery({ ...datos, idioma: "en", entidades: [], tipoNombre: undefined })).toContain(
      "Pitch entities: (none)",
    );
  });

  it("construirUserObjecion rotula en inglés y en español, con las entidades del pitch", () => {
    const base = {
      puntoNombre: "Market size",
      queBuscar: "market figure",
      entidades: ["accounting software", "SMEs"],
      contenido: "PAGE-CONTENT",
    };
    const en = construirUserObjecion({ ...base, idioma: "en" });
    expect(en).toContain("Pitch point: Market size");
    expect(en).toContain("What to look for: market figure");
    expect(en).toContain("Pitch entities (industry or product, customer or market, geography): accounting software, SMEs");
    expect(en).toContain("PAGE-CONTENT");
    expect(en).not.toMatch(/Punto|Qué buscar/);

    const es = construirUserObjecion({ ...base, idioma: "es" });
    expect(es).toContain("Punto del pitch: Market size");
    expect(es).toContain("Qué buscar: market figure");
    expect(es).toContain("Entidades del pitch (industria o producto, cliente o mercado, geografía): accounting software, SMEs");
    expect(es).not.toMatch(/Pitch point|What to look for/);
  });

  it("en una sesión en inglés, los mensajes al modelo y la query a Tavily salen en inglés", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ["accounting software", "SMEs", "Colombia"];
    respuestas.query = "accounting software market size Colombia SMEs";
    respuestas.objecion = {
      util: true,
      objecion: "How many SMEs in Colombia pay for accounting software today?",
      cita: "How much capital are you raising",
      categoria: "traccion",
      sector: "accounting software",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      extraccion: (url) =>
        jsonResponse({
          results: [{ url, raw_content: `${CONTENIDO_EXTRAIDO} How much capital are you raising and why?` }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion: "We sell accounting software to SMEs in Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    expect(res.status).toBe(200);

    // Query: system pide inglés explícitamente y el user va rotulado en inglés.
    const query = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_QUERY);
    expect(query.messages?.[0].content).toContain("Write it in ENGLISH");
    expect(query.messages?.[1].content).toContain("Pitch data:");
    expect(query.messages?.[1].content).not.toContain("Datos del pitch");

    // Objeción: igual, y con las entidades como contexto.
    const objecion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_OBJECION);
    expect(objecion.messages?.[1].content).toContain("Pitch point:");
    expect(objecion.messages?.[1].content).toContain("accounting software, SMEs, Colombia");
    expect(objecion.messages?.[1].content).not.toContain("Punto:");

    // La búsqueda de la cifra viaja con la query en inglés y el filtro de idioma.
    const busqueda = busquedasDePunto(fetchMock)[0];
    expect(String(busqueda?.query)).toMatch(/^accounting software market size Colombia SMEs \d{4}$/);
    expect(busqueda?.language).toBe("en");
  });

  it("en una sesión en español, los mensajes al modelo salen en español", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );

    const query = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_QUERY);
    expect(query.messages?.[0].content).toContain("Escríbela en ESPAÑOL");
    expect(query.messages?.[1].content).toContain("Datos del pitch:");
    expect(query.messages?.[1].content).not.toContain("Pitch data");

    const objecion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_OBJECION);
    expect(objecion.messages?.[1].content).toContain("Punto del pitch:");
    expect(objecion.messages?.[1].content).toContain("energía solar, Guatemala");
  });
});

// =============================================================================
// Relevancia: misma industria, no solo el mismo país (hallazgo del QA)
// =============================================================================

describe("relevancia por industria (contabilidad vs electrodomésticos)", () => {
  const ENTIDADES_CONTABILIDAD = ["software de contabilidad", "pymes", "Colombia"];
  const TITULO_ELECTRO = "Mercado de Electrodomésticos en Colombia 2024";
  const CITA_ELECTRO = "El mercado de electrodomésticos en Colombia alcanzó COP 12 billones en 2024.";

  it("mismaRaiz empareja plural y género sin confundir palabras distintas", () => {
    expect(mismaRaiz("contabilidad", "contable")).toBe(true);
    expect(mismaRaiz("accounting", "accountants")).toBe(true);
    expect(mismaRaiz("solar", "solares")).toBe(true);
    expect(mismaRaiz("pymes", "pyme")).toBe(true);
    expect(mismaRaiz("contabilidad", "contaminacion")).toBe(false);
    expect(mismaRaiz("sol", "solar")).toBe(false);
  });

  it("comparteEntidad no acepta la geografía como coincidencia de tema", () => {
    // Caso real: la única palabra compartida era el país.
    expect(comparteEntidad(`${TITULO_ELECTRO} ${CITA_ELECTRO}`, ENTIDADES_CONTABILIDAD)).toBe(false);
    // Con la industria sí, aunque esté en otra forma ("contable").
    expect(
      comparteEntidad(
        "El mercado de software contable para pymes en Colombia creció 18% en 2024",
        ENTIDADES_CONTABILIDAD,
      ),
    ).toBe(true);
    // Solo geografía como entidad: no hay con qué comparar y no se bloquea.
    expect(comparteEntidad(TITULO_ELECTRO, ["Colombia"])).toBe(true);
  });

  it("validarRespuestaValidacion exige el sector además de cifra, cita y relevancia", () => {
    const base = { util: true, relevante: true, cifra: "COP 12 billones", cita: "alcanzó COP 12 billones", anio: "2024" };
    expect(validarRespuestaValidacion({ ...base, sector: "electrodomésticos" }).util).toBe(true);
    expect(validarRespuestaValidacion({ ...base, sector: "" }).util).toBe(false);
    expect(validarRespuestaValidacion({ ...base, sector: "electrodomésticos" }).sector).toBe("electrodomésticos");
  });

  it("descarta la cifra de electrodomésticos para el pitch de contabilidad aunque Nano la marque relevante", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES_CONTABILIDAD;
    respuestas.validacion = {
      util: true,
      relevante: true,
      sector: "electrodomésticos",
      cifra: "COP 12 billones en 2024",
      cita: CITA_ELECTRO,
      anio: "2024",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      busqueda: () =>
        jsonResponse({
          results: [{ title: TITULO_ELECTRO, url: "https://informe.test/electro", score: 0.9 }],
        }),
      extraccion: (url) => jsonResponse({ results: [{ url, raw_content: CITA_ELECTRO }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos software de contabilidad a pymes en Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );

    const json = (await res.json()) as { sugerencias: unknown[]; sala: unknown; cifras: unknown[] };
    expect(json.sugerencias).toEqual([]);
    expect(json.sala).toBeNull();
    expect(SALIDA_INFO()).toContain("motivo=otro-tema");
    // El validador recibió la industria y el cliente del pitch como contexto.
    const validacion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_VALIDACION);
    expect(validacion.messages?.[1].content).toContain("software de contabilidad, pymes, Colombia");
    expect(validacion.messages?.[0].content).toMatch(/PRIMERO LA INDUSTRIA/);
    expect(validacion.response_format?.json_schema?.strict).toBe(true);
  });

  it("acepta la cifra cuando la industria coincide aunque el título no nombre el producto", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES_CONTABILIDAD;
    respuestas.validacion = {
      util: true,
      relevante: true,
      sector: "software contable",
      cifra: "USD 48 millones en 2024",
      cita: "El gasto de las pymes en herramientas de gestión llegó a USD 48 millones en 2024.",
      anio: "2024",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      busqueda: () =>
        jsonResponse({
          results: [{ title: "Informe de gestión empresarial", url: "https://informe.test/gestion", score: 0.9 }],
        }),
      extraccion: (url) =>
        jsonResponse({
          results: [{ url, raw_content: "El gasto de las pymes en herramientas de gestión llegó a USD 48 millones en 2024." }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos software de contabilidad a pymes en Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    const json = (await res.json()) as { sugerencias: { cifra: string }[] };
    expect(json.sugerencias.map((s) => s.cifra)).toEqual(["USD 48 millones en 2024"]);
  });
});

describe("entidades con industria (diagnóstico de la pasada 2: marca + países)", () => {
  // Con ["Contable", "Guatemala", "Colombia"] la query salió sin industria
  // ("Guatemala Colombia market size…") y ninguna cifra contable podía pasar.
  const ENTIDADES_NUEVAS = ["accounting software", "small shops", "Colombia"];

  it("el extractor pide la industria en sustantivos comunes y prohíbe la marca", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);
    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion: "Contable is a WhatsApp bookkeeping assistant for small shops in Guatemala.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    const entidades = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_ENTIDADES);
    expect(entidades.messages?.[0].content).toMatch(/NEVER the brand or product name/);
    expect(entidades.messages?.[0].content).toMatch(/industry or product category/);
    // El diario registra las entidades (mismos términos que viajan en la query).
    expect(SALIDA_INFO()).toContain('[tavily] entidades=["energía solar","Guatemala"]');
  });

  it("con la industria en las entidades, una cifra contable de LATAM pasa el filtro determinista", () => {
    expect(
      comparteEntidad(
        "Latin America Accounting Software Market Report. The market reached USD 1.2 billion in 2024. accounting software",
        ENTIDADES_NUEVAS,
      ),
    ).toBe(true);
    expect(comparteEntidad("Accounting Software Market in Colombia", ENTIDADES_NUEVAS)).toBe(true);
    // Y una comparación de países sigue fuera.
    expect(comparteEntidad("Guatemala vs Colombia: area and population", ENTIDADES_NUEVAS)).toBe(false);
    // Con la marca como única entidad temática, "accounting" no coincidía: ese
    // era el bloqueo estructural, no el filtro de industria.
    expect(comparteEntidad("Accounting Software Market in Colombia", ["Contable", "Guatemala", "Colombia"])).toBe(false);
  });

  it("el diario de candidatas registra host, motivo y sector declarado, nunca la cita", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES_NUEVAS;
    respuestas.validacion = { util: false, relevante: false, sector: "forestry", cifra: "", cita: "SECRETA" };
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);
    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion: "We sell accounting software to small shops in Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    const salida = SALIDA_INFO();
    expect(salida).toMatch(/\[tavily\] candidata punto=mercado host=informe\.test motivo=no-relevante sector="forestry" relevante=false/);
    expect(salida).not.toContain("SECRETA");
    expect(salida).not.toContain(MARCA_CONTENIDO);
  });

  it("verifica hasta dos cifras dichas (tracción y ask)", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES_NUEVAS;
    respuestas.cifras = ["420 shops", "500000 dollars", "15 percent"];
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion:
          "Today we have four hundred and twenty paying shops, growing fifteen percent. We are raising five hundred thousand dollars.",
        puntosSinCumplir: [],
      }),
    );
    const json = (await res.json()) as { cifras: { cifra: string }[] };
    expect(json.cifras.map((c) => c.cifra)).toEqual(["420 shops", "500000 dollars"]);
    // Dos cifras = dos búsquedas de contraste, ni una más.
    expect(cuerposBusqueda(fetchMock).filter((b) => /^statistic\b/.test(b.query ?? ""))).toHaveLength(2);
  });
});

describe("objeción de sala: pregunta de inversionista y de la industria del pitch", () => {
  const ENTIDADES = ["software de contabilidad", "pymes", "Colombia"];
  const PAGINA_GEO =
    "Colombia tiene 1.141.748 km² y Guatemala 108.889 km². La ratio de área entre Colombia y Guatemala es de 10,5.";

  it("validarObjecionCruda rechaza la categoría 'otra' y acepta una pregunta de negocio", () => {
    const geo = {
      util: true,
      objecion: "¿Cuál es la ratio de área entre Colombia y Guatemala?",
      cita: "La ratio de área entre Colombia y Guatemala es de 10,5.",
      categoria: "otra",
      sector: "geografía",
    };
    expect(validarObjecionCruda(geo, PAGINA_GEO).util).toBe(false);
    expect(validarObjecionCruda({ ...geo, categoria: "inventada" }, PAGINA_GEO).util).toBe(false);
    expect(validarObjecionCruda({ ...geo, categoria: undefined }, PAGINA_GEO).categoria).toBe("otra");

    const negocio = {
      util: true,
      objecion: "¿Cuántas pymes pagan hoy por su software de contabilidad?",
      cita: "La ratio de área entre Colombia y Guatemala es de 10,5.",
      categoria: "traccion",
      sector: "software contable",
    };
    const cruda = validarObjecionCruda(negocio, PAGINA_GEO);
    expect(cruda.util).toBe(true);
    expect(cruda.categoria).toBe("traccion");
    expect(cruda.sector).toBe("software contable");
  });

  it("esObjecionDelPitch exige una palabra temática del pitch; el país no basta", () => {
    expect(
      esObjecionDelPitch(
        { objecion: "¿Cuál es la ratio de área entre Colombia y Guatemala?", sector: "geografía", cita: "" },
        "Colombia vs Guatemala: comparación",
        ENTIDADES,
      ),
    ).toBe(false);
    expect(
      esObjecionDelPitch(
        { objecion: "¿Cuántas pymes pagan hoy por su software contable?", sector: "", cita: "" },
        "Preguntas que hacen los inversionistas",
        ENTIDADES,
      ),
    ).toBe(true);
  });

  it("caso real: la 'ratio de área Colombia/Guatemala' no se muestra como objeción", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES;
    respuestas.objecion = {
      util: true,
      objecion: "¿Cuál es la ratio de área entre Colombia y Guatemala?",
      cita: "La ratio de área entre Colombia y Guatemala es de 10,5.",
      categoria: "otra",
      sector: "geografía",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      extraccion: (url) => jsonResponse({ results: [{ url, raw_content: PAGINA_GEO }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos software de contabilidad a pymes en Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    const json = (await res.json()) as { sala: unknown };
    expect(json.sala).toBeNull();
    expect(SALIDA_INFO()).toMatch(/\[sala\] descartada host=\S+ categoria=otra sector="geografía" motivo=no-es-pregunta-de-sala/);

    // El esquema obliga a clasificar la pregunta y a nombrar el sector.
    const objecion = cuerpoDeEsquema<CuerpoModelo & { response_format?: { json_schema?: { schema?: { required?: string[] } } } }>(
      fetchMock,
      NOMBRE_OBJECION,
    );
    expect(objecion.response_format?.json_schema?.schema?.required).toEqual(
      expect.arrayContaining(["categoria", "sector"]),
    );
  });

  it("una pregunta de negocio pero de otra industria tampoco se muestra", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ENTIDADES;
    respuestas.objecion = {
      util: true,
      objecion: "¿Cuántas neveras vende al año y con qué margen?",
      cita: "La ratio de área entre Colombia y Guatemala es de 10,5.",
      categoria: "unit_economics",
      sector: "electrodomésticos",
    };
    const fetchMock = fetchConDispatch(respuestas, {
      busqueda: () =>
        jsonResponse({
          results: [{ title: "Electrodomésticos en Colombia", url: "https://informe.test/electro", score: 0.9 }],
        }),
      extraccion: (url) => jsonResponse({ results: [{ url, raw_content: PAGINA_GEO }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos software de contabilidad a pymes en Colombia.",
        puntosSinCumplir: [{ punto: "mercado" }],
      }),
    );
    expect(((await res.json()) as { sala: unknown }).sala).toBeNull();
    expect(SALIDA_INFO()).toMatch(/\[sala\] descartada host=\S+ categoria=unit_economics sector="electrodomésticos" motivo=otro-tema/);
  });
});

// =============================================================================
// Cifras dichas en palabras y procedencia del enriquecimiento
// =============================================================================

describe("cifras dichas en palabras y procedencia", () => {
  it("normaliza los números en palabras antes de extraer y verificar la cifra dicha", async () => {
    const respuestas = respuestasOk();
    respuestas.entidades = ["accounting software", "SMEs"];
    respuestas.cifras = ["500000 dollars"];
    const fetchMock = fetchConDispatch(respuestas);
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "en",
        transcripcion:
          "We already have four hundred and twenty paying users and we are raising five hundred thousand dollars.",
        puntosSinCumplir: [],
      }),
    );

    const json = (await res.json()) as { cifras: { cifra: string; estado: string }[] };
    // La cifra en dígitos "está" en lo dicho; la fuente mock es de otro orden.
    expect(json.cifras).toEqual([{ cifra: "500000 dollars", estado: "sin_fuente" }]);

    // El extractor recibió la transcripción con dígitos, no con palabras.
    const extraccion = cuerpoDeEsquema<CuerpoModelo>(fetchMock, NOMBRE_CIFRAS);
    const user = extraccion.messages?.[1].content ?? "";
    expect(user).toContain("420 paying users");
    expect(user).toContain("500000 dollars");
    expect(user).not.toContain("four hundred");
  });

  it("declara el modelo Nano exacto, el proveedor y el buscador en la respuesta", async () => {
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion: "Vendemos paneles solares en Guatemala.",
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );
    const json = (await res.json()) as { modelo: string; proveedor: string; buscador: string; sugerencias: unknown[] };
    expect(json.sugerencias).toHaveLength(1);
    expect(json.modelo).toBe(MODELO_NANO);
    expect(json.proveedor).toBe("nebius");
    expect(json.buscador).toBe("tavily");
  });
});

// =============================================================================
// Diario de diagnóstico y privacidad (Tareas 6 y 7)
// =============================================================================

describe("diario de diagnóstico (§6) y regla de privacidad", () => {
  it("registra la query y el veredicto, nunca la transcripción ni el contenido extraído", async () => {
    const transcripcion = "MARCA-TRANSCRIPCION-SECRETA: invertimos en paneles solares.";
    const fetchMock = fetchConDispatch(respuestasOk());
    vi.stubGlobal("fetch", fetchMock);

    await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion,
        puntosSinCumplir: [{ punto: "ask" }],
      }),
    );

    const diario = SALIDA_INFO();
    // Lo que SÍ debe estar: la query final y si la validación pasó.
    expect(diario).toContain("punto=ask");
    expect(diario).toContain("aprobado=true");
    expect(diario).toContain("motivo=ok");
    expect(diario).toContain("query=");
    // Lo que NUNCA debe estar: la transcripción ni el contenido extraído.
    expect(diario).not.toContain("MARCA-TRANSCRIPCION-SECRETA");
    expect(diario).not.toContain(MARCA_CONTENIDO);

    // Tampoco por el log genérico del modelo.
    expect(SALIDA_LOG()).not.toContain("MARCA-TRANSCRIPCION-SECRETA");
    expect(SALIDA_LOG()).not.toContain(MARCA_CONTENIDO);
  });

  it("con la extracción (Nano) y Tavily caídos, la respuesta no filtra la transcripción", async () => {
    const transcripcion =
      "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA y busco inversión para escalarla.";
    const marca = "TENGO-UNA-IDEA-DE-NEGOCIO-SECRETA";

    // Las DOS llamadas externas de esta ruta fallan, y la de extracción lo hace
    // con el vector real: el proveedor devuelve un cuerpo de error que, como en
    // un error de validación, ecoa la petición —prompt con transcripción—.
    const fetchMock = vi.fn(async (url: unknown) => {
      if (esBusqueda(String(url)) || esExtraccion(String(url))) {
        throw new Error(`Tavily caído: ${transcripcion}`);
      }
      return jsonResponse({ error: { message: `prompt inválido: ${transcripcion}` } }, 400);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST_ENRIQUECER(
      peticion({
        tema: "capital",
        idioma: "es",
        transcripcion,
        puntosSinCumplir: [{ punto: "ask", comentario: "Falta el monto del ask" }],
      }),
    );

    // Se golpearon los dos proveedores: no se está probando un atajo previo.
    expect(fetchMock.mock.calls.some(([url]) => esBusqueda(String(url)))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => esModelo(String(url)))).toBe(true);

    // El fallo doble no rompe el dashboard: 200 con lista vacía...
    expect(res.status).toBe(200);
    const texto = await res.text();
    expect(JSON.parse(texto)).toEqual(EVIDENCIA_VACIA_VERIFICADA);
    // ...y ni el cuerpo ni las cabeceras arrastran la transcripción.
    expect(texto).not.toContain(marca);
    expect(texto).not.toContain(transcripcion);
    expect(String(res.headers.get("content-type"))).not.toContain(marca);

    // El diario de diagnóstico tampoco la arrastra.
    expect(SALIDA_INFO()).not.toContain(marca);
  });
});
