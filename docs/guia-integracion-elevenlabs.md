# Guía de integración ElevenLabs (extraída de Pitch Coach)

Cómo reutilizar en otro proyecto la lógica de voz (TTS) de este repo: API key, llamada REST a `text-to-speech`, selección de voz (hombre/mujer/random), la API route que oculta la key y el **fallback obligatorio a SpeechSynthesis** para que el usuario nunca se quede sin audio.

No hace falta el SDK oficial de ElevenLabs. Pitch Coach habla con la API REST de `api.elevenlabs.io` usando `fetch` nativo, tanto en servidor como en navegador.

---

## 0. Alcance: qué es "lógica de voz" aquí (y qué no)

| Tipo de voz | En este repo | Motor | ¿Se extrae? |
|---|---|---|---|
| TTS — leer el veredicto en voz alta | Sí | ElevenLabs + fallback SpeechSynthesis | **Sí, esta guía** |
| STT — transcribir el discurso del usuario | Sí | Web Speech API del navegador (`GrabadorVoz.tsx`) | No usa ElevenLabs |

Punto importante: aunque `.env.example` menciona "opcionalmente Scribe (STT)", **no hay integración de Scribe en el código**. La transcripción es Web Speech API nativa del navegador. Si tu otro proyecto necesita STT, ElevenLabs sería una pieza nueva, no una extracción.

---

## 1. Qué es reutilizable y qué no

| Pieza | Archivo en este repo | ¿Se copia tal cual? |
|---|---|---|
| Cliente server-side de ElevenLabs (fetch + selección de voz) | `src/lib/elevenlabs.ts` | Sí, es el núcleo. Cambia el nombre si quieres. |
| API route que oculta la key | `src/app/api/tts/route.ts` | El patrón sí; valida `texto` con tu contrato. |
| Componente cliente que reproduce y degrada | `src/components/ReproductorVeredicto.tsx` | El patrón sí; cambia el texto prop por el tuyo. |
| Variables de entorno | `.env.example` | Sí (las keys `ELEVENLABS_*`). |
| Voz hablada / qué texto se lee | `src/lib/prompts.ts` (veredicto_corto), `src/types/pitch.ts` | No. Es dominio de Pitch Coach. |

**Dependencias:** ninguna extra. `package.json` no incluye SDK de ElevenLabs. Bastan `fetch`, TypeScript, variables de entorno y la Web Speech API (que es del navegador, no una dependencia).

---

## 2. Principios que no debes romper

1. **La API key vive solo en el servidor.** Se lee de `process.env.ELEVENLABS_API_KEY`. Nunca `NEXT_PUBLIC_ELEVENLABS_API_KEY` ni hardcode en el cliente.
2. **El navegador nunca llama a ElevenLabs.** El frontend pega a tu API route; la route llama a ElevenLabs con la key.
3. **SpeechSynthesis es un fallback obligatorio, nunca se quita.** La premisa de producto es: el usuario siempre escucha el texto, sin importar si ElevenLabs cae, tarda, o el navegador no reproduce el mp3. Si tu caso no exige "siempre suena", al menos decide explícitamente qué pasa sin key.
4. **Fallar rápido, no lento.** Hay un timeout de 6 s tanto en la route como en el fetch del cliente. Un TTS que tarda más que eso se abandona y se degrada en vez de dejar al usuario esperando un spinner.
5. **Voice IDs por entorno, no hardcode.** `ELEVENLABS_VOICE_ID_MALE` / `ELEVENLABS_VOICE_ID_FEMALE`. La voz es configuración de deploy, no código.

En Next.js App Router, `.env.local` alimenta el servidor. En Railway (u otro host), replica las mismas keys en el panel de variables.

---

## 3. Variables de entorno

Copia esto a `.env.example` del otro proyecto (sin valores reales) y a `.env.local` / al host de deploy (con valores):

```bash
# Clave de ElevenLabs (TTS). Solo server-side. Nunca prefijo NEXT_PUBLIC_.
ELEVENLABS_API_KEY=

# Voice IDs (ElevenLabs → VoiceLab → tu voz → Voice ID, 32 chars hex).
# Solo server-side. Si faltan, la route falla y el cliente degrada a SpeechSynthesis.
ELEVENLABS_VOICE_ID_MALE=
ELEVENLABS_VOICE_ID_FEMALE=
```

