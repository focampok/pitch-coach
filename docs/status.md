# Pitch Coach — Status del proyecto

> **Checkpoint pre-evento · 2026-08-21**
> Este documento es el punto de partida el día del evento. Describe qué está
> implementado y qué falta, mapeado a las secciones de `docs/alcance.md`.
> Actualizarlo conforme avance el trabajo en el evento.

## Resumen rápido

- ✅ **Loop voz → transcripción → muletillas** funciona de punta a punta en Chrome.
- ⬜ **Análisis con Gemini** (rúbrica + score + veredicto), **veredicto hablado (TTS)**,
  **dashboard visual** completo y **deploy a Railway** siguen pendientes (stubs/TODO).

## Leyenda

- ✅ Implementado y probado en navegador
- 🟡 Implementado con limitación conocida
- ⬜ Pendiente (stub/TODO)

## 1. Implementado

| Estado | Ítem (§9 alcance) | Archivos | Notas |
|---|---|---|---|
| ✅ | Selector de tipo de pitch (§9.1) | `src/components/SelectorTipoPitch.tsx` | 4 opciones: capital, educación, innovación, tecnología |
| ✅ | Selector de duración máxima (§9.2) | `src/components/SelectorDuracion.tsx` | presets fijos de 1 a 7 minutos |
| ✅ | Grabación con corte automático (§9.3) | `src/components/GrabadorVoz.tsx` | Web Speech API: continuous, interim results, countdown, auto-stop al límite, manejo de errores y mensaje de navegador no soportado |
| ✅ | Transcripción de voz a texto (§9.4) | `src/components/GrabadorVoz.tsx` | idioma `es-419` (LATAM); acumula solo resultados finales |
| ✅ | Detección de muletillas (§9.5) | `src/lib/muletillas.ts` + `src/components/ResumenMuletillas.tsx` | 21 patrones con conteo por ocurrencia (detalle abajo) |
| ✅ | UI principal | `src/app/page.tsx` | selectores + grabador + transcripción capturada + resumen de muletillas |

### Detalle de muletillas (21 patrones)

- **§8 del alcance (8):** "eeee / ehh", "o sea", "como les decía", "este…",
  "bueno pues", "a mí me tocó hablar de", "digamos", "en ese sentido".
- **Tier 1 — oratoria (9):** "es decir", "quiero decir", "en otras palabras",
  "básicamente", "literalmente", "prácticamente", "obviamente", "en fin", "entonces".
- **Tier 2 (4):** "¿me explico?", "a ver", más **"pues" y "bueno" con umbral ≥3**
  ocurrencias (evitan sobre-contar su uso legítimo como conectores/adjetivos).
- **Limitación conocida 🟡:** el STT de Chrome omite rellenos vocálicos ("eeee"),
  por lo que ese patrón rara vez se dispara. Las muletillas léxicas sí se capturan.

## 2. Pendiente (en orden sugerido — §14 alcance)

| Orden | Ítem | Archivos | Qué falta |
|---|---|---|---|
| 1 | Rúbricas en código | `src/lib/rubricas.ts` (stub) | Implementar las 4 rúbricas según §6 |
| 2 | Cliente Gemini | `src/lib/gemini.ts` (stub) | Llamada a la API usando `GEMINI_API_KEY` (server-side) |
| 3 | Construcción del prompt | `src/lib/prompts.ts` (stub) | Prompt con transcripción + tipo + rúbrica + duración usada (§7), pidiendo JSON estructurado en español |
| 4 | API route `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` (stub) | Reemplazar el JSON hardcodeado por la llamada real a Gemini + muletillas + tiempo |
| 5 | Tipos del análisis | `src/types/pitch.ts` | Definir `ResultadoAnalisis` según §12 (score, veredicto_corto, rubrica[], muletillas) |
| 6 | Veredicto hablado | `src/components/ReproductorVeredicto.tsx` (null) | SpeechSynthesis (TTS) sobre el veredicto corto |
| 7 | Dashboard visual | `src/components/DashboardResultado.tsx` (null) | transcripción, muletillas resaltadas, puntos de rúbrica cumplidos/faltantes, score |
| 8 | Deploy a Railway | `Dockerfile` (**no existe aún**) + panel Railway | Crear Dockerfile solo para Railway; configurar `GEMINI_API_KEY` en Settings → Variables |

## 3. Cómo partir el día del evento

1. `npm run dev` (Linux nativo, sin Docker).
2. `cp .env.example .env.local` y completar `GEMINI_API_KEY`.
3. Seguir el orden de la tabla anterior (rúbricas → Gemini → prompt → API route →
   tipos → TTS → dashboard → deploy).
4. Referencias útiles del alcance: §6 (rúbricas), §7 (tiempo como contexto),
   §12 (JSON esperado), §14 (orden de construcción), §15 (corte de emergencia:
   si aprieta el tiempo, quedarse con un solo tipo de pitch y priorizar el loop completo).

## 4. Notas técnicas para el día

- **Navegador:** Chrome está instalado (Chromium fue removido). La Web Speech API
  solo es confiable en Chrome/Chromium. Brave no la soporta y Firefox la trae
  deshabilitada (§13). **La demo se hace en Chrome.**
- **Red:** el STT de Chrome procesa el audio en servidores de Google — requiere
  internet. Riesgo si el wifi del venue falla (§13).
- **Demo de muletillas:** mostrar las léxicas ("o sea", "digamos"); "eeee" casi
  nunca aparecerá por limitación del STT.
- **Sin tests automatizados:** no hay framework de test. Las verificaciones se
  hacen con `npx tsx` puntual (sin instalar dependencias) + prueba manual en el
  navegador.
- **Entorno:** `.env.local` no se commitea (en `.gitignore`). Solo `.env.example`
  se trackea. `tsconfig.tsbuildinfo` es un artefacto de build y no se commitea.

## 5. Demo (idea en curso)

Pitch "malo" intencional como input de la demo para mostrar lo que el coach
detecta (muletillas + puntos de rúbrica faltantes + score). Para el loop completo
(hablar → veredicto hablado) hace falta terminar los ítems 1–6 de la sección 2.
