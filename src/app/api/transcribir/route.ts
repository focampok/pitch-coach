import { NextResponse } from "next/server";
import { iniciarEvaluacion, rechazarSinCupo, responderEvaluacion } from "@/lib/cupo-evaluacion";
import { transcribirAudio } from "@/lib/elevenlabs";
import { limitar } from "@/lib/rate-limit";
import { reportarFallo } from "@/lib/sentry-reporte";
import { diccionario } from "@/lib/diccionarios";
import { idiomaDeCabecera } from "@/lib/idiomas";
import { resolverIdiomaDeRuta } from "@/lib/idioma-ruta";
import { excedeLimiteAudio, mimeAudioPermitido } from "@/lib/limites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_STT_MS = 60_000;

function mensajeLogSinAudio(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

/**
 * POST /api/transcribir
 * multipart: campo `audio` (File/Blob), campo `idioma` ('es' | 'en'; ausente →
 * 'es', otro valor → 400) y campo `proposito` ('pitch' | 'toma'; ausente u
 * otro valor → 'pitch'). El audio se procesa en memoria y se descarta al
 * obtener el texto. Nunca se escribe a disco ni se adjunta a logs o a Sentry
 * (las claves `audio` y `palabras` ya están en SENSITIVE_KEYS).
 *
 * No descuenta cupo. Con `proposito: "pitch"` y el cupo en 0 responde 429
 * `cupo_evaluacion_agotado` sin llamar a ElevenLabs, para no grabar en vano.
 * `toma` (segunda toma y resolver hallazgos) sigue aunque el cupo esté en 0:
 * el costo lo cobran esas rutas.
 *
 * El idioma va como campo del FormData porque el cuerpo de esta ruta no es
 * JSON. Gobierna los mensajes de error y el hint `language_code` de Scribe
 * (`es` o `en`). El modelo (`ELEVENLABS_SCRIBE_MODEL`) es independiente.
 *
 * → 200 { texto, palabras }  palabras: tokens Scribe con start/end en segundos
 * → 400 { error }  idioma inválido, falta audio o MIME no permitido
 * → 413 { error }  supera MAX_AUDIO_BYTES
 * → 429 { error }  rate limit
 * → 502 { error }  fallo de ElevenLabs / sin key / timeout
 */
export async function POST(request: Request): Promise<NextResponse> {
  const inicio = iniciarEvaluacion(request);
  if (!inicio.continuar) return inicio.respuesta as NextResponse;
  const salir = (response: Response, costo = 0) =>
    responderEvaluacion(request, inicio.ctx, response, costo) as NextResponse;

  const bloqueo = limitar(request, "transcribir");
  if (bloqueo) return salir(bloqueo);

  // Hasta que el FormData no esté parseado, el único idioma disponible es el
  // de la cabecera X-Idioma (el chequeo por content-length corre antes).
  const textosCabecera = diccionario(idiomaDeCabecera(request));

  const contentLength = request.headers.get("content-length");
  if (contentLength && excedeLimiteAudio(Number(contentLength))) {
    return salir(NextResponse.json({ error: textosCabecera.api.audioGrande }, { status: 413 }));
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return salir(NextResponse.json({ error: textosCabecera.api.cuerpoInvalido }, { status: 400 }));
  }

  const idiomaRuta = resolverIdiomaDeRuta(form.get("idioma"), request);
  if (idiomaRuta.tipo === "invalido") return salir(idiomaRuta.respuesta);
  const { idioma, textos } = idiomaRuta;

  // Por defecto "pitch": cualquier valor que no sea "toma" cierra el micrófono
  // cuando ya no quedan prácticas, antes de ElevenLabs.
  const proposito = form.get("proposito") === "toma" ? "toma" : "pitch";
  if (proposito === "pitch") {
    const rechazo = rechazarSinCupo(request, inicio.ctx, 1, idioma);
    if (rechazo) return rechazo as NextResponse;
  }

  const entrada = form.get("audio");
  if (!(entrada instanceof Blob) || entrada.size === 0) {
    return salir(NextResponse.json({ error: textos.api.faltaAudio }, { status: 400 }));
  }
  if (excedeLimiteAudio(entrada.size)) {
    return salir(NextResponse.json({ error: textos.api.audioGrande }, { status: 413 }));
  }
  if (!mimeAudioPermitido(entrada.type)) {
    return salir(NextResponse.json({ error: textos.api.formatoAudioNoSoportado }, { status: 400 }));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_STT_MS);

  try {
    const { texto, palabras } = await transcribirAudio(
      entrada,
      controller.signal,
      idioma,
    );
    // Costo 0: transcribir no es una práctica. El cupo se cobra en el análisis.
    return salir(NextResponse.json({ texto, palabras }), 0);
  } catch (err) {
    // Solo el mensaje de Error (status + recorte del JSON del proveedor).
    // Nunca el Blob, el FormData ni un ArrayBuffer.
    console.error("[/api/transcribir] fallo ElevenLabs:", mensajeLogSinAudio(err));
    reportarFallo(err, { proveedor: "elevenlabs" }, { proveedor: "elevenlabs" });
    return salir(NextResponse.json({ error: textos.api.transcripcionFallida }, { status: 502 }));
  } finally {
    clearTimeout(timeout);
  }
}
