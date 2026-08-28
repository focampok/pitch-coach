# Pitch Coach — Status del proyecto

> **Checkpoint pre-evento · 2026-08-27** (revisión del alcance)
> Este documento es el punto de partida el día del evento. Describe qué está
> implementado y qué falta, mapeado a las secciones de `docs/alcance.md`.
> Actualizado contra el alcance revisado (nueva §12 "Uso de patrocinadores",
> stack con ElevenLabs/Tavily, Vapi/n8n/Exa descartados).
> Actualizarlo conforme avance el trabajo en el evento.
>
> **Última actualización · 2026-08-27 (noche):** el análisis con Gemini quedó
> implementado de punta a punta (rúbricas → prompt → cliente con fallbacks →
> API route → página con JSON crudo), verificado con grabación real y petición
> simulada. Quedan pendientes TTS, dashboard visual y Tavily (ver sección 2).

## Resumen rápido

- ✅ **Loop voz → transcripción → muletillas** funciona de punta a punta en Chrome.
- ✅ **Coach visual (avatar reactivo, §5.1 alcance)** implementado: 5 estados que
  reaccionan en tiempo real sobre los interim results (muletillas + frases de impacto),
  con mensajes humorísticos y accesibilidad (prefers-reduced-motion, aria-live).
- ✅ **Deploy a Railway** realizado: `Dockerfile` + `railway.toml` y el servicio en
  línea (https://pitch-coach-production-1c0c.up.railway.app, ver README).
- ✅ **Análisis con Gemini** (rúbrica + score + veredicto + tiempo como contexto §7)
  implementado de punta a punta: rúbricas hardcodeadas por tipo (§6), prompt en
  español, cliente Gemini con modelo configurable + fallbacks + reintentos con
  backoff (§13), API route con muletillas y JSON estructurado. Verificado con
  grabación real (score 95) y petición simulada con `tiempo_real_segundos`.
- ⬜ **Veredicto hablado (TTS): ElevenLabs prioritario con fallback obligatorio a
  SpeechSynthesis**, **dashboard visual** completo, y **enriquecimiento Tavily**
  siguen pendientes (stubs/null).

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
| ✅ | UI principal | `src/app/page.tsx` | selectores + grabador + transcripción capturada + resumen de muletillas + análisis (JSON crudo, temporal) |
| ✅ | Coach visual (avatar, §5.1) | `src/components/CoachAvatar.tsx` + `src/lib/reacciones.ts` + `src/types/coach.ts` | SVG + 5 estados (escuchando, estremecido, sorprendido, asintiendo, mirandoReloj) reaccionando en vivo a muletillas y frases de impacto vía interim results; mensajes humorísticos; animaciones CSS con `prefers-reduced-motion` |
| ✅ | Sesión anónima (§9.10) | `src/app/page.tsx` | sin login ni persistencia; un intento completo de punta a punta |
| ✅ | Deploy a Railway (§13) | `Dockerfile` + `railway.toml` | build standalone de Next.js; healthcheck `/`; deploy automático al push a `main` (README) |
| ✅ | Rúbricas en código (§6) | `src/lib/rubricas.ts` | 4 rúbricas hardcodeadas por tipo, 5 puntos cada una con `punto` + `queBuscar`; acceso vía `obtenerRubrica()` |
| ✅ | Tipos del análisis (§13) | `src/types/pitch.ts` | `ResultadoAnalisis` (score, veredicto_corto, rubrica[], muletillas, tiempo_real_segundos, tiempo_maximo_segundos), `EvaluacionRubrica`, `SolicitudAnalisis`, `ConteoMuletillas` |
| ✅ | Capturar tiempo real usado (§7) | `src/components/GrabadorVoz.tsx` + `src/app/page.tsx` | `finalizar()` calcula el tiempo real y lo pasa a `onTranscripcionCompleta`; se envía en la solicitud y entra como contexto del prompt |
| ✅ | Cliente Gemini (§13) | `src/lib/gemini.ts` | `GEMINI_API_KEY` server-side; modelo configurable (`GEMINI_MODEL`), lista de fallbacks (`GEMINI_FALLBACK_MODELS`), reintentos con backoff exponencial (`GEMINI_RETRY_ATTEMPTS/DELAY_MS/MAX_DELAY_MS`), timeout 20 s, salida estructurada JSON (`responseSchema`) y validación |
| ✅ | Construcción del prompt (§7/§13) | `src/lib/prompts.ts` | prompt en español con transcripción + tipo + puntos de rúbrica (con "qué buscar") + **tiempo real vs. máximo**; pide score 0-100 y veredicto_corto de 1-2 frases |
| ✅ | API route `analizar-pitch` | `src/app/api/analizar-pitch/route.ts` | valida la solicitud, llama a Gemini, detecta muletillas server-side y devuelve `ResultadoAnalisis` completo; errores → 400 (validación) / 502 (Gemini) |

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

> Los ítems 1–6 (rúbricas, tipos, tiempo real, cliente Gemini, prompt, API route)
> **ya están implementados** — ver sección 1. Queda el TTS, el dashboard visual y
> el enriquecimiento opcional con Tavily:

| Orden | Ítem | Archivos | Qué falta |
|---|---|---|---|
| 1 | Veredicto hablado | `src/components/ReproductorVeredicto.tsx` (null) | Primero SpeechSynthesis (garantiza el loop), luego **ElevenLabs prioritario** con `ELEVENLABS_API_KEY` y fallback obligatorio a SpeechSynthesis (§13) |
| 2 | Dashboard visual | `src/components/DashboardResultado.tsx` (null) | transcripción, muletillas resaltadas, puntos de rúbrica cumplidos/faltantes, score (§9). Hoy la página muestra el JSON crudo como placeholder temporal |
| 3 | *(Opcional)* Enriquecimiento Tavily | API route nueva (server-side) con `TAVILY_API_KEY` | Cuando falta una cifra, buscar estadística real y sugerirla en el dashboard (§12) |

> Deploy ya no es un ítem pendiente: Railway está en línea. Solo falta, si no
> están, configurar las variables en Settings → Variables: `GEMINI_API_KEY`
> (requerida), `ELEVENLABS_API_KEY` y `TAVILY_API_KEY` (opcionales, degradan).

## 3. Decisiones de patrocinadores y cambios del alcance (2026-08-27)

El alcance se actualizó con decisiones nuevas que hay que respetar:

- **Vapi descartado explícitamente (§12)** — **decisión tomada (2026-08-27)**:
  queda fuera del proyecto definitivamente. Se eliminaron sus referencias del
  repo (`.env.example`, `Dockerfile`, `README.md`, `CLAUDE.md`). Los únicos
  patrocinadores en uso son **Tavily y ElevenLabs**. El loop de voz ya está
  cubierto por Web Speech API + ElevenLabs/SpeechSynthesis.
- **n8n fuera del MVP (§12/§14)**: solo se evalúa al final para un recap por
  email/WhatsApp. No agregar integración antes.
- **Exa descartado en favor de Tavily (§12)**: no integrar ambos a la vez.
- **ElevenLabs es la primera opción de TTS, con fallback obligatorio a
  SpeechSynthesis (§13)**: `ReproductorVeredicto` implementa primero el fallback
  y luego ElevenLabs como prioridad — el fallback nunca se elimina.
- **Tavily es enriquecimiento opcional no crítico (§12)**: no es parte del loop
  crítico; solo si sobra tiempo (§14).

## 4. Cómo partir el día del evento

1. `npm run dev` (Linux nativo, sin Docker).
2. `cp .env.example .env.local` y completar `GEMINI_API_KEY` (requerida);
   `ELEVENLABS_API_KEY` y `TAVILY_API_KEY` opcionales (degradan con fallback).
3. El análisis con Gemini ya está implementado. Siguiente en orden: TTS con
   fallback primero → dashboard visual → Tavily opcional (ver sección 2).
   El deploy a Railway ya está hecho.
4. Referencias útiles del alcance: §6 (rúbricas), §7 (tiempo como contexto),
   §5.1 (avatar: estados y reglas — ya implementado), §12 (uso de patrocinadores:
   Vapi/n8n/Exa descartados; ElevenLabs y Tavily sí), §13 (stack y JSON esperado),
   §14 (orden de construcción), §15 (corte de emergencia: si aprieta el tiempo,
   quedarse con un solo tipo de pitch, priorizar el loop completo, y
   **el avatar es lo primero que se corta**).

## 5. Notas técnicas para el día

- **Navegador:** Chrome está instalado (Chromium fue removido). La Web Speech API
  solo es confiable en Chrome/Chromium. Brave no la soporta y Firefox la trae
  deshabilitada (§13). **La demo se hace en Chrome.**
- **Red:** el STT de Chrome procesa el audio en servidores de Google — requiere
  internet. Riesgo si el wifi del venue falla (§13). ElevenLabs (TTS) y Tavily
  también requieren red: el fallback SpeechSynthesis garantiza el veredicto
  hablado pase lo que pase.
- **Hardware (§13):** micrófono USB-C y bocina Bluetooth para la demo. Probar la
  conexión de la bocina antes del evento; plan B: salida por cable de la laptop.
- **Demo de muletillas:** mostrar las léxicas ("o sea", "digamos"); "eeee" casi
  nunca aparecerá por limitación del STT.
- **Sin tests automatizados:** no hay framework de test. Las verificaciones se
  hacen con `npx tsx` puntual (sin instalar dependencias) + prueba manual en el
  navegador.
- **Entorno:** `.env.local` no se commitea (en `.gitignore`). Solo `.env.example`
  se trackea. `tsconfig.tsbuildinfo` es un artefacto de build y no se commitea.

## 6. Demo (idea en curso)

Pitch "malo" intencional como input de la demo para mostrar lo que el coach
detecta (muletillas + puntos de rúbrica faltantes + score). El análisis de Gemini
ya funciona de punta a punta (ver sección 1); para el loop completo
(hablar → veredicto hablado) falta el TTS (ítem 1 de la sección 2) y opcionalmente
el dashboard visual.

**Momento "wow" del avatar (ya implementado):** al decir una muletilla en vivo
(ej. "o sea"), el coach se estremece **en el instante** mientras el contador lo
muestra — feedback en el momento, no después. Si aprieta el tiempo, el avatar se
corta antes que el loop completo (§15 alcance), así que la demo no debe depender de él.

**Momento "wow" de voz (al completar el TTS, §13):** el veredicto hablado suena
por la bocina con voz de ElevenLabs y cae a SpeechSynthesis nativa si la llamada
falla o tarda — el loop nunca se interrumpe.
