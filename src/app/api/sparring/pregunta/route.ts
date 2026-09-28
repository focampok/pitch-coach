import { NextResponse } from "next/server";
import type { SolicitudPreguntaSparring, TipoPitch } from "@/types/pitch";
import { obtenerPuntoPorId } from "@/lib/rubricas";
import { construirPromptPreguntaSparring } from "@/lib/prompts-sparring";
import { generarPreguntaSparring } from "@/lib/sparring-modelo";
import { limitar } from "@/lib/rate-limit";
import { nombreProveedorActivo } from "@/lib/modelo";
import { reportarFallo } from "@/lib/sentry-reporte";
import { diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { excedeLimitePuntoSparring } from "@/lib/limites";

// Contrato bilingüe: `idioma` ('es' | 'en'; ausente → 'es', otro valor → 400)
// gobierna los mensajes de error de esta ruta.

const TIPOS_PITCH_VALIDOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);

export async function POST(request: Request): Promise<NextResponse> {
  const bloqueo = limitar(request, "sparring-pregunta");
  if (bloqueo) return bloqueo as NextResponse;

  let body: Partial<SolicitudPreguntaSparring>;
  try {
    body = (await request.json()) as Partial<SolicitudPreguntaSparring>;
  } catch {
    const textos = diccionario(idiomaDeCabecera(request));
    return NextResponse.json({ error: textos.api.jsonInvalido }, { status: 400 });
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, request);
  if (idiomaRuta.tipo === "invalido") return idiomaRuta.respuesta;
  const { idioma, textos } = idiomaRuta;

  if (typeof body.tipoPitch !== "string" || !TIPOS_PITCH_VALIDOS.has(body.tipoPitch)) {
    return NextResponse.json({ error: textos.api.tipoPitchInvalido }, { status: 400 });
  }
  if (typeof body.punto !== "string" || body.punto.trim() === "") {
    return NextResponse.json({ error: textos.api.puntoObligatorio }, { status: 400 });
  }
  if (excedeLimitePuntoSparring(body.punto)) {
    return NextResponse.json({ error: textos.api.puntoSparringLargo }, { status: 413 });
  }

  const tipoPitch = body.tipoPitch as TipoPitch;
  const puntoRubrica = obtenerPuntoPorId(tipoPitch, body.punto.trim());
  if (!puntoRubrica) {
    return NextResponse.json({ error: textos.api.puntoFueraDeRubrica }, { status: 400 });
  }

  try {
    const resultado = await generarPreguntaSparring(
      construirPromptPreguntaSparring(
        textos.comun.tipoPitch[tipoPitch],
        puntoRubrica,
        idioma,
      ),
      idioma,
    );
    return NextResponse.json({ pregunta: resultado.pregunta });
  } catch (error) {
    console.error("[/api/sparring/pregunta] fallo al generar:", error);
    // Resumen sanitizado a Sentry; el detalle del proveedor queda en el log.
    const proveedor = nombreProveedorActivo();
    reportarFallo(
      error,
      { proveedor, nivel: "rapido" },
      { proveedor, nivel: "rapido" },
    );
    return NextResponse.json({ error: textos.api.preguntaFallida }, { status: 502 });
  }
}
