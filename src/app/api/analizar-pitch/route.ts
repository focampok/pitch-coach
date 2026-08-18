import { NextResponse } from "next/server";

// TODO: reemplazar por la llamada real a la Gemini API (src/lib/gemini.ts).
// Recibirá la transcripción + el tipo de pitch elegido + la rúbrica
// correspondiente, y devolverá el JSON estructurado del análisis.
export async function POST() {
  return NextResponse.json({
    score: 0,
    veredicto_corto: "En construcción",
    rubrica: [],
    muletillas: {},
  });
}
