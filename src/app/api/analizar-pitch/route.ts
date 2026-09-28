import { NextResponse } from "next/server";
import type { SolicitudAnalisis, ResultadoAnalisis } from "@/types/pitch";
import type { NivelAnalisis } from "@/lib/modelo";
import { nombreProveedorActivo } from "@/lib/modelo";
import { reportarFallo } from "@/lib/sentry-reporte";
import { obtenerRubrica, type PuntoRubrica } from "@/lib/rubricas";
import { construirPrompt } from "@/lib/prompts";
import { analizarConModelo } from "@/lib/analisis-modelo";
import { detectarMuletillas } from "@/lib/muletillas";
import { limitar } from "@/lib/rate-limit";
import { diccionario, type Diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import {
  excedeLimiteTranscripcion,
} from "@/lib/limites";

// API route del análisis del pitch (docs/alcance.md §13). Recibe la
// transcripción + contexto, llama al modelo server-side (la clave nunca sale
// del servidor), recalcula muletillas y devuelve el ResultadoAnalisis completo.
//
// Contrato bilingüe: el campo `idioma` del cuerpo ('es' | 'en'; ausente → 'es',
// otro valor → 400) gobierna los mensajes de error que devuelve esta ruta.

const TIPOS_PITCH_VALIDOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);
const DURACIONES_VALIDAS = new Set<number>([1, 2, 3, 4, 5, 6, 7]);
const NIVELES_VALIDOS = new Set<NivelAnalisis>(["estandar", "ultra", "rapido"]);

type TextosApi = Diccionario["api"];

export async function POST(request: Request): Promise<NextResponse> {
  // Rate limit por IP (en memoria, por instancia — ver src/lib/rate-limit.ts).
  // El 429 sale en el idioma de la cabecera X-Idioma: corre antes del cuerpo.
  const bloqueo = limitar(request, "analizar-pitch");
  if (bloqueo) return bloqueo as NextResponse;

  let body: Partial<SolicitudAnalisis>;
  try {
    body = (await request.json()) as Partial<SolicitudAnalisis>;
  } catch {
    // Sin cuerpo legible no hay campo `idioma`: manda la cabecera.
    const textos = diccionario(idiomaDeCabecera(request));
    return NextResponse.json({ error: textos.api.jsonInvalido }, { status: 400 });
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, request);
  if (idiomaRuta.tipo === "invalido") return idiomaRuta.respuesta;
  const { idioma, textos } = idiomaRuta;

  const errorValidacion = validarSolicitud(body, textos.api);
  if (errorValidacion) {
    return NextResponse.json({ error: errorValidacion }, { status: 400 });
  }

  const { transcripcion, tipoPitch, duracionMaxima, tiempoRealSegundos, nivel } =
    body as SolicitudAnalisis;

  // Límite duro de entrada: se corta antes de gastar cuota del modelo.
  if (excedeLimiteTranscripcion(transcripcion)) {
    return NextResponse.json({ error: textos.api.transcripcionLarga }, { status: 413 });
  }

  const rubrica = obtenerRubrica(tipoPitch);
  const prompt = construirPrompt({
    transcripcion,
    tipoNombre: textos.comun.tipoPitch[tipoPitch],
    rubrica,
    tiempoMaximoSegundos: duracionMaxima * 60,
    tiempoRealSegundos,
    idioma,
    nivel: nivel ?? "estandar",
    puntosNoCumplidosPrevios: filtrarPuntosPrevios(body.puntosNoCumplidosPrevios, rubrica),
  });

  try {
    const analisis = await analizarConModelo(prompt, rubrica, idioma, nivel ?? "estandar");

    // Las muletillas se recalculan server-side sobre la transcripción
    // (docs/alcance.md §8: no requieren IA). El conteo server-side es la fuente
    // de verdad del JSON final.
    const muletillas = detectarMuletillas(transcripcion, idioma);

    const resultado: ResultadoAnalisis = {
      score: analisis.score,
      veredicto_corto: analisis.veredicto_corto,
      rubrica: analisis.rubrica,
      muletillas,
      tiempo_real_segundos: tiempoRealSegundos,
      tiempo_maximo_segundos: duracionMaxima * 60,
      ...(analisis.traza ? { traza: analisis.traza } : {}),
    };

    return NextResponse.json(resultado);
  } catch (error) {
    // El detalle del proveedor se registra server-side y NUNCA se devuelve al
    // cliente: hacia fuera solo va un mensaje genérico.
    console.error("[/api/analizar-pitch] fallo el análisis:", error);
    // A Sentry va un resumen sanitizado, nunca el error crudo: el mensaje de
    // ErrorModelo puede arrastrar el cuerpo del proveedor y, con él, la
    // transcripción. Ver src/lib/sentry-reporte.ts.
    const nivelEfectivo = nivel ?? "estandar";
    const proveedor = nombreProveedorActivo();
    reportarFallo(
      error,
      { proveedor, nivel: nivelEfectivo },
      { proveedor, nivel: nivelEfectivo },
    );
    return NextResponse.json({ error: textos.api.analisisFallido }, { status: 502 });
  }
}

/**
 * Deja solo ids que coinciden exactamente con un punto de la rúbrica.
 * Cualquier otro texto (instrucciones, transcripción, comentarios, el nombre
 * en español de una entrada vieja) se descarta.
 */
function filtrarPuntosPrevios(
  valor: unknown,
  rubrica: readonly PuntoRubrica[],
): string[] {
  if (!Array.isArray(valor)) return [];
  const permitidos = new Set(rubrica.map((punto) => punto.id));
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const item of valor.slice(0, rubrica.length)) {
    if (typeof item !== "string") continue;
    const nombre = item.trim();
    if (!permitidos.has(nombre) || vistos.has(nombre)) continue;
    vistos.add(nombre);
    salida.push(nombre);
  }
  return salida;
}

/** Valida los campos de la solicitud; devuelve un mensaje de error o null. */
function validarSolicitud(
  body: Partial<SolicitudAnalisis>,
  textos: TextosApi,
): string | null {
  if (typeof body.transcripcion !== "string" || body.transcripcion.trim() === "") {
    return textos.transcripcionObligatoria;
  }
  if (
    typeof body.tipoPitch !== "string" ||
    !TIPOS_PITCH_VALIDOS.has(body.tipoPitch as string)
  ) {
    return textos.tipoPitchInvalido;
  }
  if (
    typeof body.duracionMaxima !== "number" ||
    !DURACIONES_VALIDAS.has(body.duracionMaxima)
  ) {
    return textos.duracionInvalida;
  }
  if (
    typeof body.tiempoRealSegundos !== "number" ||
    !Number.isFinite(body.tiempoRealSegundos) ||
    body.tiempoRealSegundos < 0
  ) {
    return textos.tiempoRealInvalido;
  }
  if (body.nivel !== undefined && !NIVELES_VALIDOS.has(body.nivel as NivelAnalisis)) {
    return textos.nivelInvalido;
  }
  return null;
}
