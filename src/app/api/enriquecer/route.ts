import { NextRequest, NextResponse } from "next/server";
import { enriquecerConTavily } from "@/lib/tavily";

export const runtime = "nodejs";

/**
 * POST /api/enriquecer
 * body: {
 *   tema: string,                 // ej. tipo de pitch o un resumen corto del tema
 *   puntosSinCumplir: { punto: string, comentario?: string }[]
 * }
 *
 * Enriquecimiento opcional (§12): no es parte del loop crítico.
 * Si TAVILY_API_KEY no está configurada, o Tavily falla, devuelve
 * sugerencias: [] con 200 — el dashboard simplemente no muestra la sección,
 * nunca debe romper el resto de la UI.
 */
export async function POST(req: NextRequest) {
  let body: {
    tema?: string;
    puntosSinCumplir?: { punto: string; comentario?: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tema = body.tema?.trim();
  const puntos = body.puntosSinCumplir ?? [];

  if (!tema || puntos.length === 0) {
    return NextResponse.json({ sugerencias: [] });
  }

  if (!process.env.TAVILY_API_KEY) {
    // Degradación silenciosa: Tavily es opcional (§12).
    return NextResponse.json({ sugerencias: [] });
  }

  try {
    const sugerencias = await enriquecerConTavily(puntos, tema);
    return NextResponse.json({ sugerencias });
  } catch (err) {
    console.error("[/api/enriquecer] fallo Tavily:", err);
    // No crítico: se responde 200 con lista vacía en vez de romper el dashboard.
    return NextResponse.json({ sugerencias: [] });
  }
}
