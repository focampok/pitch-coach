import { NextResponse } from "next/server";
import { transcribirAudio } from "@/lib/elevenlabs";
import { limitar } from "@/lib/rate-limit";
import { reportarFallo } from "@/lib/sentry-reporte";
import {
  MENSAJE_AUDIO_GRANDE,
  excedeLimiteAudio,
  mimeAudioPermitido,
} from "@/lib/limites";

export const runtime = "nodejs";

const MENSAJE_ERROR_STT = "No se pudo transcribir el audio en este momento.";
const TIMEOUT_STT_MS = 60_000;

function mensajeLogSinAudio(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

/**
 * POST /api/transcribir
 * multipart: campo `audio` (File/Blob). El audio se procesa en memoria y se
 * descarta al obtener el texto. Nunca se escribe a disco ni se adjunta a logs
 * o a Sentry (la clave `audio` ya está en SENSITIVE_KEYS).
 *
 * → 200 { texto }
 * → 400 { error }  falta audio o MIME no permitido
 * → 413 { error }  supera MAX_AUDIO_BYTES
 * → 429 { error }  rate limit
 * → 502 { error }  fallo de ElevenLabs / sin key / timeout
 */
export async function POST(request: Request): Promise<NextResponse> {
  const bloqueo = limitar(request, "transcribir");
  if (bloqueo) return bloqueo as NextResponse;

  const contentLength = request.headers.get("content-length");
  if (contentLength && excedeLimiteAudio(Number(contentLength))) {
    return NextResponse.json({ error: MENSAJE_AUDIO_GRANDE }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  const entrada = form.get("audio");
  if (!(entrada instanceof Blob) || entrada.size === 0) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  }
  if (excedeLimiteAudio(entrada.size)) {
    return NextResponse.json({ error: MENSAJE_AUDIO_GRANDE }, { status: 413 });
  }
  if (!mimeAudioPermitido(entrada.type)) {
    return NextResponse.json({ error: "Formato de audio no soportado." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_STT_MS);

  try {
    const texto = await transcribirAudio(entrada, controller.signal);
    return NextResponse.json({ texto });
  } catch (err) {
    // Solo el mensaje de Error (status + recorte del JSON del proveedor).
    // Nunca el Blob, el FormData ni un ArrayBuffer.
    console.error("[/api/transcribir] fallo ElevenLabs:", mensajeLogSinAudio(err));
    reportarFallo(err, { proveedor: "elevenlabs" }, { proveedor: "elevenlabs" });
    return NextResponse.json({ error: MENSAJE_ERROR_STT }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
