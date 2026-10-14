import { NextResponse } from "next/server";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { idiomaDeCabecera } from "@/lib/idiomas";
import {
  excedeLimitePuntoSparring,
  excedeLimiteRespuestaSparring,
} from "@/lib/limites";
import { diccionario } from "@/lib/diccionarios";
import { nombreProveedorActivo } from "@/lib/modelo";
import { iniciarEvaluacion, rechazarSinCupo, responderEvaluacion } from "@/lib/cupo-evaluacion";
import { limitar } from "@/lib/rate-limit";
import { obtenerPuntoPorId } from "@/lib/rubricas";
import { reportarFallo } from "@/lib/sentry-reporte";
import { evaluarSegundaToma } from "@/lib/segunda-toma";
import { MAX_CIFRA_DICHA_CARACTERES } from "@/lib/cifras-dichas";
import type { TipoPitch } from "@/types/pitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = new Set<string>(["capital", "educacion", "innovacion", "tecnologia"]);

/**
 * POST /api/segunda-toma
 * Juzga una réplica de hasta 45 segundos sobre un punto no cumplido.
 * `cifra` es opcional: si viene, el servidor mira si sus dígitos aparecen
 * en lo dicho. La cifra no decide el punto; solo se informa.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const inicio = iniciarEvaluacion(request);
  if (!inicio.continuar) return inicio.respuesta as NextResponse;
  const salir = (response: Response, costo = 0) =>
    responderEvaluacion(request, inicio.ctx, response, costo) as NextResponse;

  const bloqueo = limitar(request, "segunda-toma");
  if (bloqueo) return salir(bloqueo);

  let body: {
    tipoPitch?: string;
    idioma?: unknown;
    punto?: string;
    respuesta?: string;
    cifra?: string;
  };
  try {
    body = await request.json();
  } catch {
    const textos = diccionario(idiomaDeCabecera(request));
    return salir(NextResponse.json({ error: textos.api.jsonInvalido }, { status: 400 }));
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, request);
  if (idiomaRuta.tipo === "invalido") return salir(idiomaRuta.respuesta);
  const { idioma, textos } = idiomaRuta;

  if (typeof body.tipoPitch !== "string" || !TIPOS.has(body.tipoPitch)) {
    return salir(NextResponse.json({ error: textos.api.tipoPitchInvalido }, { status: 400 }));
  }
  if (typeof body.punto !== "string" || body.punto.trim() === "") {
    return salir(NextResponse.json({ error: textos.api.puntoObligatorio }, { status: 400 }));
  }
  if (typeof body.respuesta !== "string" || body.respuesta.trim() === "") {
    return salir(NextResponse.json({ error: textos.api.respuestaObligatoria }, { status: 400 }));
  }
  if (excedeLimitePuntoSparring(body.punto)) {
    return salir(NextResponse.json({ error: textos.api.puntoSparringLargo }, { status: 413 }));
  }
  if (excedeLimiteRespuestaSparring(body.respuesta)) {
    return salir(NextResponse.json({ error: textos.api.respuestaSparringLarga }, { status: 413 }));
  }

  const tipoPitch = body.tipoPitch as TipoPitch;
  if (!obtenerPuntoPorId(tipoPitch, body.punto.trim())) {
    return salir(NextResponse.json({ error: textos.api.puntoFueraDeRubrica }, { status: 400 }));
  }

  const cifra =
    typeof body.cifra === "string" ? body.cifra.trim().slice(0, MAX_CIFRA_DICHA_CARACTERES) : "";

  const rechazo = rechazarSinCupo(request, inicio.ctx, 1, idioma);
  if (rechazo) return rechazo as NextResponse;

  try {
    const resultado = await evaluarSegundaToma({
      tipoPitch,
      tipoNombre: textos.comun.tipoPitch[tipoPitch],
      puntoId: body.punto.trim(),
      idioma,
      respuesta: body.respuesta.trim(),
      ...(cifra ? { cifra } : {}),
    });
    return salir(NextResponse.json(resultado), 1);
  } catch (error) {
    console.error("[/api/segunda-toma] fallo:", error);
    const proveedor = nombreProveedorActivo();
    reportarFallo(error, { proveedor, nivel: "rapido" }, { proveedor, nivel: "rapido" });
    return salir(NextResponse.json({ error: textos.api.evaluacionFallida }, { status: 502 }));
  }
}
