/**
 * Orquestador server-side del enriquecimiento con Tavily (§12 del alcance).
 * Se usa solo cuando un punto de rúbrica no se cumplió por falta de una cifra
 * concreta — no es parte del loop crítico.
 *
 * -----------------------------------------------------------------------------
 * FASE B: de sugerencias crudas a resultados verificados
 * -----------------------------------------------------------------------------
 * La Fase A mostraba `results[0]` tal cual. Las pruebas manuales de 3 pitches
 * mostraron que eso entrega basura: artículos de metodología sin cifra, un blog
 * en inglés para un pitch en español, y un choque de nombres (producto "ELF"
 * contra la marca de cosméticos "e.l.f. Beauty").
 *
 * El flujo ahora es:
 *   1. Extraer entidades cortas del pitch (ver entidades-tavily.ts).
 *   2. Redactar una query orientada a CIFRAS (ver query-tavily.ts).
 *   3. Buscar con filtros duros de idioma y dominios excluidos.
 *   4. Elegir el MEJOR resultado, no el primero (ver elegirCandidatos).
 *   5. Extraer el contenido real (ver tavily-extract.ts).
 *   6. Validar que traiga una cifra citable (ver validar-sugerencia.ts).
 *   7. Redactar la frase hablada que cita cifra y fuente.
 * Si cualquier paso no da un resultado verificable, el punto se queda SIN
 * sugerencia: se prefiere no mostrar nada antes que mostrar algo inventado.
 *
 * -----------------------------------------------------------------------------
 * REGLA DE PRIVACIDAD (no negociable)
 * -----------------------------------------------------------------------------
 * A Tavily NUNCA se le manda la transcripción, ni una oración del usuario, ni
 * una cita textual. Lo único que sale del pitch son entidades cortas (hasta 3,
 * de 40 caracteres como máximo cada una) y el nombre visible del punto de
 * rúbrica (etiqueta del producto). La query se limpia de puntuación de oración
 * para que no pueda parecer texto dictado.
 *
 * El diario de diagnóstico (§6) registra SOLO la query final y metadatos
 * (cuántos resultados, si pasó la validación). NUNCA la transcripción ni el
 * contenido extraído.
 * -----------------------------------------------------------------------------
 */

import type { Idioma } from "@/types/idioma";
import type { TipoPitch } from "@/types/pitch";
import { extraerEntidades } from "./entidades-tavily";
import { etiquetaPunto, obtenerPuntoPorId, obtenerRubrica } from "./rubricas";
import {
  construirQueryTavily,
  redactarQueryConModelo,
  type DatosQueryTavily,
} from "./query-tavily";
import { extraerContenido } from "./tavily-extract";
import { comparteEntidad, generarFraseHablada, validarContenido } from "./validar-sugerencia";

// `limpiarTermino` y el constructor puro viven en módulos base (para que la
// Fase B no cree ciclos). Se reexportan acá porque esta es la ruta canónica de
// importación del enriquecimiento.
export { limpiarTermino } from "./texto-corto";
export {
  MAX_QUERY_CARACTERES,
  construirQueryTavily,
  type DatosQueryTavily,
} from "./query-tavily";

/** Sugerencia verificada que sí se le muestra al usuario. */
export interface SugerenciaTavily {
  /** Id del punto de rúbrica. */
  punto: string;
  /** Query que se mandó a Tavily (sin texto del usuario). */
  query: string;
  /** Cifra concreta validada. */
  cifra: string;
  /** Cita textual del contenido que respalda la cifra. */
  cita: string;
  /** Etiqueta de fecha del dato (ej. "2024"). Puede ser "". */
  fecha: string;
  /** Título del resultado de búsqueda, para mostrar como fuente. */
  titulo: string;
  /** URL de la fuente. */
  url: string;
  /** Frase de 8–12 s, lista para decir en voz alta. */
  frase: string;
}

// -----------------------------------------------------------------------------
// Selección de candidatos (paso 4)
// -----------------------------------------------------------------------------

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

/**
 * Dominios de contenido genérico o metodológico que suelen NO dar cifras.
 * Son evidencia dura de las pruebas manuales: fastercapital.com devolvió un
 * artículo de "cómo calcular el tamaño de mercado" y quora.com una pregunta de
 * "cómo calcular TAM/SAM/SOM", ambas sin un solo dato real.
 *
 * Se suman los PROXIES DE TRADUCCIÓN AUTOMÁTICA (`translate.goog` de Google y
 * patrones equivalentes). Son una puerta trasera al problema de idioma que ya
 * cerró `filter_by_language`: sirven la misma página en otro idioma con el
 * dominio envuelto, así que el filtro por dominio del contenido real no los ve.
 *
 * `exclude_domains` es un filtro DURO del contrato de Tavily (máx. 150).
 */
