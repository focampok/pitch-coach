import { NextRequest, NextResponse } from "next/server";
import { generarVerdictoHablado, VoiceGender } from "@/lib/elevenlabs";
import { limitar } from "@/lib/rate-limit";
import { reportarFallo } from "@/lib/sentry-reporte";
import { diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { excedeLimiteTranscripcion } from "@/lib/limites";

export const runtime = "nodejs";

/**
 * POST /api/tts
 * body: { texto: string, voz?: "male" | "female" | "random",
 *         idioma?: "es" | "en" }
 *
 * El `idioma` ('es' | 'en'; ausente → 'es', otro valor → 400) gobierna los
 * mensajes de error y el par de Voice IDs. `voz` fija el género de la sesión
 * (male / female / random); el idioma elige el par de variables
 * (`ELEVENLABS_VOICE_ID_*` en español, `ELEVENLABS_VOICE_ID_EN_*` en inglés).
 * Lo usan el veredicto y las preguntas de Resolver hallazgos, que comparten
 * este endpoint y la misma voz de sesión.
 *
 * Devuelve audio/mpeg si ElevenLabs responde bien.
 * Devuelve 502 con JSON si falla — el cliente (ReproductorVeredicto)
 * interpreta cualquier respuesta que no sea 200 como "usar SpeechSynthesis".
 */
export async function POST(req: NextRequest) {
  // Rate limit por IP (en memoria, por instancia — ver src/lib/rate-limit.ts).
  const bloqueo = limitar(req, "tts");
  if (bloqueo) return bloqueo;

  let body: { texto?: string; voz?: VoiceGender; idioma?: unknown };
  try {
    body = await req.json();
  } catch {
    const textos = diccionario(idiomaDeCabecera(req));
    return NextResponse.json({ error: textos.api.jsonInvalido }, { status: 400 });
  }

  const idiomaRuta = resolverIdiomaDeRuta(body.idioma, req);
  if (idiomaRuta.tipo === "invalido") return idiomaRuta.respuesta;
  const { idioma, textos } = idiomaRuta;

  const texto = body.texto?.trim();
  if (!texto) {
    return NextResponse.json({ error: textos.api.faltaTexto }, { status: 400 });
  }
  if (excedeLimiteTranscripcion(texto)) {
    return NextResponse.json({ error: textos.api.transcripcionLarga }, { status: 413 });
  }

  // Timeout defensivo: si ElevenLabs tarda, fallar rápido y dejar que
  // el cliente caiga a SpeechSynthesis.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const { audio, voiceGender } = await generarVerdictoHablado(
      texto,
      body.voz ?? "random",
      controller.signal,
      idioma,
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
    return NextResponse.json({ error: textos.api.ttsFallido }, { status: 502 });
  }
}
