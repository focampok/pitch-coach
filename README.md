# Pitch Coach

Entrena tu pitch en voz alta y recibe un veredicto hablado con feedback
estructurado según el tipo de pitch (capital, educación, innovación o
tecnología).

Proyecto para el hackathon **The Next Craft** — track **Learning by Shipping**.

## Estado (punto de partida del evento — 25 ago 2026)

**Listo y verificado en Chrome / Railway:** selectores (tipo de pitch + duración), grabación con corte automático, transcripción en vivo (Web Speech API), detección de muletillas, avatar reactivo, sesión anónima. URL: [https://pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/).

**Pendiente el día del evento (en este orden):** Gemini + dashboard de rúbrica/score → ElevenLabs TTS → Tavily. Detalle en `docs/alcance.md` §9 y §14.

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
4. `npm run dev`

## Deploy (Railway)

El proyecto **pitch-coach** ya está creado en Railway. El servicio está
en línea en
[https://pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/)
(HTTPS automático, necesario para el micrófono fuera de localhost).

El build usa el `Dockerfile` de la raíz (Next.js standalone) y
`railway.toml`. El servicio está conectado al repo `focampok/pitch-coach`
(rama `main`): **cada push a `main` dispara un deploy automático**.

Las variables de entorno se configuran en el panel del proyecto
(Settings → Variables) o con `railway variable set`, replicando las de
`.env.local`:

- `GEMINI_API_KEY` (requerida para el loop crítico)
- `ELEVENLABS_API_KEY`
- `TAVILY_API_KEY`

> El `Dockerfile` es exclusivo para el build/deploy en Railway y no se usa
> en desarrollo local.