Cómo se obtienen los Voice IDs: en el [dashboard de ElevenLabs](https://elevenlabs.io/voice-lab) cada voz de tu biblioteca muestra su Voice ID. También puedes listarlas por API (`GET /v1/voices`) con tu key. Son strings estables de ~32 caracteres hex.

La API key se crea en [elevenlabs.io → Settings → API Keys](https://elevenlabs.io/app/settings/api-keys).

---

## 4. Contrato HTTP con ElevenLabs

Endpoint no-streaming (devuelve el audio completo como mp3):

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
Content-Type: application/json
xi-api-key: {ELEVENLABS_API_KEY}
Accept: audio/mpeg
```

Cuerpo (el de este proyecto):

```json
{
  "text": "<texto a leer>",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

- `xi-api-key` es el header de auth (no `Authorization: Bearer`).
- `model_id`: este repo fija `eleven_multilingual_v2` (soporta español). ElevenLabs va moviendo cuál es el modelo multilingual recomendado; es **un solo string en el body**, así que verifica en la doc actual cuál conviene antes de fijarlo en el otro proyecto.
- `voice_settings`:
  - `stability` (0–1): 0.5 equilibra consistencia vs. variación. Sube hacia 1 si notas que la voz "respira" demasiado o pierde el tono.
  - `similarity_boost` (0–1): 0.75 es fidelidad a la voz original. Si suena robótica, bájalo.
- Respuesta 200: **`audio/mpeg` binario** (todo el archivo). Para streaming (primer byte rápido) existe `ws://` / `POST .../text-to-speech/{voiceId}/stream`, pero aquí se usa el no-streaming y alcanza.

### Cómo se lee el audio en el servidor

```ts
const audio = await response.arrayBuffer(); // ArrayBuffer mp3, listo para devolver
```

### Códigos de error típicos de ElevenLabs

| HTTP | Significado |
|---|---|
| 401 | Key inválida o sin crédito |
| 422 | `voice_id` inexistente o no válido para tu cuenta |
| 429 | Rate limit / cuota |
| 5xx | Caída del servicio |

**Esto importa:** en este repo **todo** status no-2xx se lanza como `Error` y la route responde **502**. Un 401/422 por config mala no "cuelga": falla rápido y el cliente degrada a SpeechSynthesis. El síntoma de config rota es silencioso para el usuario (oye la voz nativa) y solo visible en el `console.error` de la route. Si en tu proyecto quieres distinguir "config mal" de "servicio caído", revisa el `err.status` antes de mapearlo.

---

## 5. Selección de voz: male / female / random

El cliente expone un tipo de voz y lo resuelve **en el servidor**:

```ts
type VoiceGender = "male" | "female" | "random";
```

- `"male"` / `"female"` → usa el Voice ID correspondiente.
- `"random"` → `Math.random() < 0.5` elige hombre o mujer **en cada llamada**. En Pitch Coach la idea es variar la voz del coach entre sesiones/intentos sin que el usuario la configure.

La voz resuelta se devuelve al servidor (para el header de respuesta) y a la UI (para poder mostrar quién habla, si quieres):

```ts
resolveVoiceId(gender) // → { voiceId: string, gender: "male" | "female" }
```

---

## 6. La API route (Next.js App Router)

El frontend **nunca importa** el cliente de ElevenLabs. Hace `POST` a la route; la route lee la key y llama a ElevenLabs. `runtime = "nodejs"` (necesario para `process.env` y fetch server-side).

Contrato de la route (el de este repo):

```
POST /api/tts
body: { texto: string, voz?: "male" | "female" | "random" }
→ 200 audio/mpeg  + header X-Voice-Gender
→ 400 { error }   body inválido o falta "texto"
→ 413 { error }   texto por encima del límite (8000 caracteres)
→ 429 { error }   rate limit por IP (10 req / 10 min, en memoria) + Retry-After
→ 502 { error }   ElevenLabs falló / sin key / timeout
```

Detalles que vale copiar:

- **Timeout defensivo de 6 s con `AbortController`** en la route, para no dejar colgado un request si ElevenLabs tarda. La señal se pasa al `fetch` interno.
- **Límites de entrada antes de llamar al proveedor**: rechaza cuerpos por encima del tope (413) y aplica un rate limit por IP en memoria (429 + `Retry-After`). Al ser en memoria, el límite efectivo se multiplica por el número de instancias.
- Los headers de respuesta 200: `Content-Type: audio/mpeg`, `X-Voice-Gender` (qué voz habló, útil si la UI quiere mostrarlo) y `Cache-Control: no-store` (audio generado por request).
- Cualquier fallo interno → **502 JSON**, nunca 200 vacío. El `console.error` registra el motivo.
- Si la key o los Voice IDs no están, el cliente lanza un `Error` con mensaje claro en español → la route lo convierte en 502 → el cliente degrada.

---

## 7. El componente cliente y el fallback obligatorio

Es la pieza más delicada. Orden de intento:

1. **ElevenLabs**: `POST /api/tts` → si es 200, `res.blob()` → `URL.createObjectURL` → `<audio>` → `play()`.
2. **Si algo falla** (red, timeout, rate limit, el navegador no puede reproducir el mp3) → **SpeechSynthesis** con el mismo texto. El usuario nunca nota una interrupción del loop.

Detalles del fallback nativo que conviene mantener:

- `window.speechSynthesis.cancel()` antes de hablar (por si quedó algo pendiente).
- `utterance.lang = "es-419"` — español LATAM. Cambia al locale de tu audiencia.
- `utterance.rate = 1`.
- Limpieza en unmount: `audio.pause()` + `speechSynthesis.cancel()` (si no, el navegador sigue hablando después de desmontar el componente).
- `URL.revokeObjectURL(url)` al terminar o fallar la reproducción (evita fugas de memoria en sesiones largas).
- **Guard contra doble disparo** (`yaIntentadoRef`): evita reproducir dos veces por StrictMode/re-renders con el mismo texto, y se reinicia si cambia el texto (p. ej. un nuevo intento en la misma sesión).
- Web Speech API es una feature del navegador: se chequea con `"speechSynthesis" in window` antes de usarla.
- En iOS, SpeechSynthesis a veces exige gesto de usuario; como aquí se dispara desde un click, es suficiente.

Estado interno del componente: `inactivo | cargando | hablando | error`, más la fuente en uso (`elevenlabs` vs `speechSynthesis`) para mostrar labels distintos ("Hablando (ElevenLabs)" vs "Hablando").

---

## 8. Cómo portarlo a otro proyecto (pasos)

### Paso 1 — Variables

Crea `.env.local` (gitignored) y `.env.example` (commiteable) con las keys de la sección 3. Obtén key y Voice IDs en el dashboard de ElevenLabs.

### Paso 2 — Cliente server genérico

Copia el bloque de la sección 9.1 y renombra lo que quieras (`textToSpeech`, el tipo `Voz`, etc.). No toques: lectura de env, resolución de voz, headers, error con status, `arrayBuffer`.

### Paso 3 — API route

Copia el bloque de la sección 9.2. Cambia el nombre del campo de texto si tu contrato usa otro (`body.texto` aquí) y los mensajes de error.

### Paso 4 — Componente de audio

Copia el bloque de la sección 9.3 (o directamente `ReproductorVeredicto.tsx` y cambia `veredicto` por tu prop). Ajústale el `lang` del fallback a tu audiencia.

### Paso 5 — Probarlo sin la UI

```bash
# desde el servidor (o curl a tu route con la key puesta en .env)
curl -sS -X POST "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_ID_MALE" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: audio/mpeg" \
  -d '{"text":"Hola, prueba de voz","model_id":"eleven_multilingual_v2"}' \
  --output prueba.mp3
```

Si `prueba.mp3` pesa > 0 bytes y suena, el contrato está bien. Luego prueba `$ELEVENLABS_API_KEY=` vacío (o quita el Voice ID) y confirma que tu app degrada a SpeechSynthesis en vez de crashear.

---

## 9. Código genérico para copiar

### 9.1 Cliente server (`src/lib/elevenlabs.ts`)

```ts
export type VoiceGender = "male" | "female" | "random";

const ELEVENLABS_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

/** Resuelve el voice_id según la preferencia. "random" elige entre las dos
 *  voces en cada llamada. Lanza si faltan los Voice IDs en el entorno. */
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

/** Llama a ElevenLabs y devuelve el audio como ArrayBuffer (mp3).
 *  Lanza si falla o si no hay API key — el caller decide el fallback. */
export async function textToSpeech(
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
    const error = new Error(
      `ElevenLabs respondió ${response.status}: ${detalle.slice(0, 200)}`
    );
    (error as { status?: number }).status = response.status;
    throw error;
  }

  const audio = await response.arrayBuffer();
  return { audio, voiceGender: resolvedGender };
}
```

### 9.2 API route (`src/app/api/tts/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { textToSpeech, VoiceGender } from "@/lib/elevenlabs";

export const runtime = "nodejs";

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
  // el cliente use su fallback.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const { audio, voiceGender } = await textToSpeech(
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
```

### 9.3 Componente cliente (`AudioTexto.tsx`)

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Estado = "inactivo" | "cargando" | "hablando" | "error";
type Fuente = "elevenlabs" | "speechSynthesis" | null;

interface AudioTextoProps {
  /** Texto a leer en voz alta. */
  texto: string;
  /** Si se reproduce automáticamente al montar. Por defecto no: el usuario elige. */
  autoPlay?: boolean;
  /** Se llama cuando termina de hablar (por cualquier fuente). */
  onFinish?: () => void;
  className?: string;
}

/** Reproduce `texto` por voz.
 *  1. ElevenLabs vía /api/tts (voz elegida al azar).
 *  2. Si falla, tarda o el navegador no reproduce el audio:
 *     SpeechSynthesis nativa — fallback obligatorio, nunca se quita. */
export function AudioTexto({
  texto,
  autoPlay = false,
  onFinish,
  className,
}: AudioTextoProps) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [fuente, setFuente] = useState<Fuente>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const yaIntentadoRef = useRef(false);

  const hablarConSpeechSynthesis = useCallback(
    (texto: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setEstado("error");
        return;
      }
      window.speechSynthesis.cancel(); // por si quedó algo pendiente
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-419"; // ← locale de tu audiencia
      utterance.rate = 1;
      utterance.onstart = () => {
        setFuente("speechSynthesis");
        setEstado("hablando");
      };
      utterance.onend = () => {
        setEstado("inactivo");
        onFinish?.();
      };
      utterance.onerror = () => {
        setEstado("error");
        onFinish?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [onFinish]
  );

  const reproducir = useCallback(
    async (texto: string) => {
      setEstado("cargando");
      setFuente(null);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto, voz: "random" }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`TTS respondió ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          setFuente("elevenlabs");
          setEstado("hablando");
        };
        audio.onended = () => {
          setEstado("inactivo");
          URL.revokeObjectURL(url);
          onFinish?.();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          throw new Error("El navegador no pudo reproducir el audio");
        };

        await audio.play();
      } catch (err) {
        // Cualquier falla en ElevenLabs (red, rate limit, timeout,
        // reproducción) cae aquí — nunca se deja al usuario sin audio.
        console.warn("[AudioTexto] ElevenLabs falló, usando fallback:", err);
        hablarConSpeechSynthesis(texto);
      }
    },
    [hablarConSpeechSynthesis, onFinish]
  );

  useEffect(() => {
    if (!texto || !autoPlay) return;
    // Evita doble disparo en StrictMode / re-renders con el mismo texto.
    if (yaIntentadoRef.current) return;
    yaIntentadoRef.current = true;
    reproducir(texto);

    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [texto, autoPlay, reproducir]);

  // Si cambia el texto (nuevo intento en la misma sesión), permite reintentar.
  useEffect(() => {
    yaIntentadoRef.current = false;
  }, [texto]);

  const etiquetaEstado: Record<Estado, string> = {
    inactivo: "Escuchar",
    cargando: "Conectando…",
    hablando: fuente === "elevenlabs" ? "Hablando (ElevenLabs)" : "Hablando",
    error: "No se pudo reproducir — reintentar",
  };

  return (
    <button
      type="button"
      className={className}
      disabled={estado === "cargando" || estado === "hablando"}
      onClick={() => reproducir(texto)}
      aria-live="polite"
    >
      {etiquetaEstado[estado]}
    </button>
  );
}
```

---

## 10. Flujo en Pitch Coach (para ubicar el código)

```
DashboardResultado.tsx
  <ReproductorVeredicto veredicto={resultado.veredicto_corto} autoPlay={false} />
        │  click / autoPlay
        ▼
