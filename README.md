# Pitch Coach

Entrena tu pitch en voz alta y recibe un veredicto hablado con feedback
estructurado según el tipo de pitch (capital, educación, innovación o
tecnología).

Proyecto para el hackathon **The Next Craft** — track **Learning by Shipping**.

## Stack técnico

- **Next.js** (App Router + API routes) — proyecto único frontend + backend.
- **Gemini API** (Flash / Flash-Lite) — análisis del pitch contra la rúbrica
  del tipo elegido.
- **Web Speech API** — transcripción de voz a texto (STT).
- **SpeechSynthesis API** — veredicto hablado (TTS).
- **Tailwind CSS** — estilos.
- **Railway** — deploy.

## Setup local (Linux)

1. Clonar el repositorio.
2. `npm install`
3. Copiar `.env.example` a `.env.local` y completar `GEMINI_API_KEY`.
4. `npm run dev`

> El `Dockerfile` es exclusivo para el build/deploy en Railway y no se usa en
> desarrollo local (se agregará en la etapa de deploy).
