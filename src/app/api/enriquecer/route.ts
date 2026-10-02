import { NextRequest, NextResponse } from "next/server";
import { enriquecerConTavily } from "@/lib/tavily";
import { limitar } from "@/lib/rate-limit";
import { reportarFallo } from "@/lib/sentry-reporte";
import { diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { obtenerRubrica } from "@/lib/rubricas";
import type { TipoPitch } from "@/types/pitch";

export const runtime = "nodejs";

const TIPOS_PITCH_VALIDOS = new Set<string>([
  "capital",
  "educacion",
  "innovacion",
  "tecnologia",
]);

/**
 * POST /api/enriquecer
 * body: {
 *   tema: TipoPitch,              // 'capital' | 'educacion' | 'innovacion' | 'tecnologia'
 *   transcripcion?: string,       // texto ya validado; NUNCA se envía a Tavily
 *   puntosSinCumplir: { punto: string, comentario?: string }[],
 *   idioma?: "es" | "en"          // ausente → 'es'; otro valor → 400
 * }
 *
 * Aunque lleguen más, solo los `MAX_PUNTOS_ENRIQUECIDOS` (2) primeros puntos en
 * el ORDEN DE LA RÚBRICA del tipo reciben el pipeline completo. El techo vive en
 * src/lib/tavily.ts; los puntos que quedan fuera no generan llamadas externas.
 *
 * `tema` transporta el tipo de pitch: es lo que decide el `topic` de la
 * búsqueda y el nombre visible del pitch para degradar la query. El nombre
 * histórico del campo se mantiene por compatibilidad con el cliente.
 *
 * `transcripcion` es OPCIONAL. Solo se usa, server-side, para extraer entidades
 * cortas (nivel `rapido`); la regla de privacidad prohíbe enviar la
 * transcripción o cualquier oración del usuario a Tavily (ver src/lib/tavily.ts
 * y src/lib/entidades-tavily.ts). Si falta, el enriquecimiento se degrada a
 * consultar por el tipo de pitch.
 *
 * Enriquecimiento opcional (§12): no es parte del loop crítico.
 * Si TAVILY_API_KEY no está configurada, o Tavily falla, devuelve
 * sugerencias: [] con 200 — el dashboard simplemente no muestra la sección,
 * nunca debe romper el resto de la UI.
 */
export async function POST(req: NextRequest) {
  // Rate limit por IP (en memoria, por instancia — ver src/lib/rate-limit.ts).
  const bloqueo = limitar(req, "enriquecer");
  if (bloqueo) return bloqueo;

  let body: {
    tema?: string;
    transcripcion?: string;
    puntosSinCumplir?: { punto: string; comentario?: string }[];
    idioma?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    const textos = diccionario(idiomaDeCabecera(req));
    return NextResponse.json(
      { error: textos.api.enriquecimientoInvalido },
      { status: 400 },
    );
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, req);
  if (idiomaRuta.tipo === "invalido") return idiomaRuta.respuesta;

  const tema = body.tema?.trim();

  // `tema` transporta el tipo de pitch. Un valor desconocido no es dato del
  // que se pueda derivar una búsqueda: se degrada en silencio.
  if (!tema || !TIPOS_PITCH_VALIDOS.has(tema)) {
    return NextResponse.json({ sugerencias: [] });
  }

  if (!process.env.TAVILY_API_KEY) {
    // Degradación silenciosa: Tavily es opcional (§12).
    return NextResponse.json({ sugerencias: [] });
  }

  const tipoPitch = tema as TipoPitch;
  const transcripcion = body.transcripcion?.trim() ?? "";

  try {
    const puntos = body.puntosSinCumplir ?? [];
    if (puntos.length === 0) {
      return NextResponse.json({ sugerencias: [] });
    }

    // Solo se aceptan puntos que existan en la rúbrica del tipo; así el nombre
    // visible (y el comentario) que viajan a la query salen del producto y no
    // de texto arbitrario del cliente.
    const rubrica = obtenerRubrica(tipoPitch);
    const idsValidos = new Set(rubrica.map((punto) => punto.id));
    const puntosValidos = puntos.filter(
      (p) => typeof p?.punto === "string" && idsValidos.has(p.punto),
    );
    if (puntosValidos.length === 0) {
      return NextResponse.json({ sugerencias: [] });
    }

    const sugerencias = await enriquecerConTavily(puntosValidos, {
      transcripcion,
      tipoPitch,
      tipoNombre: idiomaRuta.textos.comun.tipoPitch[tipoPitch],
      idioma: idiomaRuta.idioma,
    });
    return NextResponse.json({ sugerencias });
  } catch (err) {
    console.error("[/api/enriquecer] fallo Tavily:", err);
    // El proveedor acá es Tavily, no el modelo de lenguaje.
    reportarFallo(err, { proveedor: "tavily" }, { proveedor: "tavily" });
    // No crítico: se responde 200 con lista vacía en vez de romper el dashboard.
    return NextResponse.json({ sugerencias: [] });
  }
}
