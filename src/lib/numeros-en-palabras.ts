import type { Idioma } from "@/types/idioma";

/**
 * Números escritos en palabras → dígitos, en inglés y en español.
 *
 * Scribe dicta las cifras como palabras ("four hundred and twenty", "five
 * hundred thousand dollars", "quinientos mil dólares"). El contraste de cifras
 * dichas (`cifras-dichas.ts`) compara dígitos, así que sin esta pasada el
 * modelo devolvía cifras que luego no "estaban" en la transcripción y la
 * sección quedaba vacía. Solo se usa server-side sobre la copia que va al
 * extractor: la transcripción que ve la persona no cambia.
 *
 * Parser propio, sin dependencias: unidades, decenas, centenas, "mil",
 * "millón/millones", "billion/billón" y decimales con "point"/"punto"/"coma".
 * Los dígitos ya presentes se respetan; un dígito seguido de una escala
 * ("500 thousand", "2.5 millones") también se expande.
 */

type Clase =
  | { tipo: "unidad"; valor: number }
  | { tipo: "centena"; valor: number }
  | { tipo: "cien" }
  | { tipo: "escala"; valor: number }
  | { tipo: "conjuncion" }
  | { tipo: "punto" }
  | { tipo: "articulo" }
  | { tipo: "digitos"; valor: number }
  | null;

interface Lexico {
  unidades: Record<string, number>;
  decenas: Record<string, number>;
  centenas: Record<string, number>;
  cien: Set<string>;
  escalas: Record<string, number>;
  conjunciones: Set<string>;
  puntos: Set<string>;
  articulos: Set<string>;
  /** Separador decimal de los dígitos ya escritos ("2.5" en en, "2,5" en es). */
  decimal: "." | ",";
}

const LEXICO_EN: Lexico = {
  unidades: {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  },
  decenas: {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  },
  centenas: {},
  cien: new Set(["hundred"]),
  escalas: {
    thousand: 1_000,
    million: 1_000_000,
    millions: 1_000_000,
    billion: 1_000_000_000,
    billions: 1_000_000_000,
    trillion: 1_000_000_000_000,
  },
  conjunciones: new Set(["and"]),
  puntos: new Set(["point"]),
  articulos: new Set(["a", "an"]),
  decimal: ".",
};

const LEXICO_ES: Lexico = {
  unidades: {
    cero: 0,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veintiuno: 21,
    veintiun: 21,
    veintiuna: 21,
    veintidos: 22,
    veintitres: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiseis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,
  },
  decenas: {
    veinte: 20,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,
  },
  centenas: {
    doscientos: 200,
    doscientas: 200,
    trescientos: 300,
    trescientas: 300,
    cuatrocientos: 400,
    cuatrocientas: 400,
    quinientos: 500,
    quinientas: 500,
    seiscientos: 600,
    seiscientas: 600,
    setecientos: 700,
    setecientas: 700,
    ochocientos: 800,
    ochocientas: 800,
    novecientos: 900,
    novecientas: 900,
  },
  cien: new Set(["cien", "ciento"]),
  escalas: {
    mil: 1_000,
    millon: 1_000_000,
    millones: 1_000_000,
    billon: 1_000_000_000_000,
    billones: 1_000_000_000_000,
  },
  conjunciones: new Set(["y"]),
  puntos: new Set(["punto", "coma"]),
  articulos: new Set(["un", "una"]),
  decimal: ",",
};

const LEXICOS: Record<Idioma, Lexico> = { en: LEXICO_EN, es: LEXICO_ES };

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Clasifica una palabra ya normalizada (sin acentos, minúsculas). */
function clasificar(palabra: string, lexico: Lexico): Clase {
  if (palabra in lexico.unidades) return { tipo: "unidad", valor: lexico.unidades[palabra] };
  if (palabra in lexico.decenas) return { tipo: "unidad", valor: lexico.decenas[palabra] };
  if (palabra in lexico.centenas) return { tipo: "centena", valor: lexico.centenas[palabra] };
  if (lexico.cien.has(palabra)) return { tipo: "cien" };
  if (palabra in lexico.escalas) return { tipo: "escala", valor: lexico.escalas[palabra] };
  if (lexico.conjunciones.has(palabra)) return { tipo: "conjuncion" };
  if (lexico.puntos.has(palabra)) return { tipo: "punto" };
  if (lexico.articulos.has(palabra)) return { tipo: "articulo" };
  const digitos = palabra.match(/^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:([.,])(\d+))?$/);
  if (digitos) {
    const entero = digitos[1].replace(/[.,]/g, "");
    let valor = Number(entero);
    if (digitos[2] && digitos[3]) {
      // Un solo separador con 1-2 decimales se lee como decimal; con tres
      // dígitos y el separador de miles del idioma, como miles.
      const esDecimal = digitos[2] === lexico.decimal || digitos[3].length !== 3;
      valor = esDecimal ? Number(`${entero}.${digitos[3]}`) : Number(entero + digitos[3]);
    }
    return Number.isFinite(valor) ? { tipo: "digitos", valor } : null;
  }
  return null;
}

