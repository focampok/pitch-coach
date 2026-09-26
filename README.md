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
muletillas → el modelo (Nebius por defecto) evalúa contra la rúbrica → el dashboard muestra
score, puntos cumplidos/faltantes y transcripción resaltada → puedes
escuchar el veredicto (ElevenLabs, o SpeechSynthesis si falta la key) →
si un punto de rúbrica no se cubrió, Tavily puede sugerir un dato real.

Avatar reactivo durante la grabación. Sesión anónima, sin login.

Demo en línea:
[https://pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/).

Más detalle del producto: `docs/alcance.md`. Estado de implementación:
`docs/status.md`.

## Capturas

| Selección del pitch | Coach reactivo | Dashboard de resultados |
| :---: | :---: | :---: |
| <img src="public/screenshots/selector.png" alt="Pantalla de selección de tipo de pitch y duración máxima" width="400"> | <img src="public/screenshots/avatar.png" alt="Coach reaccionando a una muletilla durante la grabación" width="400"> | <img src="public/screenshots/dashboard.png" alt="Dashboard con score, rúbrica, muletillas y veredicto" width="400"> |

## Limitaciones conocidas

Directo al grano, sin rodeos:

- **Tests unitarios, no de UI** — `npm test` (vitest) cubre la lógica de
  `src/lib/`; el loop completo se verifica a mano en Chrome.
- **Sesión anónima, sin persistencia** — un intento no se guarda en ningún
  lado.
- **El STT depende de la Web Speech API**: solo es confiable en
  Chrome/Chromium y requiere internet (procesa el audio en servidores de
  Google).
- **Proveedor del modelo y Tavily con tier gratuito**: sujetos a rate limits,
  sin garantía de uptime para uso pesado.
- **"eeee" y rellenos vocálicos casi nunca se transcriben** — es una
  limitación del STT de Chrome, no de la detección de muletillas.

## Stack

- **Next.js** (App Router + API routes) — frontend y backend en un solo repo.
- **Nebius Token Factory** — analiza el pitch (por defecto). Devuelve
  `cumplido`/`comentario` por punto, `claridad` y `veredicto_corto`; el
  **score lo calcula el servidor**. No interviene en el TTS.
- **Gemini API** — proveedor alternativo, activable con
  `MODEL_PROVIDER=gemini` como contingencia manual.
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
   - `MODEL_PROVIDER` — `nebius` (por defecto) o `gemini`.
   - `NEBIUS_API_KEY` — análisis del pitch (**requerida** con el proveedor por
     defecto). Con `MODEL_PROVIDER=gemini`, en su lugar se requiere
     `GEMINI_API_KEY`.
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

- `MODEL_PROVIDER` (`nebius` por defecto)
- `NEBIUS_API_KEY` (requerida con el proveedor por defecto)
- `NEBIUS_BASE_URL`, `NEBIUS_MODEL_ULTRA` (opcionales)
- `GEMINI_API_KEY` (solo si `MODEL_PROVIDER=gemini`)
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
