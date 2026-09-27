import { NextResponse } from "next/server";
import type { SolicitudEvaluacionSparring, TipoPitch } from "@/types/pitch";
import { obtenerPuntoRubrica } from "@/lib/rubricas";
import { construirPromptEvaluacionSparring } from "@/lib/prompts-sparring";
import { evaluarRespuestaSparring } from "@/lib/sparring-modelo";
import { limitar } from "@/lib/rate-limit";
import { nombreProveedorActivo } from "@/lib/modelo";
import { reportarFallo } from "@/lib/sentry-reporte";
import {
  MENSAJE_PUNTO_SPARRING_LARGO,
  MENSAJE_PREGUNTA_SPARRING_LARGA,
  MENSAJE_RESPUESTA_SPARRING_LARGA,
  excedeLimitePuntoSparring,
  excedeLimitePreguntaSparring,
  excedeLimiteRespuestaSparring,
} from "@/lib/limites";

const TIPOS_PITCH_VALIDOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);

const MENSAJE_ERROR_SPARRING =
  "No se pudo evaluar la respuesta en este momento. Inténtalo de nuevo en unos segundos.";

export async function POST(request: Request): Promise<NextResponse> {
  const bloqueo = limitar(request, "sparring-evaluar");
  if (bloqueo) return bloqueo as NextResponse;

  let body: Partial<SolicitudEvaluacionSparring>;
  try {
    body = (await request.json()) as Partial<SolicitudEvaluacionSparring>;
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
  if (typeof body.pregunta !== "string" || body.pregunta.trim() === "") {
    return NextResponse.json({ error: "La pregunta es obligatoria." }, { status: 400 });
  }
  if (typeof body.respuesta !== "string" || body.respuesta.trim() === "") {
    return NextResponse.json({ error: "La respuesta es obligatoria y no puede estar vacía." }, { status: 400 });
  }
  if (excedeLimitePuntoSparring(body.punto)) {
    return NextResponse.json({ error: MENSAJE_PUNTO_SPARRING_LARGO }, { status: 413 });
  }
  if (excedeLimitePreguntaSparring(body.pregunta)) {
    return NextResponse.json({ error: MENSAJE_PREGUNTA_SPARRING_LARGA }, { status: 413 });
  }
  if (excedeLimiteRespuestaSparring(body.respuesta)) {
    return NextResponse.json({ error: MENSAJE_RESPUESTA_SPARRING_LARGA }, { status: 413 });
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
    const resultado = await evaluarRespuestaSparring(
      construirPromptEvaluacionSparring({
        tipoPitch,
        punto: puntoRubrica,
        pregunta: body.pregunta,
        respuesta: body.respuesta,
      }),
    );
    return NextResponse.json({
      cumplido: resultado.cumplido,
      comentario: resultado.comentario,
    });
  } catch (error) {
    console.error("[/api/sparring/evaluar] fallo al evaluar:", error);
    // Resumen sanitizado a Sentry; el detalle del proveedor queda en el log.
    const proveedor = nombreProveedorActivo();
    reportarFallo(
      error,
      { proveedor, nivel: "rapido" },
      { proveedor, nivel: "rapido" },
    );
    return NextResponse.json({ error: MENSAJE_ERROR_SPARRING }, { status: 502 });
  }
}
