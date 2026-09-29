# Contributing — Pitch Coach

Gracias por querer contribuir a **Pitch Coach**. Es un proyecto open
source nacido en un hackathon; toda ayuda suma, desde reportar un bug
hasta agregar un tipo de pitch nuevo.

## Cómo correr el proyecto en local

La sección **Setup local** del [README](README.md) es la fuente de verdad;
esta es la misma receta:

1. Clonar el repositorio.
2. `npm install`
3. Copiar `.env.example` a `.env.local` y completar:
   - `GEMINI_API_KEY` — análisis del pitch (**requerida**).
   - `ELEVENLABS_API_KEY` — TTS del veredicto.
   - `ELEVENLABS_VOICE_ID_MALE` / `ELEVENLABS_VOICE_ID_FEMALE` — Voice ID
     de VoiceLab. Si faltan, el botón de escuchar usa SpeechSynthesis.
   - `TAVILY_API_KEY` — sugerencias. Si falta, esa sección no aparece.
4. `npm run dev`

Desarrollo nativo, sin Docker. El `Dockerfile` de la raíz es solo para el
deploy en Railway.

> **Navegador:** cualquier navegador moderno con micrófono. El STT es
> MediaRecorder + ElevenLabs Scribe (server-side), no depende de Chrome.

## Puntos de extensión

### Nuevo tipo de pitch

1. Agregar la rúbrica en [`src/lib/rubricas.ts`](src/lib/rubricas.ts),
   mismo formato que las existentes: 4-5 puntos con `punto` +
   `queBuscar`.
2. Agregar la opción en
   [`src/components/SelectorTipoPitch.tsx`](src/components/SelectorTipoPitch.tsx)
   (entrada en `OPCIONES` con `value`, `label` y `description`).
3. Verificar el tipo en [`src/types/pitch.ts`](src/types/pitch.ts)
   (`TipoPitch`).

### Nueva muletilla

Agregar el patrón en [`src/lib/muletillas.ts`](src/lib/muletillas.ts)
dentro de `PATRONES_MULETILLAS` — es la **única fuente de verdad**, usada
tanto para el conteo (`detectarMuletillas`) como para el resaltado en el
dashboard (`resaltarMuletillas`). Cada entrada es un objeto
`PatronMuletilla`:

- `etiqueta` — nombre visible en el dashboard.
- `patron` — `RegExp` global y case-insensitive (flags `gi`).
- `umbralMin` (opcional) — ocurrencias mínimas para reportar (útil para
  palabras que también son conectores legítimos, como "pues" o "bueno").

### Nuevos mensajes o estados del coach

El avatar reactivo y su motor de reacciones se eliminaron ([`docs/alcance.md`](docs/alcance.md)
§5.1): el flujo grabar → transcribir → analizar no produce resultados
intermedios sobre los que reaccionar. Hoy el coach es un **indicador de texto**
temporal en [`src/lib/mensajes-coach.ts`](src/lib/mensajes-coach.ts):
`MENSAJES_ASINTIENDO` (3 frases por idioma) y `textoIndicadorCoach`.

Para agregar un idioma, va en los diccionarios como cualquier otro texto. Para
un **estado nuevo** (o el reemplazo visual tipo esfera), la fase de UX/UI define
el lenguaje visual primero — no agregar gestos sueltos mientras el coach sea
solo texto.

## Qué se espera de un PR

`npm test` cubre la lógica de `src/lib/` y las rutas de API (fetch
mockeado). El loop con micrófono se verifica a mano; cada PR que lo toque
debe incluir una **prueba manual** en la descripción:

- **Qué se probó** (paso a paso).
- **Qué se vio** (resultado / comportamiento observado).
- **En qué navegador** (Chrome, Firefox, Safari, Brave, o móvil).

## Cómo reportar bugs

Abre un **Issue** en GitHub e incluye:

- Navegador y versión (Chrome/Firefox/etc.).
- Consola del navegador (errores de la pestaña Console).
- Pasos para reproducir y qué esperabas vs. qué pasó.
- Si el bug toca el análisis o las claves: **no pegues API keys** en el
  Issue.

Convención del repo: los textos de UI, rúbricas y prompts van en español
(LATAM); el código (nombres, funciones, archivos técnicos) en inglés. Ver
[`CLAUDE.md`](CLAUDE.md).
