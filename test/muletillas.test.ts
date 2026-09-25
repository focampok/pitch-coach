import { describe, expect, it } from "vitest";

import {
  escaparHtml,
  resaltarMuletillas,
  detectarMuletillas,
} from "@/lib/muletillas";

// El carácter "&" se construye por código para que este archivo no contenga
// secuencias de entidad HTML que pudieran decodificarse al escribirlo.
const AMP = String.fromCharCode(38);

describe("escaparHtml", () => {
  it("neutraliza los caracteres con significado en HTML", () => {
    const entrada = "<b>" + AMP + '"x"' + "'y'";
    const salida = escaparHtml(entrada);

    // No sobrevive ningún carácter interpretable como markup...
    expect(salida).not.toContain("<");
    expect(salida).not.toContain(">");
    expect(salida).not.toContain('"');
    expect(salida).not.toContain("'");
    // ...y cada uno se reemplazó por su entidad.
    expect(salida).toContain(AMP + "lt;b" + AMP + "gt;");
    expect(salida).toContain(AMP + "quot;");
    expect(salida).toContain(AMP + "#39;");
  });
});

describe("resaltarMuletillas", () => {
  it("no emite markup de un payload inyectado en la transcripción", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const html = resaltarMuletillas(payload);

    // No se forma ninguna etiqueta: los ángulos van como entidades, así que
    // "onerror=alert(1)" queda como texto inerte, no como atributo.
    expect(html).not.toContain("<img");
    expect(html).toContain(AMP + "lt;img src=x onerror=alert(1)" + AMP + "gt;");
  });

  it("escapa el payload incluso cuando hay muletillas presentes", () => {
    const texto = "<img src=x onerror=alert(1)> entonces entonces entonces";
    const html = resaltarMuletillas(texto);

    expect(html).not.toContain("<img");
    // Solo se emite nuestro markup `<mark>`.
    const crudas = html.match(/<(?!\/?mark\b)[^>]*>/g);
    expect(crudas).toBeNull();
    expect(html).toContain('<mark class="pc-muletilla">entonces</mark>');
  });

  it("escapa ampersands sin romper el resaltado", () => {
    const html = resaltarMuletillas("risas " + AMP + " digamos " + AMP + " digamos");
    expect(html).toContain(AMP + "amp;");
    expect(html).toContain('<mark class="pc-muletilla">digamos</mark>');
  });

  it("devuelve el texto escapado cuando no hay muletillas", () => {
    expect(resaltarMuletillas("a < b")).toBe("a " + AMP + "lt; b");
  });

  it("respeta el umbral: no marca 'pues' con menos de 3 ocurrencias", () => {
    const html = resaltarMuletillas("pues pues");
    expect(html).not.toContain("<mark");
  });

  it("marca 'pues' al alcanzar el umbral de 3", () => {
    const html = resaltarMuletillas("pues pues pues");
    expect(html).toContain('<mark class="pc-muletilla">pues</mark>');
  });
});

describe("detectarMuletillas", () => {
  it("cuenta solo las muletillas presentes", () => {
    expect(detectarMuletillas("digamos luego digamos")).toEqual({ digamos: 2 });
  });

  it("omite las que están por debajo de su umbral", () => {
    expect(detectarMuletillas("pues")).toEqual({});
  });

  it("incluye las que alcanzan su umbral", () => {
    expect(detectarMuletillas("pues pues pues")).toEqual({ pues: 3 });
  });
});
