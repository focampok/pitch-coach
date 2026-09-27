# Pitch Coach — Status del proyecto

> **2026-09-27.** Qué está implementado, mapeado a `docs/alcance.md`.
> El loop (voz → análisis → dashboard + veredicto a pedido) está cerrado
> y verificado en Chrome. Resolver hallazgos, Análisis Ultra y el panel
> "Tu progreso" están implementados; la verificación de esos flujos en
> navegador queda para el mantenedor.

## Resumen rápido

- ✅ Loop voz → transcripción → muletillas (Chrome).
- ✅ Avatar reactivo (§5.1): 5 estados sobre interim results.
- ✅ Deploy: `Dockerfile` + `railway.toml`.
- ✅ Análisis con dos proveedores: **Nebius** (por defecto) y **Gemini**
  (contingencia manual). Rúbricas, prompt en español, tiempo como contexto,
  JSON estructurado, fallbacks y reintentos.
- ✅ Dashboard: score, rúbrica, muletillas, transcripción resaltada, tiempo.
- ✅ TTS: ElevenLabs vía `/api/tts`, fallback a SpeechSynthesis.
  **Sin autoplay** — el usuario pulsa "Escuchar veredicto".
- ✅ Tavily (§12): `/api/enriquecer` si hay puntos sin cumplir. Sin key,
  el dashboard no se rompe.
- ✅ Tests unitarios (`npm test`, vitest) sobre la lógica de `src/lib/`
  (incluido el historial local) y las rutas de análisis/sparring (fetch
  mockeado; sin llamadas reales a proveedores).
- ✅ Límites: transcripción máx. 8000 caracteres; respuesta de sparring máx.
  2000; rate limit por IP en memoria.
- ✅ Análisis Ultra: botón en el dashboard que reanaliza la misma transcripción
  con nivel `ultra` (Nemotron Ultra, razonamiento activo). Se muestra además
  del análisis estándar, con una traza de razonamiento (4–8 pasos).
- ✅ Resolver hallazgos: hasta 3 preguntas de seguimiento sobre los primeros
  puntos de rúbrica no cumplidos. Texto + "Escuchar pregunta" (misma voz de
  sesión); no hay autoplay.
- ✅ Historial local: las últimas 20 prácticas se guardan en `localStorage`
  de este navegador (sin cuenta y sin servidor). El panel "Tu progreso"
  las lista. No se guardan transcripción, comentarios, traza, preguntas,
  respuestas ni audio.
- 🟡 El STT de Chrome casi nunca transcribe "eeee". Las muletillas léxicas sí.

## Leyenda

- ✅ Implementado y probado en navegador
- 🟡 Implementado con limitación conocida
- ⬜ No implementado (idea abierta para la comunidad)

## 1. Implementado

