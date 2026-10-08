# ElevenLabs integration guide (extracted from Pitch Coach)

How to reuse this repo's voice (TTS) logic in another project: API key, REST call to `text-to-speech`, voice selection (male/female/random), the API route that hides the key, and the **mandatory SpeechSynthesis fallback** so the user is never left without audio.

The official ElevenLabs SDK is not required. Pitch Coach talks to the REST API at `api.elevenlabs.io` with native `fetch`, both on the server and in the browser.

---

## 0. Scope: what "voice logic" means here (and what it does not)

| Voice type | In this repo | Engine | Extract it? |
|---|---|---|---|
| TTS — read the verdict aloud | Yes | ElevenLabs + SpeechSynthesis fallback | **Yes, this guide** |
| STT — transcribe the user's speech | Yes | MediaRecorder + ElevenLabs Scribe (`/api/transcribir`) | **Yes** (`transcribirAudio` in `elevenlabs.ts`) |

---

## 1. What is reusable and what is not

| Piece | File in this repo | Copy as-is? |
|---|---|---|
| Server-side ElevenLabs client (fetch + voice selection) | `src/lib/elevenlabs.ts` | Yes, it is the core. Rename it if you want. |
| API route that hides the key | `src/app/api/tts/route.ts` | The pattern yes; validate `texto` against your contract. |
| Client component that plays and degrades | `src/components/ReproductorVeredicto.tsx` | The pattern yes; swap the text prop for yours. |
| Environment variables | `.env.example` | Yes (the `ELEVENLABS_*` keys). |
| Spoken voice / which text is read | `src/lib/prompts.ts` (`veredicto_corto`), `src/types/pitch.ts` | No. That is Pitch Coach domain. |

**Dependencies:** none extra. `package.json` does not include an ElevenLabs SDK. `fetch`, TypeScript, and environment variables are enough. SpeechSynthesis (TTS fallback) and MediaRecorder (capture) belong to the browser.

---

## 2. Principles you should not break

1. **The API key lives only on the server.** It is read from `process.env.ELEVENLABS_API_KEY`. Never `NEXT_PUBLIC_ELEVENLABS_API_KEY`, and never a hardcode in the client.
2. **The browser never calls ElevenLabs.** The frontend posts to your API route; the route calls ElevenLabs with the key.
3. **SpeechSynthesis is a mandatory fallback; it is never removed.** The product premise is: the user always hears the text, whether ElevenLabs is down, slow, or the browser will not play the mp3. If your case does not require "it always plays", at least decide explicitly what happens without a key.
4. **Fail fast, not slow.** There is a 6 s timeout both in the route and in the client's fetch. A TTS call that takes longer than that is abandoned and the client degrades, instead of leaving the user on a spinner.
5. **Voice IDs come from the environment, not from hardcode.** `ELEVENLABS_VOICE_ID_MALE` / `ELEVENLABS_VOICE_ID_FEMALE`. The voice is deploy configuration, not code.

In the Next.js App Router, `.env.local` feeds the server. On Railway (or another host), copy the same keys into the variables panel.

---

## 3. Environment variables

Copy this into the other project's `.env.example` (no real values) and into `.env.local` / the deploy host (with values):

```bash
# ElevenLabs key (TTS). Server-side only. Never a NEXT_PUBLIC_ prefix.
ELEVENLABS_API_KEY=

# Voice IDs (ElevenLabs → VoiceLab → your voice → Voice ID, 32 hex chars).
# Server-side only. If they are missing, the route fails and the client degrades to SpeechSynthesis.
ELEVENLABS_VOICE_ID_MALE=
ELEVENLABS_VOICE_ID_FEMALE=
```

