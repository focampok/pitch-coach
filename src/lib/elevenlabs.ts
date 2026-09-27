/**
 * Cliente server-side para ElevenLabs (TTS del veredicto).
 * Nunca se llama desde el cliente: la API key vive solo aquí.
 */

export type VoiceGender = "male" | "female" | "random";

const ELEVENLABS_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

/**
 * Resuelve el voice_id a usar según la preferencia pedida.
 * "random" elige entre la voz de hombre y la de mujer en cada llamada,
 * para variar la voz del coach entre sesiones/intentos.
 */
export function resolveVoiceId(gender: VoiceGender = "random"): {
  voiceId: string;
  gender: "male" | "female";
} {
  const male = process.env.ELEVENLABS_VOICE_ID_MALE;
  const female = process.env.ELEVENLABS_VOICE_ID_FEMALE;

  if (!male || !female) {
    throw new Error(
      "Faltan ELEVENLABS_VOICE_ID_MALE / ELEVENLABS_VOICE_ID_FEMALE en el entorno"
    );
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
  signal?: AbortSignal
): Promise<{ audio: ArrayBuffer; voiceGender: "male" | "female" }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  const { voiceId, gender: resolvedGender } = resolveVoiceId(gender);

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
    throw new Error(
      `ElevenLabs respondió ${response.status}: ${detalle.slice(0, 200)}`
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
 */
export async function transcribirAudio(
  audio: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  const modelId = process.env.ELEVENLABS_SCRIBE_MODEL?.trim() || MODELO_SCRIBE_DEFAULT;
  const form = new FormData();
  form.append("model_id", modelId);
  form.append("language_code", "es");
  form.append("tag_audio_events", "false");
  form.append("timestamps_granularity", "none");
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
    throw new Error(
      `ElevenLabs STT respondió ${response.status}: ${detalle.slice(0, 200)}`,
    );
  }

  const cuerpo = (await response.json()) as { text?: unknown };
  if (typeof cuerpo.text !== "string") {
    throw new Error("ElevenLabs STT respondió sin texto");
  }
  return cuerpo.text;
}