ReproductorVeredicto.tsx            ← dominio: "veredicto", patrón genérico
  POST /api/tts { texto, voz: "random" }
        │
        ▼
route.ts (/api/tts)
  valida body (400)
  timeout defensivo 6 s (AbortController)
  textToSpeech(...)                 ← el núcleo reusable
  200 audio/mpeg + X-Voice-Gender  |  502 { error }
        │
        ▼
elevenlabs.ts
  ELEVENLABS_API_KEY  (solo aquí)
  resolveVoiceId("random") → hombre o mujer
  POST text-to-speech/{voiceId} (eleven_multilingual_v2)
  arrayBuffer → mp3
        │
        ▼  (si 502 / timeout / no reproduce)
ReproductorVeredicto → SpeechSynthesis (es-419), mismo texto
```

Lo que **no** pasa por ElevenLabs en este proyecto: la transcripción del pitch (Web Speech API, ver sección 0) y el análisis con IA. Si tu producto también necesita TTS de feedback generado por un LLM, este mismo patrón aplica: llama a tu endpoint de análisis primero y pásale al componente el texto corto que quieras leer (los textos largos se escuchan peor y tardan más en sintetizar).

---

## 11. Checklist al llevarlo a otro repo

- [ ] `.env.local` con `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` (no commiteado).
- [ ] `.env.example` con esas keys vacías y comentario de que son server-side.
- [ ] Cliente de ElevenLabs importado **solo** desde API routes / server actions / server components.
- [ ] Route con `runtime = "nodejs"` y timeout 6 s.
- [ ] Sin key / sin Voice IDs → 502 claro, no 200 vacío.
- [ ] Componente cliente con fallback SpeechSynthesis funcionando (prueba quitando la key).
- [ ] `model_id` verificado contra la doc actual de ElevenLabs para tu idioma.
- [ ] `lang` del fallback SpeechSynthesis alineado con tu audiencia (p. ej. `es-419`).
- [ ] Limpieza en unmount (pause + cancel + revokeObjectURL).
- [ ] Nada con prefijo `NEXT_PUBLIC_` para keys ni Voice IDs.

---

## 12. Referencia rápida

| Concepto | Valor en este repo |
|---|---|
| SDK | Ninguno (`fetch` + REST) |
| Base URL | `https://api.elevenlabs.io/v1` |
| Método | `POST /text-to-speech/{voiceId}` (no-streaming) |
| Auth | Header `xi-api-key` (env server-side) |
| Model | `eleven_multilingual_v2` (verificar vigencia) |
| Voice settings | `stability: 0.5`, `similarity_boost: 0.75` |
| Selección de voz | `"male"` / `"female"` / `"random"` (random = 50/50) |
| Respuesta | `audio/mpeg` (ArrayBuffer) |
| Header útil | `X-Voice-Gender` (qué voz habló) |
| Timeout | 6 s (route y fetch del cliente) |
| Fallback | SpeechSynthesis `es-419`, siempre activo |
| Errores al usuario | `400` body malo · `502` fallo de ElevenLabs |

Fuente de verdad del cliente: [`src/lib/elevenlabs.ts`](../src/lib/elevenlabs.ts), [`src/app/api/tts/route.ts`](../src/app/api/tts/route.ts) y [`src/components/ReproductorVeredicto.tsx`](../src/components/ReproductorVeredicto.tsx).