export const DOMINIOS_EXCLUIDOS: readonly string[] = [
  "fastercapital.com",
  "quora.com",
  "reddit.com",
  "medium.com",
  "youtube.com",
  "facebook.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  // Proxies de traducción automática.
  "translate.goog",
  "translate.google.com",
  "translate.googleapis.com",
  "translates.google.com",
  "microsofttranslator.com",
  "translator.microsoft.com",
  "bing.com",
];

/** Cuántos resultados se piden (para poder elegir, no tomar el primero). */
export const MAX_RESULTADOS = 6;

/** Cuántos candidatos se intentan extraer/validar como máximo. */
export const MAX_CANDIDATOS = 2;

/** Puntaje mínimo para considerar un resultado seriamente (si viene score). */
export const SCORE_MINIMO = 0.35;

/**
 * Cuántos puntos de rúbrica reciben el pipeline COMPLETO por invocación.
 *
 * Es el techo real de costo de la ruta: cada punto procesado dispara su propia
 * cadena (query al modelo + búsqueda + hasta `MAX_CANDIDATOS` extracciones +
 * validación + frase hablada). Los puntos fallidos que quedan fuera del techo
 * NO generan ninguna llamada externa: no se consultan ni se registran.
 */
export const MAX_PUNTOS_ENRIQUECIDOS = 2;

/**
 * Elige y ORDENA los candidatos a extraer, sin confiar en el orden de Tavily.
 *
 * Criterio (documentado a propósito, es parte de la entrega):
 *   1. Descarta resultados sin URL.
 *   2. Descarta dominios de `DOMINIOS_EXCLUIDOS` (segunda línea, por si el
 *      filtro del servidor cambia).
 *   3. Prefiere los que traen `score` >= `SCORE_MINIMO`; si ninguno lo alcanza,
 *      igual se consideran (el contenido se valida después, acá solo se prioriza).
 *   4. Ordena por `score` descendente.
 *   5. Devuelve a lo sumo `MAX_CANDIDATOS`.
 */
export function elegirCandidatos(resultados: readonly TavilyResult[]): TavilyResult[] {
  const conUrl = resultados.filter(
    (r): r is TavilyResult & { url: string } => typeof r.url === "string" && r.url.trim() !== "",
  );

  const fueraDeLista = conUrl.filter((r) => !estaExcluido(r.url));
  const base = fueraDeLista.length > 0 ? fueraDeLista : conUrl;

  const conScore = base.filter((r) => typeof r.score === "number" && r.score >= SCORE_MINIMO);
  const candidatos = conScore.length > 0 ? conScore : base;

  return [...candidatos]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_CANDIDATOS);
}

/** true si el host de la URL está en la lista de dominios excluidos. */
export function estaExcluido(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return true; // URL inválida: no es un candidato.
  }
  return DOMINIOS_EXCLUIDOS.some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
}

// -----------------------------------------------------------------------------
// Techo de costo por invocación (Tarea de ajuste)
// -----------------------------------------------------------------------------

/**
 * Recorta los puntos no cumplidos a los `MAX_PUNTOS_ENRIQUECIDOS` primeros en
 * el ORDEN DE LA RÚBRICA del tipo de pitch — no en el orden en que llegaron.
 *
 * El orden no es cosmético: como cada punto dispara una cadena de llamadas
 * externas, quién queda dentro define el costo de la invocación. Los que quedan
 * fuera no se procesan (ni una llamada).
 */
