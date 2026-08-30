import { NextRequest, NextResponse } from "next/server";
import { generarVerdictoHablado, VoiceGender } from "@/lib/elevenlabs";

export const runtime = "nodejs";

/**
 * POST /api/tts
 * body: { texto: string, voz?: "male" | "female" | "random" }
 *
 * Devuelve audio/mpeg si ElevenLabs responde bien.
 * Devuelve 502 con JSON si falla — el cliente (ReproductorVeredicto)
 * interpreta cualquier respuesta que no sea 200 como "usar SpeechSynthesis".
 */
export async function POST(req: NextRequest) {
  let body: { texto?: string; voz?: VoiceGender };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const texto = body.texto?.trim();
  if (!texto) {
    return NextResponse.json({ error: "Falta 'texto'" }, { status: 400 });
  }

  // Timeout defensivo: si ElevenLabs tarda, fallar rápido y dejar que
  // el cliente caiga a SpeechSynthesis.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const { audio, voiceGender } = await generarVerdictoHablado(
      texto,
      body.voz ?? "random",
      controller.signal
    );
    clearTimeout(timeout);

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Voice-Gender": voiceGender,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    const mensaje = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/tts] fallo ElevenLabs:", mensaje);
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
