import { describe, expect, it } from "vitest";

import {
  escaparHtml,
  resaltarMuletillas,
  detectarMuletillas,
  patronesMuletillas,
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

describe("muletillas en inglés", () => {
  const en = (texto: string) => detectarMuletillas(texto, "en");

  it("cuenta las muletillas claras", () => {
    expect(en("um, uh, you know, I mean, actually, basically, kind of, sort of")).toEqual({
      um: 1,
      uh: 1,
      "you know": 1,
      "I mean": 1,
      actually: 1,
      basically: 1,
      "kind of / sort of": 2,
    });
  });

  it("marca like, so y right solo con contexto de muletilla", () => {
    expect(en("Like, we built this.")).toEqual({ like: 1 });
    expect(en("and, like, the market")).toEqual({ like: 1 });
    expect(en("like like")).toEqual({ like: 1 });
    expect(en("So we raised a round.")).toEqual({ so: 1 });
    expect(en("we waited, so, too long")).toEqual({ so: 1 });
    expect(en("that works, right?")).toEqual({ "right?": 1 });
    expect(en(", right, we should ship")).toEqual({ "right?": 1 });
    expect(en("Well, we started small.")).toEqual({ well: 1 });
  });

  it("no marca el uso legítimo de like, so, right y well", () => {
    expect(en("I like the product and it sounds like a fit")).toEqual({});
    expect(en("and so on, the market is so big")).toEqual({});
    expect(en("so that we can grow")).toEqual({});
    expect(en("right now the right market")).toEqual({});
    expect(en("as well as a well-known team")).toEqual({});
  });

  it("un pitch en inglés no dispara patrones de español", () => {
    expect(en("digamos o sea este")).toEqual({});
  });

  it("resalta like entre comas y deja intacto I like", () => {
    const texto = "I like the plan, like, a lot";
    expect(resaltarMuletillas(texto)).not.toContain("<mark");

    const html = resaltarMuletillas(texto, patronesMuletillas("en"));
    expect(html).toContain('<mark class="pc-muletilla">like</mark>');
    expect(html).toContain("I like the plan");
    expect(html.match(/<mark/g)).toHaveLength(1);
  });
});
