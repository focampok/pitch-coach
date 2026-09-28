import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLAVE_IDIOMA,
  IDIOMA_POR_DEFECTO,
  esIdioma,
  etiquetaIdioma,
  guardarIdioma,
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
    scriptIdiomaInicial(),
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

  it("elige el mismo idioma que resolverIdiomaInicial", () => {
    // Guarda contra divergencia entre el script inline y el proveedor de React.
    const casos: { guardado: string | null; idiomas: string[]; language: string }[] = [
      { guardado: "en", idiomas: ["es-MX"], language: "es-MX" },
      { guardado: "es", idiomas: ["en-US"], language: "en-US" },
      { guardado: null, idiomas: ["es-MX"], language: "es-MX" },
      { guardado: null, idiomas: ["en-US"], language: "en-US" },
      { guardado: null, idiomas: ["pt-BR"], language: "pt-BR" },
      { guardado: null, idiomas: [], language: "" },
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
      });

      expect(delScript).toBe(etiquetaIdioma(resolverIdiomaInicial()));
      vi.unstubAllGlobals();
    }
  });
});
