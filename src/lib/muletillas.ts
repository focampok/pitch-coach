import type { ConteoMuletillas } from "@/types/pitch";

// Detección de muletillas por regex/keyword matching sobre la transcripción
// (docs/alcance.md §8). No requiere IA. La lista es ajustable durante pruebas
// con la voz real del usuario.

export interface PatronMuletilla {
  /** Nombre visible que se muestra en el dashboard. */
  etiqueta: string;
  /** Patrón de búsqueda global y case-insensitive (flags "gi"). */
  patron: RegExp;
  /**
   * Ocurrencias mínimas para reportar. Útil para palabras que también son
   * conectores o usos legítimos ("pues", "bueno"): solo se muestran cuando el
   * uso es claramente abusivo. Por defecto 1.
   */
  umbralMin?: number;
}

/** Fuente de verdad de los 21 patrones (detección + resaltado en el dashboard). */
export const PATRONES_MULETILLAS: readonly PatronMuletilla[] = [
  // Relleno vocálico ("eeee", "ehh"). Ojo: la Web Speech API de Chrome suele
  // omitir estos sonidos en la transcripción — el patrón queda para cuando sí
  // llegan al texto.
  { etiqueta: "eeee / ehh", patron: /\b(e{2,}|eh+)\b/gi },
  { etiqueta: "o sea", patron: /o\s+sea/gi },
  // Tolera "decia" sin tilde (Chrome a veces no la escribe).
  { etiqueta: "como les decía", patron: /como\s+les\s+dec[ií]a/gi },
  // Heurística: "este" como muletilla. Contará también el demostrativo
  // ("este producto"); se afina tras pruebas reales.
  { etiqueta: "este…", patron: /\beste\b/gi },
  { etiqueta: "bueno pues", patron: /bueno\s+pues/gi },
  // Tolera "a mi me toco hablar de" sin tildes, común en transcripciones.
  // m[ií] cubre "mi" y "mí" (el acento es la única variante real).
  {
    etiqueta: "a mí me tocó hablar de",
    patron: /a\s+m[ií]\s+me\s+toc[óo]\s+hablar\s+de/gi,
  },
  { etiqueta: "digamos", patron: /\bdigamos\b/gi },
  { etiqueta: "en ese sentido", patron: /en\s+ese\s+sentido/gi },

  // Tier 1 (oratoria, LATAM): comodines y conectivas frecuentes al hablar en
  // público, según listas de referencia. Los patrones toleran la falta de
  // tildes ("basicamente"), común en transcripciones del STT.
  { etiqueta: "es decir", patron: /es\s+decir/gi },
  { etiqueta: "quiero decir", patron: /quiero\s+decir/gi },
  { etiqueta: "en otras palabras", patron: /en\s+otras\s+palabras/gi },
  { etiqueta: "básicamente", patron: /\bb[aá]sicamente\b/gi },
  { etiqueta: "literalmente", patron: /\bliteralmente\b/gi },
  { etiqueta: "prácticamente", patron: /\bpr[aá]cticamente\b/gi },
  { etiqueta: "obviamente", patron: /\bobviamente\b/gi },
  { etiqueta: "en fin", patron: /\ben\s+fin\b/gi },
  // Ojo: "entonces" también es un conector legítimo; el conteo es orientativo.
  { etiqueta: "entonces", patron: /\bentonces\b/gi },

  // Tier 2 (oratoria): apelativa de comprobación y titubeo. "a ver" el STT a
  // veces la escribe "haber"; se reporta igual (el uso legítimo es menos común).
  { etiqueta: "¿me explico?", patron: /me\s+explico\b/gi },
  { etiqueta: "a ver", patron: /a\s+ver\b/gi },
  // "pues" y "bueno" son también conectores/adjetivos legítimos en LATAM; con
  // umbral 3 solo se reportan cuando el uso es abuso real, no una aparición.
  { etiqueta: "pues", patron: /\bpues\b/gi, umbralMin: 3 },
  { etiqueta: "bueno", patron: /\bbueno\b/gi, umbralMin: 3 },
];

/** Clona el regex para no compartir `lastIndex` entre detección y resaltado. */
function clonarPatron(patron: RegExp): RegExp {
  return new RegExp(patron.source, patron.flags);
}

/**
 * Escapa los caracteres con significado en HTML (&, <, >, ", ').
 *
 * Las entidades se escriben con `\u0026` (el ampersand) en lugar del carácter
 * literal para que el propio código fuente no contenga secuencias de markup.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

/**
 * Resalta en HTML las muletillas que superan su umbral (mismo criterio que
 * `detectarMuletillas`). "pues"/"bueno" solo se marcan con ≥3 ocurrencias.
 *
 * La transcripción viene de STT y por lo tanto NO es confiable: se escapa todo
 * el texto antes de insertar las etiquetas `<mark>`, de modo que cualquier
 * `<`, `>` o `&` del original se renderice como texto y no como markup. Los
 * intervalos se calculan sobre el texto crudo y se ensamblan una sola vez, en
 * vez de aplicar `replace` sucesivos sobre HTML ya generado (evita que un
 * patrón posterior coincida dentro del markup insertado).
 */
export function resaltarMuletillas(
  texto: string,
  patrones: readonly PatronMuletilla[] = PATRONES_MULETILLAS,
): string {
  // 1. Solo participan los patrones que superan su umbral en el texto crudo.
  const elegibles = patrones.filter(({ patron, umbralMin = 1 }) => {
    const coincidencias = texto.match(clonarPatron(patron));
    return coincidencias !== null && coincidencias.length >= umbralMin;
  });

  if (elegibles.length === 0) return escaparHtml(texto);

  // 2. Recolecta los intervalos [inicio, fin) de todas las coincidencias.
  const intervalos: { inicio: number; fin: number }[] = [];
  for (const { patron } of elegibles) {
    const regex = clonarPatron(patron);
    let coincidencia: RegExpExecArray | null;
    while ((coincidencia = regex.exec(texto)) !== null) {
      if (coincidencia[0].length === 0) {
        regex.lastIndex += 1; // evita bucle infinito con patrones vacíos
        continue;
      }
      intervalos.push({
        inicio: coincidencia.index,
        fin: coincidencia.index + coincidencia[0].length,
      });
    }
  }

  // 3. Ordena por posición (y el más largo primero) y ensambla escapando cada
  //    tramo; los intervalos que solapan con uno ya emitido se descartan.
  intervalos.sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);

  let html = "";
  let cursor = 0;
  for (const { inicio, fin } of intervalos) {
    if (inicio < cursor) continue;
    html += escaparHtml(texto.slice(cursor, inicio));
    html += `<mark class="pc-muletilla">${escaparHtml(texto.slice(inicio, fin))}</mark>`;
    cursor = fin;
  }
  html += escaparHtml(texto.slice(cursor));

  return html;
}

/** Cuenta ocurrencias de cada muletilla en la transcripción (solo las presentes). */
export function detectarMuletillas(transcripcion: string): ConteoMuletillas {
  const conteos: ConteoMuletillas = {};
  for (const { etiqueta, patron, umbralMin = 1 } of PATRONES_MULETILLAS) {
    const coincidencias = transcripcion.match(clonarPatron(patron));
    if (coincidencias && coincidencias.length >= umbralMin) {
      conteos[etiqueta] = coincidencias.length;
    }
  }
  return conteos;
}
