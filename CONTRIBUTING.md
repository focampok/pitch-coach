# Contributing — Pitch Coach

Gracias por contribuir a **Pitch Coach**. Es open source (MIT); toda ayuda suma,
desde reportar un bug hasta agregar un idioma o un tipo de pitch.

## Cómo correr el proyecto en local

La sección **Setup local** del [README](README.md) es la fuente de verdad. Resumen:

1. Clonar el repositorio.
2. `npm install`
3. Copiar `.env.example` a `.env.local`:
   - `NEBIUS_API_KEY` — análisis con el proveedor por defecto (**requerida**).
   - O `MODEL_PROVIDER=gemini` + `GEMINI_API_KEY` como contingencia.
   - `ELEVENLABS_API_KEY` — STT (Scribe) y TTS; sin ella hay texto de respaldo y
     SpeechSynthesis.
   - Voice IDs en español e inglés (ver `.env.example`).
   - `TAVILY_API_KEY` — opcional; sin ella no hay sugerencias.
4. `npm run dev`

Desarrollo nativo, sin Docker. El `Dockerfile` es solo para Railway.

**Navegador:** Chrome, Firefox, Safari, Brave o móvil con micrófono. STT =
MediaRecorder + Scribe en el servidor.

**Tests:** `npm test` antes de abrir un PR.

## Convenciones

- **Producto bilingüe (es / en):** textos de UI, rúbricas visibles, prompts y
  salidas del modelo van en el idioma de sesión (`idioma`). Ver
  [`CLAUDE.md`](CLAUDE.md) y [`docs/alcance.md`](docs/alcance.md) §15.
- **Código:** nombres técnicos en inglés; dominio de negocio puede usar español
  en archivos como `rubricas.ts` o `SelectorTipoPitch.tsx`.

## Puntos de extensión

### Nuevo tipo de pitch

1. Rúbrica en [`src/lib/rubricas.ts`](src/lib/rubricas.ts): 5 puntos con `id`
   estable + nombre y `queBuscar` **por idioma**.
2. Opción en [`src/components/SelectorTipoPitch.tsx`](src/components/SelectorTipoPitch.tsx).
3. Tipo en [`src/types/pitch.ts`](src/types/pitch.ts) (`TipoPitch`).
4. Claves de UI en [`src/lib/diccionario-es.ts`](src/lib/diccionario-es.ts) y
   [`src/lib/diccionario-en.ts`](src/lib/diccionario-en.ts).

### Nueva muletilla

Patrones en [`src/lib/muletillas.ts`](src/lib/muletillas.ts) — fuente única para
conteo y resaltado. En inglés, extender `patronesMuletillas("en")` con las mismas
reglas de contexto que las existentes (`like`, `so`, `right`, etc.).

### Nuevo idioma

Agregar datos, no ramificar componentes:

1. Entrada en [`src/lib/idiomas.ts`](src/lib/idiomas.ts)
2. Diccionario nuevo tipado contra `typeof es`
3. Par de Voice IDs en `.env.example` + lectura en TTS
4. Patrones de muletillas si aplica

### Coach (estado / copy)

Indicador de texto en [`src/lib/mensajes-coach.ts`](src/lib/mensajes-coach.ts)
y diccionarios. El reemplazo visual (animación) lo define la fase de UX/UI — ver
[`docs/alcance.md`](docs/alcance.md) §5.1.

## Qué se espera de un PR

- `npm test` y `npm run lint` en verde.
- Si tocas grabación, dashboard o voz: **prueba manual** en la descripción:
  - Qué probaste (pasos).
  - Qué viste.
  - Navegador y idioma de sesión.

## Cómo reportar bugs

Abre un **Issue** con:

- Navegador y versión.
- Errores de la consola (sin pegar transcripciones largas ni API keys).
- Pasos para reproducir y resultado esperado vs. real.

Más contexto: [`docs/README.md`](docs/README.md).