interface Pieza {
  /** Texto original (puede llevar puntuación pegada). */
  original: string;
  /** Puntuación inicial, núcleo normalizado y puntuación final. */
  inicio: string;
  nucleo: string;
  fin: string;
  /** Sub-palabras del núcleo (un guion une "twenty-five"). */
  partes: string[];
}

function partirPieza(original: string): Pieza {
  const m = original.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}%]*)$/u) ?? [original, "", original, ""];
  const nucleo = sinAcentos(m[2]);
  return { original, inicio: m[1], nucleo, fin: m[3], partes: nucleo.split("-").filter(Boolean) };
}

/** Acumulador de un número en curso (algoritmo clásico de tres niveles). */
class Acumulador {
  private total = 0;
  private actual = 0;
  private decimales = "";
  private enDecimales = false;
  /** true si ya entró al menos un valor (no solo un artículo). */
  tieneValor = false;
  /** Última clase consumida, para las reglas de "and"/"y". */
  ultima: Clase = null;

  agregar(clase: Exclude<Clase, null>): void {
    this.ultima = clase;
    switch (clase.tipo) {
      case "unidad":
        if (this.enDecimales) this.decimales += String(clase.valor);
        else this.actual += clase.valor;
        this.tieneValor = true;
        return;
      case "centena":
        this.actual += clase.valor;
        this.tieneValor = true;
        return;
      case "cien":
        this.actual = (this.actual || 1) * 100;
        this.tieneValor = true;
        return;
      case "digitos":
        this.actual += clase.valor;
        this.tieneValor = true;
        return;
      case "escala": {
        const actual = this.valorActualConDecimales();
        this.enDecimales = false;
        this.decimales = "";
        if (clase.valor >= 1_000_000) {
          // "quinientos mil millones" = (500 000) × 1 000 000; "millón" solo = 1.
          const base = this.total + actual;
          this.total = (base === 0 ? 1 : base) * clase.valor;
        } else {
          // "five hundred thousand" = 500 × 1000; "mil" solo = 1000.
          this.total += (actual === 0 ? 1 : actual) * clase.valor;
        }
        this.actual = 0;
        this.tieneValor = true;
        return;
      }
      case "punto":
        this.enDecimales = true;
        return;
      case "articulo":
        this.actual = 1;
        return;
      case "conjuncion":
        return;
    }
  }

  estaEnDecimales(): boolean {
    return this.enDecimales;
  }

  private valorActualConDecimales(): number {
    if (this.decimales === "") return this.actual;
    return Number(`${Math.trunc(this.actual)}.${this.decimales}`);
  }

  /** Dígitos finales; sin separadores de miles. */
  texto(): string {
    const valor = this.total + this.valorActualConDecimales();
    if (!Number.isFinite(valor)) return "";
    if (Number.isInteger(valor)) return String(valor);
    return String(Number(valor.toFixed(6)));
  }
}

/**
 * Reemplaza en el texto cada número en palabras por sus dígitos.
 * El resto del texto (puntuación, mayúsculas, espacios) se conserva.
 */
export function normalizarNumerosEnPalabras(texto: string, idioma: Idioma): string {
  const lexico = LEXICOS[idioma];
  const fragmentos = texto.split(/(\s+)/);
  const salida: string[] = [];

  let i = 0;
  while (i < fragmentos.length) {
    const fragmento = fragmentos[i];
    if (fragmento === "" || /^\s+$/.test(fragmento)) {
      salida.push(fragmento);
      i += 1;
      continue;
    }

    const pieza = partirPieza(fragmento);
    const clases = pieza.partes.map((parte) => clasificar(parte, lexico));
    if (
      esPorCiento(pieza, anteriorPieza(fragmentos, i)) ||
      !abreNumero(clases, siguientePieza(fragmentos, i), lexico)
    ) {
      salida.push(fragmento);
      i += 1;
      continue;
    }

    // Consumir la secuencia numérica.
    const acumulador = new Acumulador();
    let j = i;
    /** Índice justo después del último fragmento consumido. */
    let finConsumido = i;
    let ultimoFin = "";
    let inicio = pieza.inicio;
    let consumioAlgo = false;
    while (j < fragmentos.length) {
      const actual = fragmentos[j];
      if (/^\s+$/.test(actual) || actual === "") {
        j += 1;
        continue;
      }
      const p = partirPieza(actual);
      // Puntuación delante de una palabra intermedia cierra el número.
      if (consumioAlgo && p.inicio !== "") break;
      const cls = p.partes.map((parte) => clasificar(parte, lexico));
      if (cls.length === 0 || cls.some((c) => c === null)) break;
      if (!continuaNumero(cls, acumulador, siguientePieza(fragmentos, j), lexico, consumioAlgo)) break;
      for (const c of cls) acumulador.agregar(c as Exclude<Clase, null>);
      if (!consumioAlgo) inicio = p.inicio;
      consumioAlgo = true;
      ultimoFin = p.fin;
      j += 1;
      finConsumido = j;
      // La puntuación de cierre ("twenty.", "mil,") termina el número.
      if (p.fin !== "") break;
    }

    if (!consumioAlgo || !acumulador.tieneValor) {
      salida.push(fragmento);
      i += 1;
      continue;
    }

    salida.push(`${inicio}${acumulador.texto()}${ultimoFin}`);
    // El espacio que sigue al número se emite como separador normal.
    i = finConsumido;
  }

  return salida.join("");
}

