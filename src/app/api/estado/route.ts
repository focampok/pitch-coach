import { NextResponse } from "next/server";
import {
  contactoEvaluacion,
  demoEnVivo,
  limiteEvaluacion,
  secretoCookieEvaluacion,
  urlVideoDemo,
} from "@/lib/config-evaluacion";
import { leerCupo, responderEvaluacion, restantes } from "@/lib/cupo-evaluacion";
import { diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";

// El estado se lee en cada petición (process.env dentro de las funciones).
// force-dynamic evita que Next pre-renderice o cachee esta ruta.
export const dynamic = "force-dynamic";

export interface EstadoEvaluacionPublico {
  liveDemo: boolean;
  limite: number | null;
  restantes: number | null;
  demoVideoUrl: string | null;
  contacto: string | null;
}

/**
 * GET /api/estado
 * Lo que el cliente necesita para la pausa y el cupo, sin secretos.
 * Cache-Control: no-store. Con cupo activo, también X-Eval-* y Set-Cookie
 * si la cookie se crea o se normaliza. No llama a ningún proveedor.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const idioma = idiomaDeCabecera(request);
  const limite = limiteEvaluacion();
  const cuerpo: EstadoEvaluacionPublico = {
    liveDemo: demoEnVivo(),
    limite,
    restantes: null,
    demoVideoUrl: urlVideoDemo(),
    contacto: contactoEvaluacion(),
  };

  if (limite !== null && !secretoCookieEvaluacion()) {
    console.error(
      "[evaluacion] EVAL_LIMIT está definido pero EVAL_COOKIE_SECRET falta o no llega a 32 bytes. Se rechaza la petición.",
    );
    return NextResponse.json(
      {
        error: "evaluacion_no_configurada",
        mensaje: diccionario(idioma).evaluacion.noConfigurada,
        ...cuerpo,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (limite === null) {
    return NextResponse.json(cuerpo, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ctx = { cupo: leerCupo(request), limite };
  cuerpo.restantes = restantes(ctx.cupo);
  const respuesta = NextResponse.json(cuerpo, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
  return responderEvaluacion(request, ctx, respuesta, 0) as NextResponse;
}
