import { NextRequest, NextResponse } from "next/server";
import { generarVerdictoHablado, VoiceGender } from "@/lib/elevenlabs";
import { limitar } from "@/lib/rate-limit";
import { reportarFallo } from "@/lib/sentry-reporte";
import {
  MENSAJE_TRANSCRIPCION_LARGA,
  excedeLimiteTranscripcion,
} from "@/lib/limites";

export const runtime = "nodejs";

const MENSAJE_ERROR_TTS = "No se pudo generar el audio en este momento.";

/**
 * POST /api/tts
 * body: { texto: string, voz?: "male" | "female" | "random" }
 *
 * Devuelve audio/mpeg si ElevenLabs responde bien.
 * Devuelve 502 con JSON si falla — el cliente (ReproductorVeredicto)
 * interpreta cualquier respuesta que no sea 200 como "usar SpeechSynthesis".
 */
export async function POST(req: NextRequest) {
  // Rate limit por IP (en memoria, por instancia — ver src/lib/rate-limit.ts).
  const bloqueo = limitar(req, "tts");
  if (bloqueo) return bloqueo;

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
  if (excedeLimiteTranscripcion(texto)) {
    return NextResponse.json({ error: MENSAJE_TRANSCRIPCION_LARGA }, { status: 413 });
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
    // El detalle del proveedor se registra server-side y no se devuelve: el
    // cliente solo necesita saber que debe caer a SpeechSynthesis.
    console.error("[/api/tts] fallo ElevenLabs:", err);
    // Acá el proveedor real es ElevenLabs, no el modelo de lenguaje, así que el
    // tag lo refleja. Mismo resumen sanitizado que en las rutas del modelo.
    reportarFallo(err, { proveedor: "elevenlabs" }, { proveedor: "elevenlabs" });
    return NextResponse.json({ error: MENSAJE_ERROR_TTS }, { status: 502 });
  }
}
