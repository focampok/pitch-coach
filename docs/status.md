# Pitch Coach — Status del proyecto

> **2026-08-30.** Qué está implementado, mapeado a `docs/alcance.md`.
> El loop (voz → análisis → dashboard + veredicto a pedido) está cerrado
> y verificado en Chrome.

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
- ✅ Tests unitarios (`npm test`, vitest) sobre la lógica de `src/lib/`.
- ✅ Límites: transcripción máx. 8000 caracteres y rate limit por IP en memoria.
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
| ✅ | Sesión anónima | `src/app/page.tsx` | sin login ni persistencia |
| ✅ | Deploy | `Dockerfile` + `railway.toml` | standalone; healthcheck `/` |
| ✅ | Rúbricas (§6) | `src/lib/rubricas.ts` | 4 tipos × 5 puntos |
| ✅ | Tipos (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` y relacionados |
| ✅ | Tiempo real (§7) | `GrabadorVoz.tsx` + `page.tsx` | contexto de Gemini + dashboard |
| ✅ | Cliente del modelo (§13) | `src/lib/modelo.ts` + adaptadores | capa neutra + fábrica por `MODEL_PROVIDER`; backoff; timeout 20 s |
| ✅ | Proveedor Nebius (por defecto) | `src/lib/proveedor-nebius.ts` | `/chat/completions` OpenAI-compatible; `json_schema` estricto (`{name, strict, schema}`); `enable_thinking: false`; reintento por `finish_reason: length`; modo `ultra` solo en librería (sin ruta ni botón) |
| ✅ | Proveedor Gemini (contingencia) | `src/lib/proveedor-gemini.ts` | `generateContent`; se activa con `MODEL_PROVIDER=gemini` |
| ✅ | Esquema restringido | `src/lib/validar-analisis.ts` | `construirEsquemaAnalisisRestringido` con `minItems`/`maxItems`/`enum`, generado una vez (caché) |
| ✅ | Prompt (§7/§13) | `src/lib/prompts.ts` | español; transcripción como dato no confiable; pide rúbrica sin nombres + `claridad` + `veredicto_corto` |
| ✅ | API `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` | 400 / 413 / 429 / 502 (errores genéricos al cliente) |
| ✅ | Dashboard | `DashboardResultado.tsx` + `dashboard-resultado.css` | incluye Tavily |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | timeout 6 s; 413/429; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `/api/enriquecer` | best-effort; timeout 8 s |
| ✅ | Límites | `src/lib/limites.ts` + `src/lib/rate-limit.ts` | transcripción máx. 8000; rate limit por IP en memoria (por instancia) |

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
| Segundo intento comparado en la misma sesión | No hay persistencia. |
| Historial entre sesiones | Requiere usuarios o almacenamiento. |
| Rúbricas custom / más idiomas | Hoy solo español y 4 rúbricas fijas. |
| STT alternativo (Whisper, Scribe, etc.) | Hoy solo Web Speech API. |

## 3. Variables de entorno

En `.env.local` y en el host de deploy:

- `MODEL_PROVIDER` — `nebius` (por defecto) o `gemini`.
- **Nebius** (`MODEL_PROVIDER=nebius`): `NEBIUS_API_KEY` (requerida),
  `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`) y
  `NEBIUS_MODEL_ULTRA` (default `nvidia/Nemotron-3-Ultra-550b-a55b`).
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
- Tests: `npm test` (vitest, unitarios sobre `src/lib/`). El loop completo se
  sigue verificando a mano en Chrome.
- `.env.local` no se commitea. `.env.example` sí, sin valores.
