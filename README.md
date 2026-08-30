# Pitch Coach

Entrena tu pitch en voz alta y recibe feedback estructurado según el tipo
de pitch (capital, educación, innovación o tecnología): rúbrica, score,
muletillas y un veredicto que puedes escuchar cuando quieras.

Herramienta open source para practicar en español (LATAM). La comunidad
puede usarla, forkarla y madurarla como quiera.

Licencia: [MIT](LICENSE).

## Qué hace

**Loop completo, verificado en Chrome:** eliges tipo y duración → grabas
(con corte automático) → se transcribe (Web Speech API) → se cuentan
muletillas → Gemini evalúa contra la rúbrica → el dashboard muestra
score, puntos cumplidos/faltantes y transcripción resaltada → puedes
escuchar el veredicto (ElevenLabs, o SpeechSynthesis si falta la key) →
si un punto de rúbrica no se cubrió, Tavily puede sugerir un dato real.

Avatar reactivo durante la grabación. Sesión anónima, sin login.

Demo en línea:
[https://pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/).

Más detalle del producto: `docs/alcance.md`. Estado de implementación:
`docs/status.md`.

## Limitaciones conocidas

Directo al grano, sin rodeos:

- **Sin tests automatizados** — la verificación es manual en Chrome.
- **Sesión anónima, sin persistencia** — un intento no se guarda en ningún
  lado.
- **El STT depende de la Web Speech API**: solo es confiable en
  Chrome/Chromium y requiere internet (procesa el audio en servidores de
  Google).
- **Tier gratuito de Gemini/Tavily**: sujeto a rate limits, sin garantía de
  uptime para uso pesado.
- **"eeee" y rellenos vocálicos casi nunca se transcriben** — es una
  limitación del STT de Chrome, no de la detección de muletillas.

## Stack

- **Next.js** (App Router + API routes) — frontend y backend en un solo repo.
- **Gemini API** — analiza el pitch. Escribe score, comentarios y
  `veredicto_corto`. No interviene en el TTS.
- **Web Speech API** — transcripción en tiempo real (mejor en Chrome).
- **ElevenLabs** — TTS del veredicto. Fallback: SpeechSynthesis del
  navegador.
- **Tavily** — estadísticas sugeridas cuando falta un dato. Opcional.
- **Tailwind CSS** — estilos.
- **Railway** — deploy (el `Dockerfile` de la raíz es solo para eso).

## Setup local

Desarrollo nativo, sin Docker.

1. Clonar el repositorio.
2. `npm install`
3. Copiar `.env.example` a `.env.local` y completar:
   - `GEMINI_API_KEY` — análisis del pitch (**requerida**).
   - `ELEVENLABS_API_KEY` — TTS del veredicto.
   - `ELEVENLABS_VOICE_ID_MALE` / `ELEVENLABS_VOICE_ID_FEMALE` — Voice ID
     de VoiceLab. Si faltan, el botón de escuchar usa SpeechSynthesis.
   - `TAVILY_API_KEY` — sugerencias. Si falta, esa sección no aparece.
4. `npm run dev`

Usa **Chrome** (o Chromium/Edge). Brave no expone la Web Speech API;
Firefox la trae deshabilitada.

## Deploy (Railway)

El build usa el `Dockerfile` (Next.js standalone) y `railway.toml`.
HTTPS es necesario para el micrófono fuera de localhost.

Variables en Settings → Variables (las mismas que `.env.local`):

- `GEMINI_API_KEY` (requerida)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID_MALE`
- `ELEVENLABS_VOICE_ID_FEMALE`
- `TAVILY_API_KEY`

## Contribuir

Issues y pull requests son bienvenidos. El código de UI y de negocio
está en español de producto (textos, rúbricas, prompts) e inglés de
implementación (nombres de funciones y archivos técnicos). Ver
[`CONTRIBUTING.md`](CONTRIBUTING.md) y `CLAUDE.md` si trabajas con
agentes dentro del repo.

## Origen y créditos

Pitch Coach nació en el hackathon **The Next Craft**, en el track
**Learning by Shipping**. Usa [ElevenLabs](https://elevenlabs.io) (TTS del
veredicto) y [Tavily](https://tavily.com) (sugerencias de estadísticas)
como patrocinadores del evento. Ambos tienen tier gratuito, así que el
proyecto no depende de créditos del evento: quien lo clone puede usar sus
propias claves gratuitas (ver [Setup local](#setup-local)).

## Licencia

MIT — ver [LICENSE](LICENSE).
