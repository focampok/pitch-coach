# Pitch Coach

Entrena tu pitch en voz alta y recibe un veredicto hablado con feedback
estructurado según el tipo de pitch (capital, educación, innovación o
tecnología).

Proyecto para el hackathon **The Next Craft** — track **Learning by Shipping**.

## Stack técnico

- **Next.js** (App Router + API routes) — proyecto único frontend + backend.
- **Gemini API** (Flash / Flash-Lite) — análisis del pitch contra la rúbrica
  del tipo elegido.
- **Web Speech API** — transcripción de voz a texto (STT) en tiempo real.
- **ElevenLabs** — veredicto hablado (TTS) con voz natural en español;
  SpeechSynthesis nativa como fallback. Opcional: Scribe (STT) para la
  transcripción final de precisión.
- **Tavily** — búsqueda de estadísticas reales para sugerir mejoras cuando
  falta un dato concreto en el pitch.
- **Vapi** (Web SDK) — ronda de preguntas del jurado: agente de voz que
  interroga al usuario según los puntos de rúbrica incumplidos, con un
  persona adaptado al tipo de pitch (inversionista, comité académico,
  jurado de innovación o revisor técnico).
- **Tailwind CSS** — estilos.
- **Railway** — deploy (temprano y continuo: se deploya al completar cada
  hito, no una sola vez al final).

## Setup local (Linux)

1. Clonar el repositorio.
2. `npm install`
3. Copiar `.env.example` a `.env.local` y completar las variables:
   - `GEMINI_API_KEY` — análisis del pitch (requerida).
   - `ELEVENLABS_API_KEY` — TTS del veredicto (sin ella, se usa el fallback
     nativo SpeechSynthesis).
   - `TAVILY_API_KEY` — sugerencias con datos reales (sin ella, el dashboard
     se muestra sin sugerencias).
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY` — ronda del jurado (clave pública por
     diseño del Web SDK de Vapi).
4. `npm run dev`

## Deploy (Railway)

El proyecto se construye en Railway con el `Dockerfile` de la raíz (build
standalone de Next.js). Las variables de entorno se configuran en el panel
del proyecto (Settings → Variables), replicando las de `.env.local`.

> El `Dockerfile` es exclusivo para el build/deploy en Railway y no se usa
> en desarrollo local. Nota: `NEXT_PUBLIC_VAPI_PUBLIC_KEY` se incrusta en
> build time — si cambia, hace falta un redeploy.
