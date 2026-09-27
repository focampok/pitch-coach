import { NextResponse } from "next/server";
import type { SolicitudPreguntaSparring, TipoPitch } from "@/types/pitch";
import { obtenerPuntoRubrica } from "@/lib/rubricas";
import { construirPromptPreguntaSparring } from "@/lib/prompts-sparring";
import { generarPreguntaSparring } from "@/lib/sparring-modelo";
import { limitar } from "@/lib/rate-limit";
import {
  MENSAJE_PUNTO_SPARRING_LARGO,
  excedeLimitePuntoSparring,
} from "@/lib/limites";

const TIPOS_PITCH_VALIDOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);

const MENSAJE_ERROR_SPARRING =
  "No se pudo generar la pregunta en este momento. Inténtalo de nuevo en unos segundos.";

export async function POST(request: Request): Promise<NextResponse> {
  const bloqueo = limitar(request, "sparring-pregunta");
  if (bloqueo) return bloqueo as NextResponse;

  let body: Partial<SolicitudPreguntaSparring>;
  try {
    body = (await request.json()) as Partial<SolicitudPreguntaSparring>;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido (JSON requerido)." }, { status: 400 });
  }

  if (
    typeof body.tipoPitch !== "string" ||
    !TIPOS_PITCH_VALIDOS.has(body.tipoPitch)
  ) {
    return NextResponse.json(
      { error: "Tipo de pitch inválido. Debe ser capital, educacion, innovacion o tecnologia." },
      { status: 400 },
    );
  }
  if (typeof body.punto !== "string" || body.punto.trim() === "") {
    return NextResponse.json({ error: "El punto de la rúbrica es obligatorio." }, { status: 400 });
  }
  if (excedeLimitePuntoSparring(body.punto)) {
    return NextResponse.json({ error: MENSAJE_PUNTO_SPARRING_LARGO }, { status: 413 });
  }

  const tipoPitch = body.tipoPitch as TipoPitch;
  const puntoRubrica = obtenerPuntoRubrica(tipoPitch, body.punto.trim());
  if (!puntoRubrica) {
    return NextResponse.json(
      { error: "El punto no pertenece a la rúbrica de este tipo de pitch." },
      { status: 400 },
    );
  }

  try {
    const resultado = await generarPreguntaSparring(
      construirPromptPreguntaSparring(tipoPitch, puntoRubrica),
    );
    return NextResponse.json({ pregunta: resultado.pregunta });
  } catch (error) {
    console.error("[/api/sparring/pregunta] fallo al generar:", error);
    return NextResponse.json({ error: MENSAJE_ERROR_SPARRING }, { status: 502 });
  }
}
