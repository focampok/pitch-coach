import { NextResponse } from "next/server";
import type { SolicitudAnalisis, ResultadoAnalisis } from "@/types/pitch";
import { obtenerRubrica } from "@/lib/rubricas";
import { construirPrompt } from "@/lib/prompts";
import { analizarConGemini } from "@/lib/gemini";
import { detectarMuletillas } from "@/lib/muletillas";

// API route del análisis del pitch (docs/alcance.md §13). Recibe la
// transcripción + contexto, llama a Gemini server-side (la API key nunca sale
// del servidor), recalcula muletillas y devuelve el ResultadoAnalisis completo.

const TIPOS_PITCH_VALIDOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);
const DURACIONES_VALIDAS = new Set<number>([1, 2, 3, 4, 5, 6, 7]);

export async function POST(request: Request): Promise<NextResponse> {
  let body: Partial<SolicitudAnalisis>;
  try {
    body = (await request.json()) as Partial<SolicitudAnalisis>;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido (JSON requerido)." }, { status: 400 });
  }

  const errorValidacion = validarSolicitud(body);
  if (errorValidacion) {
    return NextResponse.json({ error: errorValidacion }, { status: 400 });
  }

  const { transcripcion, tipoPitch, duracionMaxima, tiempoRealSegundos } =
    body as SolicitudAnalisis;

  const rubrica = obtenerRubrica(tipoPitch);
  const prompt = construirPrompt({
    transcripcion,
    tipoPitch,
    rubrica,
    tiempoMaximoSegundos: duracionMaxima * 60,
    tiempoRealSegundos,
  });

  try {
    const resultadoGemini = await analizarConGemini(prompt);

    // Las muletillas se recalculan server-side sobre la transcripción
    // (docs/alcance.md §8: no requieren IA). El conteo server-side es la fuente
    // de verdad del JSON final.
    const muletillas = detectarMuletillas(transcripcion);

    const resultado: ResultadoAnalisis = {
      ...resultadoGemini,
      muletillas,
      tiempo_real_segundos: tiempoRealSegundos,
      tiempo_maximo_segundos: duracionMaxima * 60,
    };

    return NextResponse.json(resultado);
  } catch (error) {
    // Error claro, no un 200 con datos vacíos silenciosamente.
    const mensaje = error instanceof Error ? error.message : "Error desconocido al analizar el pitch.";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}

/** Valida los campos de la solicitud; devuelve un mensaje de error o null. */
function validarSolicitud(body: Partial<SolicitudAnalisis>): string | null {
  if (typeof body.transcripcion !== "string" || body.transcripcion.trim() === "") {
    return "La transcripción es obligatoria y no puede estar vacía.";
  }
  if (
    typeof body.tipoPitch !== "string" ||
    !TIPOS_PITCH_VALIDOS.has(body.tipoPitch as string)
  ) {
    return "Tipo de pitch inválido. Debe ser capital, educacion, innovacion o tecnologia.";
  }
  if (
    typeof body.duracionMaxima !== "number" ||
    !DURACIONES_VALIDAS.has(body.duracionMaxima)
  ) {
    return "Duración máxima inválida. Debe ser un preset de 1 a 7 minutos.";
  }
  if (
    typeof body.tiempoRealSegundos !== "number" ||
    !Number.isFinite(body.tiempoRealSegundos) ||
    body.tiempoRealSegundos < 0
  ) {
    return "tiempoRealSegundos inválido. Debe ser un número no negativo.";
  }
  return null;
}
