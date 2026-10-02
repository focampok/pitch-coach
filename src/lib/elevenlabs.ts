import type { Idioma } from "@/types/idioma";
import type { ResultadoTranscripcion } from "@/types/pitch";
import { registroIdioma } from "@/lib/idiomas";
import { extraerPalabrasScribe } from "@/lib/guion-transcripcion";

/**
 * Cliente server-side para ElevenLabs (TTS del veredicto y STT).
 * Nunca se llama desde el cliente: la API key vive solo aquí.
 */

export type VoiceGender = "male" | "female" | "random";

/**
 * Error de un fallo HTTP de ElevenLabs (TTS o STT).
 *
 * `codigoHttp` es lo que hace diagnosticable el issue en Sentry: `reportarFallo`
 * descarta el `message` a propósito (puede arrastrar el cuerpo del proveedor y
 * con él texto del usuario), así que el status HTTP solo sobrevive si viaja como
 * propiedad. Sin esto, un 402 de plan/voz se reporta como un `Error ·
 * proveedor=elevenlabs` opaco y hay que reproducirlo a mano para saber qué pasó
 * — que es exactamente lo que pasó con PITCH-COACH-6. Mismo contrato que
 * `ErrorModelo` (ver src/lib/error-modelo.ts y src/lib/sentry-reporte.ts).
 *
 * El `message` conserva el detalle completo para los logs de consola; nunca
 * llega a Sentry.
 */
export class ErrorElevenLabs extends Error {
  codigoHttp?: number;

  constructor(mensaje: string, codigoHttp?: number) {
    super(mensaje);
    this.name = "ErrorElevenLabs";
    this.codigoHttp = codigoHttp;
  }
}

const ELEVENLABS_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

/**
 * Par de variables de entorno por idioma. El género de la sesión no cambia:
 * solo se elige el par. Español (y cualquier llamada sin idioma) usa las
 * variables sin sufijo; inglés, el par `_EN_`.
 */
const CLAVES_VOZ: Record<Idioma, { male: string; female: string }> = {
  es: {
    male: "ELEVENLABS_VOICE_ID_MALE",
    female: "ELEVENLABS_VOICE_ID_FEMALE",
  },
  en: {
    male: "ELEVENLABS_VOICE_ID_EN_MALE",
    female: "ELEVENLABS_VOICE_ID_EN_FEMALE",
  },
};

/**
 * Resuelve el voice_id a usar según la preferencia pedida y el idioma.
 * "random" elige entre la voz de hombre y la de mujer en cada llamada,
 * para variar la voz del coach entre sesiones/intentos. El par de IDs
 * depende del idioma; el género elegido se conserva.
 */
export function resolveVoiceId(
  gender: VoiceGender = "random",
  idioma: Idioma = "es",
): {
  voiceId: string;
  gender: "male" | "female";
} {
  const claves = CLAVES_VOZ[idioma];
  const male = process.env[claves.male];
  const female = process.env[claves.female];

  if (!male || !female) {
    throw new Error(`Faltan ${claves.male} / ${claves.female} en el entorno`);
  }

  let resolved: "male" | "female" = gender === "female" ? "female" : "male";
  if (gender === "random") {
    resolved = Math.random() < 0.5 ? "male" : "female";
  }

  return { voiceId: resolved === "male" ? male : female, gender: resolved };
}

/**
 * Llama a ElevenLabs y devuelve el audio como ArrayBuffer (mp3).
 * Lanza si falla o si no hay API key — el caller decide qué hacer
 * (en este proyecto: caer a SpeechSynthesis).
 */
export async function generarVerdictoHablado(
  texto: string,
  gender: VoiceGender = "random",
  signal?: AbortSignal,
  idioma: Idioma = "es",
): Promise<{ audio: ArrayBuffer; voiceGender: "male" | "female" }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  const { voiceId, gender: resolvedGender } = resolveVoiceId(gender, idioma);

  const response = await fetch(ELEVENLABS_TTS_URL(voiceId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => "");
    throw new ErrorElevenLabs(
      `ElevenLabs respondió ${response.status}: ${detalle.slice(0, 200)}`,
      response.status
    );
  }

  const audio = await response.arrayBuffer();
  return { audio, voiceGender: resolvedGender };
}

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MODELO_SCRIBE_DEFAULT = "scribe_v2";

function nombreArchivoAudio(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base.includes("mp4") || base.includes("m4a")) return "grabacion.mp4";
  if (base.includes("ogg")) return "grabacion.ogg";
  if (base.includes("mpeg") || base.includes("mp3")) return "grabacion.mp3";
  if (base.includes("wav")) return "grabacion.wav";
  return "grabacion.webm";
}

/**
 * Transcribe un Blob de audio con ElevenLabs Scribe (batch).
 * El audio vive solo en memoria: se reenvía como multipart y se descarta
 * al terminar. Nunca se escribe a disco ni se incluye en el Error.
 *
 * Contrato de `POST /v1/speech-to-text` (no se llama al proveedor desde tests):
 * `language_code` es opcional, ISO 639-1 o 639-3. Si se omite (null), Scribe
 * predice el idioma. Lo mandamos porque la sesión ya eligió `es` o `en` y el
 * hint puede mejorar la transcripción. `ELEVENLABS_SCRIBE_MODEL` es solo
 * `model_id` (default `scribe_v2`): no elige idioma.
 * `no_verbatim` se deja apagado: ese flag borra muletillas, y este producto
 * las cuenta.
 * `timestamps_granularity=word`: Scribe incluye `words[].start/end` en
 * segundos. El texto plano sigue yendo al análisis; las marcas alimentan
 * el guion descargable. `none` devolvería `words` sin tiempo.
 */
export async function transcribirAudio(
  audio: Blob,
  signal?: AbortSignal,
  idioma: Idioma = "es",
): Promise<ResultadoTranscripcion> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  const modelId = process.env.ELEVENLABS_SCRIBE_MODEL?.trim() || MODELO_SCRIBE_DEFAULT;
  const form = new FormData();
  form.append("model_id", modelId);
  form.append("language_code", registroIdioma(idioma).codigoStt);
  form.append("tag_audio_events", "false");
  form.append("timestamps_granularity", "word");
  form.append("file", audio, nombreArchivoAudio(audio.type));

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
    signal,
  });

  if (!response.ok) {
    const detalle = await response.text().catch(() => "");
    throw new ErrorElevenLabs(
      `ElevenLabs STT respondió ${response.status}: ${detalle.slice(0, 200)}`,
      response.status,
    );
  }

  const cuerpo: unknown = await response.json();
  const texto =
    cuerpo !== null &&
    typeof cuerpo === "object" &&
    typeof (cuerpo as { text?: unknown }).text === "string"
      ? (cuerpo as { text: string }).text
      : null;
  if (texto === null) {
    throw new Error("ElevenLabs STT respondió sin texto");
  }
  return { texto, palabras: extraerPalabrasScribe(cuerpo) };
}
