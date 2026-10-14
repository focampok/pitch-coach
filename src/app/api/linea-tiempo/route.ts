import { NextRequest, NextResponse } from "next/server";
import { extraerPalabrasScribe } from "@/lib/guion-transcripcion";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { excedeLimiteTranscripcion } from "@/lib/limites";
import { ubicarPuntosEnAudio } from "@/lib/linea-tiempo";
import { nombreProveedorActivo } from "@/lib/modelo";
import { diccionario } from "@/lib/diccionarios";
import { iniciarEvaluacion, responderEvaluacion } from "@/lib/cupo-evaluacion";
import { limitar } from "@/lib/rate-limit";
import { esIdDePunto } from "@/lib/rubricas";
import { reportarFallo } from "@/lib/sentry-reporte";
import type { TipoPitch } from "@/types/pitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);

/**
 * POST /api/linea-tiempo
 * Ubica los puntos de rúbrica ya cubiertos sobre las marcas de Scribe.
 * Sin marcas, o si el modelo falla, responde 200 con tramos: [].
 * La transcripción va al modelo. No va a Tavily.
 */
export async function POST(req: NextRequest) {
  const inicio = iniciarEvaluacion(req);
  if (!inicio.continuar) return inicio.respuesta;
  const salir = (response: Response) => responderEvaluacion(req, inicio.ctx, response, 0);

  const bloqueo = limitar(req, "linea-tiempo");
  if (bloqueo) return salir(bloqueo);

  let body: {
    tipoPitch?: string;
    idioma?: unknown;
    transcripcion?: string;
    palabras?: unknown;
    puntosCumplidos?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    const textos = diccionario(idiomaDeCabecera(req));
    return salir(NextResponse.json({ error: textos.api.jsonInvalido }, { status: 400 }));
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, req);
  if (idiomaRuta.tipo === "invalido") return salir(idiomaRuta.respuesta);

  if (typeof body.tipoPitch !== "string" || !TIPOS.has(body.tipoPitch)) {
    return salir(NextResponse.json({ error: idiomaRuta.textos.api.tipoPitchInvalido }, { status: 400 }));
  }
  const transcripcion = body.transcripcion?.trim() ?? "";
  if (transcripcion === "") {
    return salir(NextResponse.json({ error: idiomaRuta.textos.api.transcripcionObligatoria }, { status: 400 }));
  }
  if (excedeLimiteTranscripcion(transcripcion)) {
    return salir(NextResponse.json({ error: idiomaRuta.textos.api.transcripcionLarga }, { status: 413 }));
  }

  const tipoPitch = body.tipoPitch as TipoPitch;
  const puntos = Array.isArray(body.puntosCumplidos)
    ? body.puntosCumplidos.filter((id): id is string => esIdDePunto(id, tipoPitch))
    : [];
  const palabras = extraerPalabrasScribe({ palabras: body.palabras }).slice(0, 2500);

  try {
    const tramos = await ubicarPuntosEnAudio({
      idioma: idiomaRuta.idioma,
      tipoPitch,
      palabras,
      puntosCumplidos: puntos,
    });
    return salir(NextResponse.json({ tramos }));
  } catch (err) {
    console.error("[/api/linea-tiempo] fallo:", err);
    const proveedor = nombreProveedorActivo();
    reportarFallo(err, { proveedor, nivel: "rapido" }, { proveedor, nivel: "rapido" });
    return salir(NextResponse.json({ tramos: [] }));
  }
}