How to get the Voice IDs: in the [ElevenLabs dashboard](https://elevenlabs.io/voice-lab) each voice in your library shows its Voice ID. You can also list them through the API (`GET /v1/voices`) with your key. They are stable strings of about 32 hex characters.

The API key is created at [elevenlabs.io → Settings → API Keys](https://elevenlabs.io/app/settings/api-keys).

---

## 4. HTTP contract with ElevenLabs

Non-streaming endpoint (returns the full audio as mp3):

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
Content-Type: application/json
xi-api-key: {ELEVENLABS_API_KEY}
Accept: audio/mpeg
```

Body (the one in this project):

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

The `text` value in that body is an unchanged placeholder for the text to read. The rest of the body is the request this project sends.

- `xi-api-key` is the auth header (not `Authorization: Bearer`).
- `model_id`: this repo pins `eleven_multilingual_v2` (it supports Spanish). ElevenLabs keeps moving which multilingual model it recommends; it is **a single string in the body**, so check the current docs for which one fits before you pin it in the other project.
- `voice_settings`:
  - `stability` (0–1): 0.5 balances consistency against variation. Raise it toward 1 if the voice "breathes" too much or loses its tone.
  - `similarity_boost` (0–1): 0.75 is fidelity to the original voice. If it sounds robotic, lower it.
- A 200 response is **binary `audio/mpeg`** (the whole file). For streaming (a fast first byte) there is `ws://` / `POST .../text-to-speech/{voiceId}/stream`, but this guide uses the non-streaming endpoint and that is enough.

### How the server reads the audio

```ts
const audio = await response.arrayBuffer(); // mp3 ArrayBuffer, ready to return
```

### Typical ElevenLabs error codes

| HTTP | Meaning |
|---|---|
| 401 | Invalid key or no credit |
| 422 | `voice_id` missing or not valid for your account |
| 429 | Rate limit / quota |
| 5xx | Service outage |

**This matters:** in this repo **every** non-2xx status is thrown as an `Error` and the route responds **502**. A 401/422 from a bad config does not hang: it fails fast and the client degrades to SpeechSynthesis. The symptom of a broken config is silent for the user (they hear the native voice) and visible only in the route's `console.error`. If in your project you want to tell "bad config" from "service down", check `err.status` before you map it.

---

## 5. Voice selection: male / female / random

The client exposes a voice type and resolves it **on the server**:

```ts
type VoiceGender = "male" | "female" | "random";
```

- `"male"` / `"female"` → uses the matching Voice ID.
- `"random"` → `Math.random() < 0.5` picks male or female **on each call**. In Pitch Coach the idea is to vary the coach's voice across sessions/attempts without the user configuring it.

The resolved voice is returned to the server (for the response header) and to the UI (so you can show who is speaking, if you want):

```ts
resolveVoiceId(gender) // → { voiceId: string, gender: "male" | "female" }
```

---

## 6. The API route (Next.js App Router)

The frontend **never imports** the ElevenLabs client. It `POST`s to the route; the route reads the key and calls ElevenLabs. `runtime = "nodejs"` (needed for `process.env` and server-side fetch).

Route contract (the one in this repo):

```
POST /api/tts
body: { texto: string, voz?: "male" | "female" | "random" }
→ 200 audio/mpeg  + header X-Voice-Gender
→ 400 { error }   invalid body or missing "texto"
→ 413 { error }   text over the limit (8000 characters)
→ 429 { error }   per-IP rate limit (10 req / 10 min, in memory) + Retry-After
→ 502 { error }   ElevenLabs failed / no key / timeout
```

Details worth copying:

- **A defensive 6 s timeout with `AbortController`** in the route, so a request is not left hanging if ElevenLabs is slow. The signal is passed to the inner `fetch`.
- **Input limits before calling the provider**: reject bodies over the cap (413) and apply an in-memory per-IP rate limit (429 + `Retry-After`). Because it is in memory, the effective limit multiplies by the number of instances.
- The 200 response headers: `Content-Type: audio/mpeg`, `X-Voice-Gender` (which voice spoke, useful if the UI wants to show it), and `Cache-Control: no-store` (audio generated per request).
- Any internal failure → **502 JSON**, never an empty 200. `console.error` records the reason.
- If the key or the Voice IDs are missing, the client throws an `Error` with a clear message in Spanish → the route turns it into a 502 → the client degrades.

---

## 7. The client component and the mandatory fallback

This is the most delicate piece. Attempt order:

1. **ElevenLabs**: `POST /api/tts` → if it is 200, `res.blob()` → `URL.createObjectURL` → `<audio>` → `play()`.
2. **If anything fails** (network, timeout, rate limit, the browser cannot play the mp3) → **SpeechSynthesis** with the same text. The user never notices a break in the loop.

Native-fallback details worth keeping:

- `window.speechSynthesis.cancel()` before speaking (in case something was still pending).
- `utterance.lang = "es-419"` — LATAM Spanish. Change it to your audience's locale.
- `utterance.rate = 1`.
- Cleanup on unmount: `audio.pause()` + `speechSynthesis.cancel()` (otherwise the browser keeps speaking after the component unmounts).
- `URL.revokeObjectURL(url)` when playback ends or fails (avoids memory leaks in long sessions).
- **Guard against a double fire** (`yaIntentadoRef`): avoids playing twice because of StrictMode/re-renders with the same text, and resets if the text changes (for example a new attempt in the same session).
- The Web Speech API is a browser feature: check `"speechSynthesis" in window` before using it.
- On iOS, SpeechSynthesis sometimes requires a user gesture; because it is fired from a click here, that is enough.

Internal component state: `inactivo | cargando | hablando | error`, plus the source in use (`elevenlabs` vs `speechSynthesis`) so the labels can differ ("Speaking (ElevenLabs)" vs "Speaking").

---

## 8. How to port it to another project (steps)

### Step 1 — Variables

Create `.env.local` (gitignored) and `.env.example` (committable) with the keys from section 3. Get the key and the Voice IDs in the ElevenLabs dashboard.

### Step 2 — Generic server client

Copy the block from section 9.1 and rename what you want (`textToSpeech`, the `Voz` type, and so on). Leave these alone: env reading, voice resolution, headers, the error with status, `arrayBuffer`.

### Step 3 — API route

Copy the block from section 9.2. Change the text field name if your contract uses another (`body.texto` here) and the error messages.

### Step 4 — Audio component

Copy the block from section 9.3 (or `ReproductorVeredicto.tsx` directly and change `veredicto` to your prop). Adjust the fallback `lang` to your audience.

### Step 5 — Test it without the UI

The request body below is unchanged. `"Hola, prueba de voz"` is sample speech in Spanish, not a pitch transcript.

```bash
# from the server (or curl your route with the key set in .env)
curl -sS -X POST "https://api.elevenlabs.io/v1/text-to-speech/$ELEVENLABS_VOICE_ID_MALE" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: audio/mpeg" \
  -d '{"text":"Hola, prueba de voz","model_id":"eleven_multilingual_v2"}' \
  --output prueba.mp3
```

If `prueba.mp3` is larger than 0 bytes and it plays, the contract is right. Then try with `$ELEVENLABS_API_KEY=` empty (or remove the Voice ID) and confirm that your app degrades to SpeechSynthesis instead of crashing.

---

## 9. Generic code to copy

### 9.1 Server client (`src/lib/elevenlabs.ts`)

```ts
export type VoiceGender = "male" | "female" | "random";

const ELEVENLABS_TTS_URL = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

/** Resolves the voice_id from the preference. "random" picks between the two
 *  voices on each call. Throws if the Voice IDs are missing from the environment. */
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

/** Calls ElevenLabs and returns the audio as an ArrayBuffer (mp3).
 *  Throws on failure or if there is no API key — the caller decides the fallback. */
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

  // Defensive timeout: if ElevenLabs is slow, fail fast and let
  // the client use its fallback.
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

### 9.3 Client component (`AudioTexto.tsx`)

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Estado = "inactivo" | "cargando" | "hablando" | "error";
type Fuente = "elevenlabs" | "speechSynthesis" | null;

interface AudioTextoProps {
  /** Text to read aloud. */
  texto: string;
  /** Whether it plays automatically on mount. Default is no: the user chooses. */
  autoPlay?: boolean;
  /** Called when speaking ends (from either source). */
  onFinish?: () => void;
  className?: string;
}

/** Plays `texto` by voice.
 *  1. ElevenLabs via /api/tts (voice chosen at random).
 *  2. If it fails, is slow, or the browser will not play the audio:
 *     native SpeechSynthesis — mandatory fallback, never removed. */
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
      window.speechSynthesis.cancel(); // in case something was still pending
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-419"; // ← your audience's locale
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
        // Any ElevenLabs failure (network, rate limit, timeout,
        // playback) lands here — the user is never left without audio.
        console.warn("[AudioTexto] ElevenLabs falló, usando fallback:", err);
        hablarConSpeechSynthesis(texto);
      }
    },
    [hablarConSpeechSynthesis, onFinish]
  );

  useEffect(() => {
    if (!texto || !autoPlay) return;
    // Avoids a double fire in StrictMode / re-renders with the same text.
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

  // If the text changes (a new attempt in the same session), allow another try.
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

## 10. Flow in Pitch Coach (where to find the code)

```
DashboardResultado.tsx
  <ReproductorVeredicto veredicto={resultado.veredicto_corto} autoPlay={false} />
        │  click / autoPlay
        ▼
ReproductorVeredicto.tsx            ← domain: "veredicto", generic pattern
  POST /api/tts { texto, voz: "random" }
        │
        ▼
route.ts (/api/tts)
  validate body (400)
  defensive timeout 6 s (AbortController)
  textToSpeech(...)                 ← the reusable core
  200 audio/mpeg + X-Voice-Gender  |  502 { error }
        │
        ▼
elevenlabs.ts
  ELEVENLABS_API_KEY  (only here)
  resolveVoiceId("random") → male or female
  POST text-to-speech/{voiceId} (eleven_multilingual_v2)
  arrayBuffer → mp3
        │
        ▼  (on 502 / timeout / will not play)
ReproductorVeredicto → SpeechSynthesis (es-419), same text
```

AI analysis does not go through ElevenLabs. STT does: `POST /api/transcribir` forwards the Blob to `POST https://api.elevenlabs.io/v1/speech-to-text` (`scribe_v2`, hint `es`). The audio is not written to disk and is not attached to logs or to Sentry. If your product also needs TTS for feedback generated by an LLM, the pattern in this guide applies: call your analysis endpoint first and pass the component the short text you want read aloud.

---

## 11. Checklist for taking it to another repo

- [ ] `.env.local` with `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` (not committed).
- [ ] `.env.example` with those keys empty and a comment that they are server-side.
- [ ] ElevenLabs client imported **only** from API routes / server actions / server components.
- [ ] Route with `runtime = "nodejs"` and a 6 s timeout.
- [ ] No key / no Voice IDs → a clear 502, not an empty 200.
- [ ] Client component with a working SpeechSynthesis fallback (test by removing the key).
- [ ] `model_id` checked against the current ElevenLabs docs for your language.
- [ ] SpeechSynthesis fallback `lang` aligned with your audience (for example `es-419`).
- [ ] Cleanup on unmount (pause + cancel + revokeObjectURL).
- [ ] Nothing with a `NEXT_PUBLIC_` prefix for keys or Voice IDs.

---

## 12. Quick reference

| Concept | Value in this repo |
|---|---|
| SDK | None (`fetch` + REST) |
| Base URL | `https://api.elevenlabs.io/v1` |
| Method | `POST /text-to-speech/{voiceId}` (non-streaming) |
| Auth | Header `xi-api-key` (server-side env) |
| Model | `eleven_multilingual_v2` (check that it is still current) |
| Voice settings | `stability: 0.5`, `similarity_boost: 0.75` |
| Voice selection | `"male"` / `"female"` / `"random"` (random = 50/50) |
| Response | `audio/mpeg` (ArrayBuffer) |
| Useful header | `X-Voice-Gender` (which voice spoke) |
| Timeout | 6 s (route and client fetch) |
| Fallback | SpeechSynthesis `es-419`, always on |
| Errors to the user | `400` bad body · `502` ElevenLabs failure |

Source of truth for the client: [`src/lib/elevenlabs.ts`](../src/lib/elevenlabs.ts), [`src/app/api/tts/route.ts`](../src/app/api/tts/route.ts), and [`src/components/ReproductorVeredicto.tsx`](../src/components/ReproductorVeredicto.tsx).