| Estado | Ítem | Archivos | Notas |
|---|---|---|---|
| ✅ | Selector de tipo (§9) | `SelectorTipoPitch.tsx` | capital, educación, innovación, tecnología |
| ✅ | Selector de duración (§9) | `SelectorDuracion.tsx` | 1 a 7 minutos |
| ✅ | Grabación con corte (§9) | `GrabadorVoz.tsx` | Web Speech API; auto-stop; error si no hay STT |
| ✅ | Transcripción (§9) | `GrabadorVoz.tsx` | `es-419`; interim para el avatar, finales para el análisis |
| ✅ | Muletillas (§8) | `src/lib/muletillas.ts` | 21 patrones; `PATRONES_MULETILLAS` es la fuente de verdad |
| ✅ | UI | `src/app/page.tsx` | selectores + grabador + `DashboardResultado` |
| ✅ | Avatar (§5.1) | `CoachAvatar.tsx` + `reacciones.ts` + `types/coach.ts` | 5 estados |
| ✅ | Sesión anónima | `src/app/page.tsx` | sin login. El historial vive en `localStorage` de este navegador, no en el servidor |
| ✅ | Deploy | `Dockerfile` + `railway.toml` | standalone; healthcheck `/` |
| ✅ | Rúbricas (§6) | `src/lib/rubricas.ts` | 4 tipos × 5 puntos |
| ✅ | Tipos (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` y relacionados |
| ✅ | Tiempo real (§7) | `GrabadorVoz.tsx` + `page.tsx` | contexto de Gemini + dashboard |
| ✅ | Cliente del modelo (§13) | `src/lib/modelo.ts` + adaptadores | capa neutra + fábrica por `MODEL_PROVIDER`; backoff; timeout 20 s |
| ✅ | Proveedor Nebius (por defecto) | `src/lib/proveedor-nebius.ts` | `/chat/completions` OpenAI-compatible; `json_schema` estricto (`{name, strict, schema}`); niveles `estandar` / `ultra` / `rapido`; `enable_thinking: false` en estándar y rápido; ultra omite el campo (razonamiento activo) |
| ✅ | Proveedor Gemini (contingencia) | `src/lib/proveedor-gemini.ts` | `generateContent`; se activa con `MODEL_PROVIDER=gemini` |
| ✅ | Esquema restringido | `src/lib/validar-analisis.ts` | `construirEsquemaAnalisisRestringido`: `rubrica` con `minItems === maxItems === puntos.length`; cada ítem con `additionalProperties: false` y `required: ["cumplido", "comentario"]`; Ultra añade `traza` (4–8 pasos) al esquema y la exige en validación |
| ✅ | Prompt (§7/§13) | `src/lib/prompts.ts` | español; transcripción como dato no confiable; pide rúbrica sin nombres + `claridad` + `veredicto_corto`. Si hay un intento previo del mismo tipo, el análisis principal puede mencionar solo los nombres de puntos no cubiertos |
| ✅ | API `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` | acepta `nivel` opcional (`estandar` \| `ultra` \| `rapido`); 400 / 413 / 429 / 502 (errores genéricos al cliente); Ultra comparte el mismo rate limit |
| ✅ | Dashboard | `DashboardResultado.tsx` + `dashboard-resultado.css` | incluye Tavily y botón **Análisis Ultra** |
| ✅ | Resolver hallazgos (§9) | `SparringCoach.tsx` + `/api/sparring/pregunta` + `/api/sparring/evaluar` | copy visible "Resolver hallazgos"; APIs internas siguen en `/api/sparring/*`; hasta 3 puntos no cumplidos; nivel `rapido`; escuchar a pedido; grabador o texto de respaldo |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | timeout 6 s; 413/429; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `/api/enriquecer` | best-effort; timeout 8 s |
| ✅ | Límites | `src/lib/limites.ts` + `src/lib/rate-limit.ts` | transcripción máx. 8000; respuesta sparring máx. 2000; rate limit por IP en memoria (por instancia) |
| ✅ | Historial local | `src/lib/historial-sesiones.ts` + `src/types/historial.ts` | clave `pitch-coach:historial-sesiones`; últimas 20; FIFO. Campos: fecha, tipo, duración, score, claridad (reconstruida del score), rúbrica `{punto, cumplido}`, conteo de muletillas, `ultraUsado`, y —si se completó— hallazgos `{preguntasHechas, puntosReforzados, puntos: [{punto, cumplido}]}`. Ultra no guarda score ni rúbrica propios |
| ✅ | Panel "Tu progreso" | `PanelProgreso.tsx` | enlace en la página principal; lista reciente primero (fecha, tipo, score, cobertura `n/5`, Ultra, hallazgos); "Borrar historial" con `confirm()` |

### Muletillas (21 patrones)

- **Base (§8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Oratoria (11):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin",
  "entonces", "¿me explico?", "a ver".
- **Umbral ≥3 (2):** **"pues"** y **"bueno"** (no se reportan ni se resaltan
  con menos de 3 apariciones).
- 🟡 Chrome omite "eeee".

## 2. Abierto para la comunidad

| Ítem | Notas |
|---|---|
| Historial entre dispositivos o cuentas | El progreso queda en el `localStorage` de este navegador. No hay cuentas ni sincronización. |
| Rúbricas custom / más idiomas | Hoy solo español y 4 rúbricas fijas. |
| STT alternativo (Whisper, Scribe, etc.) | Hoy solo Web Speech API. |

## 3. Variables de entorno

En `.env.local` y en el host de deploy:

- `MODEL_PROVIDER` — `nebius` (por defecto) o `gemini`.
- **Nebius** (`MODEL_PROVIDER=nebius`): `NEBIUS_API_KEY` (requerida),
  `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`),
  `NEBIUS_MODEL_ULTRA` (default `nvidia/Nemotron-3-Ultra-550b-a55b`) y
  `NEBIUS_MODEL_NANO` (default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`).
- **Gemini** (`MODEL_PROVIDER=gemini`, contingencia manual):
  `GEMINI_API_KEY` (requerida en ese modo).
- Configuración del modelo, compartida por el proveedor activo (todas
  opcionales): `MODEL`, `MODEL_FALLBACK_MODELS`, `MODEL_MAX_TOKENS`,
  `MODEL_TEMPERATURE`, `MODEL_RETRY_ATTEMPTS`, `MODEL_RETRY_DELAY_MS`,
  `MODEL_RETRY_MAX_DELAY_MS`. Los nombres `GEMINI_MODEL`,
  `GEMINI_FALLBACK_MODELS` y `GEMINI_RETRY_*` siguen funcionando como alias,
  pero **solo aplican cuando el proveedor activo es Gemini**.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` — TTS; sin ellas, SpeechSynthesis
- `TAVILY_API_KEY` — sugerencias; sin ella, esa sección no aparece

Prueba de humo manual contra Nebius real (fuera de vitest, la ejecuta el
mantenedor con su clave): `scripts/smoke-nebius.mjs`.

## 4. Notas técnicas

- Correr: `npm run dev` (sin Docker). Chrome para STT.
- Red: STT, Gemini, ElevenLabs y Tavily necesitan internet. SpeechSynthesis
  cubre el veredicto si ElevenLabs no responde.
- Tests: `npm test` (vitest; `src/lib/` y rutas de análisis/sparring con fetch
  mockeado). El loop completo, Ultra y sparring se siguen verificando a mano
  en Chrome.
- Timeout del modelo: 20 s en `estandar`/`rapido`, 90 s en `ultra` (razonamiento).
- `.env.local` no se commitea. `.env.example` sí, sin valores.