/** "por ciento" es un porcentaje, no el número 100. */
function esPorCiento(pieza: Pieza, anterior: Pieza | null): boolean {
  return pieza.nucleo === "ciento" && anterior?.nucleo === "por";
}

/** Pieza con contenido anterior a `indice` (sin consumirla). */
function anteriorPieza(fragmentos: string[], indice: number): Pieza | null {
  for (let k = indice - 1; k >= 0; k--) {
    const f = fragmentos[k];
    if (f === "" || /^\s+$/.test(f)) continue;
    return partirPieza(f);
  }
  return null;
}

/** Clase de la siguiente pieza con contenido (sin consumirla). */
function siguientePieza(fragmentos: string[], indice: number): Pieza | null {
  for (let k = indice + 1; k < fragmentos.length; k++) {
    const f = fragmentos[k];
    if (f === "" || /^\s+$/.test(f)) continue;
    return partirPieza(f);
  }
  return null;
}

function clasePrincipal(pieza: Pieza | null, lexico: Lexico): Clase {
  if (!pieza || pieza.partes.length === 0) return null;
  return clasificar(pieza.partes[0], lexico);
}

/**
 * ¿Esta pieza puede ABRIR un número?
 * - Palabras numéricas (unidad, decena, centena, cien): sí.
 * - "mil"/"thousand" solos ("mil millones", "mil personas"): sí, valen 1000.
 * - Millón o más solos ("millones de personas"): no.
 * - Artículos ("a", "un", "una"): solo si sigue "hundred"/"mil"/"millón"…
 * - Dígitos: solo si sigue una escala (si no, se dejan tal cual).
 * - Conjunción o punto decimal: nunca.
 */
function abreNumero(clases: Clase[], siguiente: Pieza | null, lexico: Lexico): boolean {
  if (clases.length === 0 || clases.some((c) => c === null)) return false;
  const primera = clases[0] as Exclude<Clase, null>;
  const proxima = clasePrincipal(siguiente, lexico);
  switch (primera.tipo) {
    case "unidad":
    case "centena":
    case "cien":
      return true;
    case "escala":
      return primera.valor < 1_000_000;
    case "articulo":
      return proxima !== null && (proxima.tipo === "escala" || proxima.tipo === "cien");
    case "digitos":
      return proxima !== null && proxima.tipo === "escala";
    default:
      return false;
  }
}

/** ¿Esta pieza CONTINÚA el número en curso? */
function continuaNumero(
  clases: Clase[],
  acumulador: Acumulador,
  siguiente: Pieza | null,
  lexico: Lexico,
  yaAbierto: boolean,
): boolean {
  const primera = clases[0] as Exclude<Clase, null>;
  if (!yaAbierto) return true;
  const proxima = clasePrincipal(siguiente, lexico);
  switch (primera.tipo) {
    case "conjuncion": {
      // en: "four hundred AND twenty" (tras una centena). es: "treinta Y cinco"
      // (tras una decena). Siempre con una palabra numérica detrás (los
      // dígitos no continúan un número, así que la conjunción tampoco).
      const sigueNumero =
        proxima !== null && (proxima.tipo === "unidad" || proxima.tipo === "centena");
      if (!sigueNumero) return false;
      const ultima = acumulador.ultima;
      if (ultima === null) return false;
      if (lexico === LEXICO_EN) return ultima.tipo === "cien" || ultima.tipo === "escala";
      return ultima.tipo === "unidad" && ultima.valor >= 20 && ultima.valor % 10 === 0;
    }
    case "punto":
      return proxima !== null && proxima.tipo === "unidad" && proxima.valor < 10;
    case "unidad": {
      // Dos unidades seguidas solo si son decena + unidad ("twenty five") o
      // dígitos decimales ("point five seven"). "twenty twenty" (un año) o
      // "two three" no se suman.
      const ultima = acumulador.ultima;
      if (ultima === null || ultima.tipo !== "unidad") return true;
      if (acumulador.estaEnDecimales()) return primera.valor < 10;
      return ultima.valor >= 20 && ultima.valor % 10 === 0 && primera.valor < 10;
    }
    case "articulo":
      // "cinco mil UN ..." no vale; el artículo solo abre.
      return false;
    case "digitos":
      // Dígitos tras palabras ("twenty 5") no se combinan.
      return false;
    default:
      return true;
  }
}
