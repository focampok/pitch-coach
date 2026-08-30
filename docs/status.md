# Pitch Coach — Status del proyecto

> **2026-08-30.** Qué está implementado, mapeado a `docs/alcance.md`.
> El loop (voz → análisis → dashboard + veredicto a pedido) está cerrado
> y verificado en Chrome.

## Resumen rápido

- ✅ Loop voz → transcripción → muletillas (Chrome).
- ✅ Avatar reactivo (§5.1): 5 estados sobre interim results.
- ✅ Deploy: `Dockerfile` + `railway.toml`.
- ✅ Análisis Gemini: rúbricas, prompt en español, tiempo como contexto,
  JSON estructurado, fallbacks y reintentos.
- ✅ Dashboard: score, rúbrica, muletillas, transcripción resaltada, tiempo.
- ✅ TTS: ElevenLabs vía `/api/tts`, fallback a SpeechSynthesis.
  **Sin autoplay** — el usuario pulsa "Escuchar veredicto".
- ✅ Tavily (§12): `/api/enriquecer` si hay puntos sin cumplir. Sin key,
  el dashboard no se rompe.
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
| ✅ | Transcripción (§9) | `GrabadorVoz.tsx` | `es-419`; solo resultados finales |
| ✅ | Muletillas (§8) | `src/lib/muletillas.ts` | 21 patrones; `PATRONES_MULETILLAS` es la fuente de verdad |
| ✅ | UI | `src/app/page.tsx` | selectores + grabador + `DashboardResultado` |
| ✅ | Avatar (§5.1) | `CoachAvatar.tsx` + `reacciones.ts` + `types/coach.ts` | 5 estados |
| ✅ | Sesión anónima | `src/app/page.tsx` | sin login ni persistencia |
| ✅ | Deploy | `Dockerfile` + `railway.toml` | standalone; healthcheck `/` |
| ✅ | Rúbricas (§6) | `src/lib/rubricas.ts` | 4 tipos × 5 puntos |
| ✅ | Tipos (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` y relacionados |
| ✅ | Tiempo real (§7) | `GrabadorVoz.tsx` + `page.tsx` | contexto de Gemini + dashboard |
| ✅ | Cliente Gemini (§13) | `src/lib/gemini.ts` | server-side; fallbacks; backoff; timeout 20 s |
| ✅ | Prompt (§7/§13) | `src/lib/prompts.ts` | español; score 0–100; `veredicto_corto` |
| ✅ | API `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` | 400 / 502 |
| ✅ | Dashboard | `DashboardResultado.tsx` + `dashboard-resultado.css` | incluye Tavily |
| ✅ | TTS (§13) | `ReproductorVeredicto.tsx` + `elevenlabs.ts` + `/api/tts` | timeout 6 s; `autoPlay={false}` |
| ✅ | Tavily (§12) | `tavily.ts` + `/api/enriquecer` | best-effort |

### Muletillas (21 patrones)

- **Base (§8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Oratoria (9):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin",
  "entonces".
- **Umbral ≥3 (4):** "¿me explico?", "a ver", **"pues"** y **"bueno"**
  (no se reportan ni se resaltan con menos de 3 apariciones).
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

- `GEMINI_API_KEY` — requerida
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_MALE`, `ELEVENLABS_VOICE_ID_FEMALE` — TTS; sin ellas, SpeechSynthesis
- `TAVILY_API_KEY` — sugerencias; sin ella, esa sección no aparece

## 4. Notas técnicas

- Correr: `npm run dev` (sin Docker). Chrome para STT.
- Red: STT, Gemini, ElevenLabs y Tavily necesitan internet. SpeechSynthesis
  cubre el veredicto si ElevenLabs no responde.
- Sin tests automatizados: prueba manual en Chrome; `npx tsx` puntual si
  hace falta.
- `.env.local` no se commitea. `.env.example` sí, sin valores.