export function elegirPuntosAEnriquecer(
  puntosSinCumplir: readonly { punto: string; comentario?: string }[],
  tipoPitch: TipoPitch,
): { punto: string; comentario?: string }[] {
  const ordenRubrica = new Map(
    obtenerRubrica(tipoPitch).map((punto, indice) => [punto.id, indice]),
  );

  return [...puntosSinCumplir]
    .sort(
      (a, b) =>
        (ordenRubrica.get(a.punto) ?? Number.MAX_SAFE_INTEGER) -
        (ordenRubrica.get(b.punto) ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, MAX_PUNTOS_ENRIQUECIDOS);
}

// -----------------------------------------------------------------------------
// Búsqueda (paso 3)
// -----------------------------------------------------------------------------

interface OpcionesBusqueda {
  idioma: Idioma;
  tipoPitch: TipoPitch;
}

async function buscarEnTavily(
  query: string,
  opciones: OpcionesBusqueda,
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY no configurada");
  }

  // Contrato HTTP de Tavily (docs/guia-integracion-tavily.md §4):
  //   POST https://api.tavily.com/search
  //   Authorization: Bearer {TAVILY_API_KEY}
  //
  // Localización (Fase B, tras investigar el contrato real):
  //   - `language` es SOLO un boost. Por eso se agrega `filter_by_language: true`,
  //     que sí es un filtro DURO y exige `language` (evita el blog en inglés
  //     dentro de un pitch en español).
  //   - `topic` es financiero para un pitch de capital y genérico en el resto.
  //   - `time_range: "year"`: las estadísticas viejas no sirven para un pitch.
  //   - `exclude_domains` es un filtro DURO (máx. 150) y saca los sitios de
  //     contenido genérico/metodológico sin cifras reales.
  //
  // Timeout defensivo: Tavily es enriquecimiento opcional y no debe colgar el
  // análisis. Si tarda más de 8s, el intento falla y ese punto se queda sin
  // sugerencia; el resto del dashboard no se ve afectado.
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: MAX_RESULTADOS,
      include_answer: false,
      language: opciones.idioma,
      filter_by_language: true,
      exclude_domains: DOMINIOS_EXCLUIDOS,
      topic: opciones.tipoPitch === "capital" ? "finance" : "general",
      time_range: "year",
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Tavily respondió ${res.status}`);
  }

  const data = (await res.json()) as TavilyResponse;
  return data.results ?? [];
}

// -----------------------------------------------------------------------------
// Diario de diagnóstico (paso 6 de las tareas)
// -----------------------------------------------------------------------------

/**
 * Registra el desenlace de un punto. SOLO metadatos: la query final (que ya es
 * libre de transcripción por construcción) y si hubo candidatos / si pasó la
 * validación. Nunca el contenido extraído, nunca la transcripción, nunca la
 * cita — eso resolvería el caso "un pitch devolvió nada y no se sabía por qué"
 * sin filtrar datos del usuario.
 */
function diarioPunto(entrada: {
  punto: string;
  query: string;
  candidatos: number;
  extraido: boolean;
  aprobado: boolean;
  motivo: string;
}): void {
  console.info(
    `[tavily] punto=${entrada.punto} candidatos=${entrada.candidatos} extraido=${entrada.extraido} aprobado=${entrada.aprobado} motivo=${entrada.motivo} query="${entrada.query}"`,
  );
}

// -----------------------------------------------------------------------------
// Contexto y orquestación (pasos 1–7)
// -----------------------------------------------------------------------------

/** Fuente ya filtrada: tiene URL y pasó `elegirCandidatos`. */
export interface FuenteBusqueda {
  title: string;
  url: string;
  score?: number;
}

/**
 * Busca y devuelve como máximo `MAX_CANDIDATOS` fuentes.
 * La query la arma el llamador; acá no se toca la transcripción.
 */
export async function buscarFuentes(
  query: string,
  opciones: OpcionesBusqueda,
): Promise<FuenteBusqueda[]> {
  const resultados = await buscarEnTavily(query, opciones);
  return elegirCandidatos(resultados).flatMap((resultado) => {
    if (typeof resultado.url !== "string" || resultado.url.trim() === "") return [];
    return [
      {
        title: resultado.title?.trim() || resultado.url,
        url: resultado.url,
        score: resultado.score,
      },
    ];
  });
}

/** Contexto del pitch que necesita el enriquecimiento. */
export interface ContextoTavily {
  /** Transcripción ya validada por la ruta. NUNCA se envía a Tavily. */
  transcripcion: string;
  tipoPitch: TipoPitch;
  /** Nombre visible del tipo de pitch, en el idioma de la sesión. */
  tipoNombre: string;
  idioma: Idioma;
  /**
   * Entidades ya extraídas. Si vienen, no se vuelve a llamar al modelo.
   * La orquestación de la sala y de las cifras dichas las comparte.
   */
  entidades?: readonly string[];
}

/**
 * Para los puntos de rúbrica NO cumplidos que entran en el techo
 * (`MAX_PUNTOS_ENRIQUECIDOS`, en orden de rúbrica): arma una query orientada a
 * cifras, busca, elige los mejores candidatos, extrae, valida y redacta la
 * frase. Los puntos que quedan fuera del techo no generan ninguna llamada.
 *
 * Es "best effort": cada punto se aísla con su propio try/catch y un fallo
 * (o una validación negativa) simplemente deja ese punto sin sugerencia.
 */
export async function enriquecerConTavily(
  puntosSinCumplir: { punto: string; comentario?: string }[],
  contexto: ContextoTavily,
): Promise<SugerenciaTavily[]> {
  const { transcripcion, tipoPitch, tipoNombre, idioma } = contexto;

  // Se extrae UNA vez para todos los puntos (best-effort: [] si algo falla),
  // salvo que el llamador ya las haya sacado para compartirlas con la sala
  // y con la verificación de cifras dichas.
  const entidades = contexto.entidades
    ? [...contexto.entidades]
    : transcripcion.trim()
      ? await extraerEntidades({ transcripcion, tipoNombre, idioma })
      : [];

  const sugerencias: SugerenciaTavily[] = [];

  // Techo de costo: solo los primeros puntos en orden de rúbrica reciben el
  // pipeline completo. El resto NO genera ninguna llamada externa.
  const aEnriquecer = elegirPuntosAEnriquecer(puntosSinCumplir, tipoPitch);

  // Se corren en paralelo pero cada una se aísla con su propio try/catch.
  await Promise.all(
    aEnriquecer.map(async ({ punto }) => {
      const puntoNombre = etiquetaPunto(punto, idioma, tipoPitch);
      // `queBuscar` es la descripción del producto para ese punto (no texto del
      // usuario): le da al modelo el ángulo correcto para la cifra.
      const definicion = obtenerPuntoPorId(tipoPitch, punto);

      const datosQuery: DatosQueryTavily & { queBuscar?: string } = {
        entidades,
        tipoNombre,
        puntoNombre,
        idioma,
        queBuscar: definicion?.queBuscar[idioma],
      };

      try {
        // Paso 2: query orientada a cifras (con respaldo determinista).
        const queryModelo = await redactarQueryConModelo(datosQuery);
        const query = queryModelo ?? construirQueryTavily(datosQuery);

        // Paso 3: búsqueda con filtros duros.
        const resultados = await buscarEnTavily(query, { idioma, tipoPitch });

        // Paso 4: elegir los mejores candidatos (no el primero a ciegas).
        const candidatos = elegirCandidatos(resultados);
        let extraido = false;
        let aprobado = false;
        let motivo = candidatos.length === 0 ? "sin-candidatos" : "sin-cifra";

        for (const candidato of candidatos) {
          // Paso 5: contenido real.
          const contenido = await extraerContenido(candidato.url!, { personalizar: query });
          if (!contenido) {
            motivo = "sin-extraccion";
            continue;
          }
          extraido = true;
          motivo = "sin-cifra";

          // Paso 6: validación obligatoria — sin cifra citable Y RELEVANTE al
          // tema/sector del pitch, se descarta. Las entidades son el contexto
          // de comparación (mismos términos cortos que ya viajan a Tavily).
          const validacion = await validarContenido(contenido.contenido, idioma, entidades);
          if (!validacion.util) continue;

          // Segunda barrera, sin modelo: lo que se muestra (título, cita, cifra)
          // tiene que repetir una palabra del pitch. Cierra el caso en que el
          // validador acepta una cifra vecina (helado → lácteos de otro país).
          const corpus = `${candidato.title ?? ""} ${validacion.cita} ${validacion.cifra}`;
          if (!comparteEntidad(corpus, entidades)) {
            motivo = "otro-tema";
            continue;
          }

          // Paso 7: frase hablada (con respaldo determinista).
          const frase = await generarFraseHablada({
            cifra: validacion.cifra,
            fechaEtiqueta: validacion.fecha.etiqueta,
            tituloFuente: candidato.title ?? candidato.url!,
            puntoNombre,
            idioma,
          });

          aprobado = true;
          motivo = "ok";
          sugerencias.push({
            punto,
            query,
            cifra: validacion.cifra,
            cita: validacion.cita,
            fecha: validacion.fecha.etiqueta,
            titulo: candidato.title ?? candidato.url!,
            url: candidato.url!,
            frase,
          });
          break;
        }

        diarioPunto({
          punto,
          query,
          candidatos: candidatos.length,
          extraido,
          aprobado,
          motivo,
        });
      } catch (err) {
        console.warn(`[tavily] sin sugerencia para "${punto}":`, err);
      }
    }),
  );

  return sugerencias;
}
