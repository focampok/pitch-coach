import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLAVE_IDIOMA,
  IDIOMA_POR_DEFECTO,
  esIdioma,
  etiquetaIdioma,
  etiquetaOpenGraph,
  guardarIdioma,
  idiomaDeAcceptLanguage,
  idiomaDeCabecera,
  idiomaDeEtiquetas,
  idiomaDeSolicitud,
  leerIdiomaGuardado,
  resolverIdiomaInicial,
  scriptIdiomaInicial,
} from "@/lib/idiomas";

function almacen(contenido: Record<string, string> = {}, falla = false) {
  return {
    getItem(clave: string) {
      if (falla) throw new Error("storage bloqueado");
      return contenido[clave] ?? null;
    },
    setItem(clave: string, valor: string) {
      if (falla) throw new Error("storage bloqueado");
      contenido[clave] = valor;
    },
    removeItem(clave: string) {
      delete contenido[clave];
    },
  };
}

/** Ejecuta el script de arranque real con globals simulados y devuelve el lang. */
function ejecutarScript(opciones: {
  guardado?: string | null;
  idiomas?: string[];
  language?: string;
  storageFalla?: boolean;
  servidor?: "es" | "en";
}): string {
  const documento = { documentElement: { lang: "" } };
  const almacenamiento = {
    getItem() {
      if (opciones.storageFalla) throw new Error("storage bloqueado");
      return opciones.guardado ?? null;
    },
  };
  const navegador = {
    languages: opciones.idiomas ?? [],
    language: opciones.language ?? "",
  };

  // El script es un IIFE: se evalúa con navigator/localStorage/document inyectados.
  const ejecutar = new Function(
    "navigator",
    "localStorage",
    "document",
    scriptIdiomaInicial(opciones.servidor),
  );
  ejecutar(navegador, almacenamiento, documento);
  return documento.documentElement.lang;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("esIdioma", () => {
  it("acepta solo los idiomas soportados", () => {
    expect(esIdioma("es")).toBe(true);
    expect(esIdioma("en")).toBe(true);
    expect(esIdioma("fr")).toBe(false);
    expect(esIdioma("ES")).toBe(false);
    expect(esIdioma(undefined)).toBe(false);
    expect(esIdioma(null)).toBe(false);
  });
});

describe("idiomaDeEtiquetas", () => {
  it("mapea 'es*' a español y cualquier otra cosa a inglés", () => {
    expect(idiomaDeEtiquetas(["es"])).toBe("es");
    expect(idiomaDeEtiquetas(["es-419"])).toBe("es");
    expect(idiomaDeEtiquetas(["es-MX"])).toBe("es");
    expect(idiomaDeEtiquetas(["ES-mx"])).toBe("es");
    expect(idiomaDeEtiquetas(["en-US"])).toBe("en");
    expect(idiomaDeEtiquetas(["pt-BR"])).toBe("en");
  });

  it("mira solo la preferencia principal", () => {
    // Un usuario que pide inglés primero recibe inglés, aunque después liste español.
    expect(idiomaDeEtiquetas(["en-US", "es-MX"])).toBe("en");
  });

  it("cae al idioma por defecto si no hay ninguna etiqueta", () => {
    expect(idiomaDeEtiquetas([])).toBe(IDIOMA_POR_DEFECTO);
    expect(idiomaDeEtiquetas([""])).toBe(IDIOMA_POR_DEFECTO);
  });
});

describe("etiquetaOpenGraph", () => {
  it("usa el formato ll_TT que acepta Open Graph", () => {
    expect(etiquetaOpenGraph("es")).toBe("es_LA");
    expect(etiquetaOpenGraph("en")).toBe("en_US");
  });
});

describe("idiomaDeAcceptLanguage (servidor)", () => {
  it("elige por la etiqueta de mayor peso", () => {
    expect(idiomaDeAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(idiomaDeAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    // El peso manda sobre el orden de aparición.
    expect(idiomaDeAcceptLanguage("es;q=0.5,en-GB;q=0.9")).toBe("en");
    expect(idiomaDeAcceptLanguage("en;q=0.5, es-419;q=0.9")).toBe("es");
  });

  it("a igual peso manda el orden de aparición", () => {
    expect(idiomaDeAcceptLanguage("en-US, es-MX")).toBe("en");
    expect(idiomaDeAcceptLanguage("es-MX, en-US")).toBe("es");
  });

  it("ignora el comodín y las etiquetas con q=0", () => {
    expect(idiomaDeAcceptLanguage("*")).toBe(IDIOMA_POR_DEFECTO);
    expect(idiomaDeAcceptLanguage("*, en;q=0.5")).toBe("en");
    expect(idiomaDeAcceptLanguage("es;q=0, en;q=0.1")).toBe("en");
    expect(idiomaDeAcceptLanguage("en;q=abc, es")).toBe("es");
  });

  it("mapea cualquier idioma que no sea español a inglés", () => {
    expect(idiomaDeAcceptLanguage("pt-BR,pt;q=0.9")).toBe("en");
    expect(idiomaDeAcceptLanguage("fr")).toBe("en");
  });

  it("cae al idioma por defecto sin cabecera", () => {
    expect(idiomaDeAcceptLanguage(null)).toBe(IDIOMA_POR_DEFECTO);
    expect(idiomaDeAcceptLanguage(undefined)).toBe(IDIOMA_POR_DEFECTO);
    expect(idiomaDeAcceptLanguage("")).toBe(IDIOMA_POR_DEFECTO);
    expect(idiomaDeAcceptLanguage(" , ;q=1")).toBe(IDIOMA_POR_DEFECTO);
  });
});

describe("idiomaDeCabecera (X-Idioma con respaldo en Accept-Language)", () => {
  function peticion(cabeceras: Record<string, string>): Request {
    return new Request("http://localhost/api/x", { headers: cabeceras });
  }

  it("X-Idioma válido manda", () => {
    expect(idiomaDeCabecera(peticion({ "x-idioma": "en", "accept-language": "es-MX" }))).toBe("en");
    expect(idiomaDeCabecera(peticion({ "x-idioma": "es", "accept-language": "en-US" }))).toBe("es");
  });

  it("sin X-Idioma (o inválido) usa Accept-Language", () => {
    expect(idiomaDeCabecera(peticion({ "accept-language": "en-US,en;q=0.9" }))).toBe("en");
    expect(idiomaDeCabecera(peticion({ "x-idioma": "fr", "accept-language": "en-US" }))).toBe("en");
    expect(idiomaDeCabecera(peticion({ "accept-language": "es-AR" }))).toBe("es");
  });

  it("sin ninguna cabecera cae al idioma por defecto", () => {
    expect(idiomaDeCabecera(peticion({}))).toBe(IDIOMA_POR_DEFECTO);
  });
});

describe("idiomaDeSolicitud", () => {
  it("trata ausente como el idioma por defecto", () => {
    expect(idiomaDeSolicitud(undefined)).toBe(IDIOMA_POR_DEFECTO);
    // FormData.get() devuelve null cuando el campo no viene.
    expect(idiomaDeSolicitud(null)).toBe(IDIOMA_POR_DEFECTO);
  });

  it("acepta los idiomas soportados", () => {
    expect(idiomaDeSolicitud("es")).toBe("es");
    expect(idiomaDeSolicitud("en")).toBe("en");
  });

  it("devuelve null para un valor inválido (la ruta responde 400)", () => {
    expect(idiomaDeSolicitud("fr")).toBeNull();
    expect(idiomaDeSolicitud("ES")).toBeNull();
    expect(idiomaDeSolicitud(42)).toBeNull();
    expect(idiomaDeSolicitud({})).toBeNull();
    expect(idiomaDeSolicitud([])).toBeNull();
    expect(idiomaDeSolicitud(true)).toBeNull();
  });
});

describe("idioma guardado en el navegador", () => {
  it("lee solo valores soportados", () => {
    vi.stubGlobal("localStorage", almacen({ [CLAVE_IDIOMA]: "en" }));
    expect(leerIdiomaGuardado()).toBe("en");

    vi.stubGlobal("localStorage", almacen({ [CLAVE_IDIOMA]: "fr" }));
    expect(leerIdiomaGuardado()).toBeNull();

    vi.stubGlobal("localStorage", almacen());
    expect(leerIdiomaGuardado()).toBeNull();
  });

  it("no lanza si el storage falla", () => {
    vi.stubGlobal("localStorage", almacen({}, true));
    expect(leerIdiomaGuardado()).toBeNull();
    expect(() => guardarIdioma("en")).not.toThrow();
  });

  it("persiste el idioma elegido", () => {
    const contenido: Record<string, string> = {};
    vi.stubGlobal("localStorage", almacen(contenido));
    guardarIdioma("en");
    expect(contenido[CLAVE_IDIOMA]).toBe("en");
  });

  it("prioriza lo guardado sobre el navegador", () => {
    vi.stubGlobal("localStorage", almacen({ [CLAVE_IDIOMA]: "en" }));
    vi.stubGlobal("navigator", { languages: ["es-MX"], language: "es-MX" });
    expect(resolverIdiomaInicial()).toBe("en");
  });

  it("usa el navegador cuando no hay nada guardado", () => {
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { languages: ["es-419"], language: "es-419" });
    expect(resolverIdiomaInicial()).toBe("es");

    vi.stubGlobal("navigator", { languages: ["en-GB"], language: "en-GB" });
    expect(resolverIdiomaInicial()).toBe("en");
  });

  it("cae al idioma por defecto sin storage ni navegador utilizables", () => {
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { languages: [], language: "" });
    expect(resolverIdiomaInicial()).toBe(IDIOMA_POR_DEFECTO);
  });

  it("sin señal en el cliente respeta el idioma con el que sirvió el servidor", () => {
    vi.stubGlobal("localStorage", almacen());
    vi.stubGlobal("navigator", { languages: [], language: "" });
    expect(resolverIdiomaInicial("en")).toBe("en");
    expect(resolverIdiomaInicial("es")).toBe("es");
    // Con señal del navegador o guardado, el respaldo no interviene.
    vi.stubGlobal("navigator", { languages: ["es-MX"], language: "es-MX" });
    expect(resolverIdiomaInicial("en")).toBe("es");
    vi.stubGlobal("localStorage", almacen({ [CLAVE_IDIOMA]: "en" }));
    expect(resolverIdiomaInicial("es")).toBe("en");
  });
});

describe("script de arranque (<html lang> antes del primer paint)", () => {
  it("usa el idioma guardado cuando es válido", () => {
    expect(ejecutarScript({ guardado: "en", idiomas: ["es-MX"] })).toBe("en-US");
    expect(ejecutarScript({ guardado: "es", idiomas: ["en-US"] })).toBe("es-419");
  });

  it("ignora un valor guardado que no es un idioma soportado", () => {
    expect(ejecutarScript({ guardado: "fr", idiomas: ["en-US"] })).toBe("en-US");
  });

  it("cae al navegador cuando no hay nada guardado", () => {
    expect(ejecutarScript({ idiomas: ["es-MX"] })).toBe("es-419");
    expect(ejecutarScript({ idiomas: [], language: "es-419" })).toBe("es-419");
    expect(ejecutarScript({ idiomas: ["fr-FR"] })).toBe("en-US");
  });

  it("sobrevive a un localStorage bloqueado", () => {
    expect(ejecutarScript({ storageFalla: true, idiomas: ["en"] })).toBe("en-US");
  });

  it("cae al idioma por defecto sin ninguna señal", () => {
    expect(ejecutarScript({})).toBe(etiquetaIdioma(IDIOMA_POR_DEFECTO));
  });

  it("sin ninguna señal respeta el idioma con el que sirvió el servidor", () => {
    expect(ejecutarScript({ servidor: "en" })).toBe("en-US");
    expect(ejecutarScript({ servidor: "es" })).toBe("es-419");
    // Lo guardado y el navegador siguen mandando sobre el servidor.
    expect(ejecutarScript({ servidor: "en", idiomas: ["es-MX"] })).toBe("es-419");
    expect(ejecutarScript({ servidor: "es", guardado: "en", idiomas: ["es-MX"] })).toBe("en-US");
  });

  it("elige el mismo idioma que resolverIdiomaInicial", () => {
    // Guarda contra divergencia entre el script inline y el proveedor de React.
    const casos: {
      guardado: string | null;
      idiomas: string[];
      language: string;
      servidor?: "es" | "en";
    }[] = [
      { guardado: "en", idiomas: ["es-MX"], language: "es-MX" },
      { guardado: "es", idiomas: ["en-US"], language: "en-US" },
      { guardado: null, idiomas: ["es-MX"], language: "es-MX" },
      { guardado: null, idiomas: ["en-US"], language: "en-US" },
      { guardado: null, idiomas: ["pt-BR"], language: "pt-BR" },
      { guardado: null, idiomas: [], language: "" },
      { guardado: null, idiomas: [], language: "", servidor: "en" },
      { guardado: null, idiomas: ["es-MX"], language: "es-MX", servidor: "en" },
    ];

    for (const caso of casos) {
      const contenido: Record<string, string> = {};
      if (caso.guardado !== null) contenido[CLAVE_IDIOMA] = caso.guardado;
      vi.stubGlobal("localStorage", almacen(contenido));
      vi.stubGlobal("navigator", {
        languages: caso.idiomas,
        language: caso.language,
      });

      const delScript = ejecutarScript({
        guardado: caso.guardado,
        idiomas: caso.idiomas,
        language: caso.language,
        servidor: caso.servidor,
      });

      expect(delScript).toBe(etiquetaIdioma(resolverIdiomaInicial(caso.servidor)));
      vi.unstubAllGlobals();
    }
  });
});
