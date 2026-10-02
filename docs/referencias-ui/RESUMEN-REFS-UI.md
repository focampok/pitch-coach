# Resumen curado — refs UI · Pitch Coach (web)

Documento de referencia visual para la fase de dirección. Sin código.
Fuentes: [`README.md`](README.md) de esta carpeta + capturas locales (solo lectura) + productos públicos (web, sin Mobbin/Refero).
Fecha: 2026-10-02.

---

## 1. Visualizador de audio

Dirección: indicador de mic **en vivo** que reacciona a audio real. **No orbe brillante.** Explorar EQ/waveform como héroe, forma angular que pulsa, o línea tipo señal de mercado.

### Motivos ya presentes en refs locales

`color.png` (usuario) ya contiene los tres lenguajes de datos que el README propone reutilizar como animación:

| Motivo | En `color.png` | Uso propuesto |
|---|---|---|
| **Barras / EQ** | Card "Order volume" — barras delgadas + línea base punteada | Héroe de grabación; el más corto de implementar |
| **Anillo angular** | Card "Registrations" — anillo de progreso grueso (no esfera) | Anti-orbe: geométrico; engrosa/segmenta con amplitud |
| **Línea de señal** | Card "NPS" — línea + área | Continuidad formal con Wealthsimple |

Reglas del README (mantener): un solo matiz; animar **altura/opacidad**, nunca glow; reposo = paso 600 de la rampa; continuidad grabación → score (el mismo elemento se asienta y *es* el veredicto).

### Enfoques (2–3 variantes por familia)

#### A. EQ / waveform como héroe

1. **Barras de frecuencia (multibanda)** — 12–24 barras finas, alineadas al centro o desde baseline; altura = bandas FFT del mic. Reposo: todas al mínimo + `signal-rest`. Pico: `signal-peak`. Encaja con "Order volume" de `color.png`.
2. **Waveform de dominio temporal** — trazo continuo tipo Voice Memos / Descript: canvas con AnalyserNode, línea de 1–2px, sin relleno glow. Mejor para "estoy grabando un pitch" (sensación de herramienta, no de agente).
3. **Barras escasas (5–7)** — estilo LiveKit Bar / ElevenLabs BarVisualizer con `state` (listening/thinking). Más "voice agent"; usable si se desatura y se quita el look neon.

#### B. Forma angular que pulsa (anti-orbe)

1. **Anillo segmentado / arco** — el de "Registrations": contorno plano, grosor o apertura modulada por amplitud RMS. Sin sombreado 3D.
2. **Polígono wireframe** — N vértices (hex/octágono) empujados por bandas de frecuencia; un color, sin fill. Si se llena o brilla → vuelve al cliché del orbe.
3. **Cruz / chevron / diamante** — forma editorial (marca institucional) que escala 1.0→1.08 y cambia opacidad; más "coach serio" que "AI listening blob".

#### C. Línea tipo señal de mercado

1. **Línea de ancho completo** — precedente Wealthsimple (`01-visualizador-audio/wealthsimple-com.png`): trazo blanco/signal que enhebra el viewport y termina en pico agudo. En pitch-coach: el trazo se escribe en vivo con la envolvente del audio.
2. **Sparkline + área** — como NPS en `color.png`: línea + fill al ~20–40% opacity del mismo matiz (no glow). Ideal en header compacto durante grabación.
3. **Ticker / tape** — línea que avanza de izquierda a derecha como cotización; silencio = plano, voz = ruido controlado. Muy "inversionista"; riesgo de parecer decorativo si no está ligado al AnalyserNode.

### Qué encaja con "coach serio / inversionista"

| Prioridad | Enfoque | Por qué |
|---|---|---|
| **1º** | Barras EQ tipo dashboard (`color.png` Order volume) | Ya es lenguaje de datos del producto; no grita "AI" |
| **1º empatado** | Línea de señal Wealthsimple / NPS | Precedente fintech editorial; hero o transición a score |
| **2º** | Anillo segmentado (Registrations) | Anti-orbe claro; buen puente grabación→score circular |
| Evitar / adaptar | Aura/orb LiveKit·Deepgram·GodUI·ChatGPT Voice | Son el cliché; solo si se despoja a wireframe + un matiz |
| Evitar | Gradientes neon, corona rainbow, blur glow | Explicitamente fuera de dirección |

⚠ **Salvedad sobre el anillo.** El motivo anillo quedó **sin precedente real de
producto** en el lote local. La captura de `zencastr` que la ficha original
clasificaba como "anillo" es en realidad un **botón de grabación circular** dentro
de un mockup de landing, no un anillo de amplitud. El anillo sigue siendo una
opción válida (viene de `color.png`, card "Registrations"), pero conviene saber que
**no está respaldado por una captura de producto** — es una extrapolación desde el
lenguaje de datos del propio `color.png`.

⚠ **El contraste de gradiente rainbow.** Las capturas de `audiomotion` (activo,
sin-audio y radial) usan todas el mismo gradiente rainbow por frecuencia
(rojo→azul). La ficha original marcó como contra-ejemplo solo la radial; el
gradiente **aplica a la familia entera** y contradice la dirección de un solo matiz.

### Ejemplos públicos (por categoría)

#### Voice assistant (2–4)
| Producto | URL | Nota |
|---|---|---|
| LiveKit Agents UI — visualizers | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Bar / Grid / Radial / Wave / Aura — **tomar Bar y Wave; descartar Aura** |
| ElevenLabs BarVisualizer | https://ui.elevenlabs.io/docs/components/bar-visualizer | Estados listening/speaking/thinking + MediaStream real |
| ChatGPT Voice | https://help.openai.com/en/articles/20001274-chatgpt-voice | Orbe = **contra-referencia** (exactamente lo que no queremos) |
| Orb-UI guide (estados) | https://orb-ui.com/docs/guides/voice-agent-ui | Útil por la máquina de estados idle→listening→thinking→speaking; no por el orbe |

#### Audio waveform visualizer (2–4)
| Producto | URL | Nota |
|---|---|---|
| Deepgram UI (LiveWaveform / BarVisualizer) | https://github.com/deepgram/ui/tree/main/packages/ui | Canvas waveform + barras; colores de marca verdes/cyan → **cambiar matiz** |
| audio-pulse (React) | https://github.com/kirandhudhat/audio-pulse | Waveform canvas light/dark, configurable |
| LiveKit Wave visualizer | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Variante Wave horizontal |
| Voice UI Kit (Figma, free) | https://www.figma.com/community/file/1656021062890107334/voice-ui-kit-waveforms-stt-transcription-free | Estados idle/recording/playback — referencia de kit, no producto |

#### Recording app (2–4)
| Producto | URL | Nota |
|---|---|---|
| Descript Voice Recorder | https://www.descript.com/tools/voice-recorder | Recorder + transcript en tiempo real; tono herramienta pro |
| Otter.ai | https://otter.ai/ai-notetaker · https://otter.ai/mobile | Mic + transcript live; UI sobria |
| Apple Voice Memos (guía) | https://support.apple.com/guide/voice-memos/play-a-recording-vma2c8c0a040/mac | Waveform de overview + playhead — patrón nativo serio |
| Granola | https://www.granola.ai/ | AI notepad para meetings; **sin bot, sin orbe** — tono inversionista |

#### AI listening state (2–4)
| Producto | URL | Nota |
|---|---|---|
| ElevenLabs BarVisualizer states | https://ui.elevenlabs.io/docs/components/bar-visualizer | connecting / listening / thinking / speaking |
| LiveKit agent state + audio | https://docs.livekit.io/frontends/agents-ui/audio-visualizer/prebuilt/ | Volumen + estado del agente |
| Vapi / Orb-UI states | https://orb-ui.com/docs/guides/voice-agent-ui | Tabla de qué debe comunicar cada estado |
| Deepgram Orb (contra) | https://github.com/deepgram/ui/tree/main/packages/ui | Hoop audio-reactive — útil como "qué no hacer" si brilla |

#### Investor / fintech dashboard dark mode (2–4)
| Producto | URL | Nota |
|---|---|---|
| Mercury (dark mode) | https://support.mercury.com/hc/en-us/articles/37538153196948-Enabling-dark-mode · https://mercury.com/insights | Banco startup; un número héroe, charts calmados |
| Copilot Money (análisis) | https://blakecrosley.com/guides/design/copilot-money | Dark navy canvas + data brillante — **en refs locales es contra-ejemplo** (lúdico) |
| Wealthsimple | https://www.wealthsimple.com/ | Editorial serif + línea de señal; claro/cálido más que dark |
| Linear (tono dark tooling) | https://linear.app/ | Un acento, densidades serias — referencia de disciplina, no de audio |

#### Coaching feedback / score screen (2–4)
| Producto | URL | Nota |
|---|---|---|
| Yoodli — Personalized Feedback | https://yoodli.ai/platform/ai-feedback | Feedback inmediato post-práctica, rúbricas org |
| Yoodli Roleplays | https://yoodli.ai/platform/ai-roleplays | Pitch/roleplay + goals tipados |
| shadcn AI Interview Coach block | https://www.shadcn.io/blocks/ai-interview-coach | Score /10 + strengths/improvements + rubric (patrón UI, no marca) |
| Refs locales Lucid / Tana | `04-jerarquia-resultado/lucidmotors-com.png`, `03-tipografia/tana-inc.png` | Métricas en fila (Lucid); score+veredicto inmediato (Tana) |

### Qué rindió el barrido — hueco angostado, **no** cerrado

Se capturaron 22 pantallas. **11 eran landings de producto sin visualizador vivo**
y se descartaron (riverside ×2, descript ×2, otter, fireflies, tldv ×2, podcastle,
adobe podcast, howlerjs inicio). Dos de transcripción se movieron a
`04-jerarquia-resultado/`.

**Razón de fondo, que es el aprendizaje real: las landings públicas de productos de
grabación no exponen su visualizador.** El material utilizable vino de **demos de
librería** (`wavesurfer`, `peaksjs`, `audiomotion`) y de un mockup (`zencastr`),
no de UI de producto en vivo.

Lo que esto implica: para capturas de producto real hace falta **sesión
autenticada** o **capturas nativas**. Las landings de inspo/awwwards tampoco
cubren apps de grabación. El hueco está angostado; sigue abierto.

Ver `01-visualizador-audio/FICHAS.md` para el detalle verificado por captura.

---

## 2. Paleta / color

### Evaluación pedida: burdeos (wine) vs navy

Números completos y tokens en `README.md` (sección "Paleta propuesta"). Acá solo
el resultado:

- **Burdeos `#6E1D2E`** — 1.75:1 en oscuro (falla) / 10.46:1 en claro. Sirve en
  claro y como *campo*, nunca como acento chico sobre fondo oscuro.
- **Navy `#1B2A4A`** — 1.38:1 en oscuro (falla) / 13.31:1 en claro. Navy sobre
  navy = 1.00:1.
- **Aclarar cualquiera de los dos para dark los empuja al pastel** (el vino se
  vuelve rosa, o sea deja de ser vino). Ese es el mecanismo del cliché "IA glow".

**Conclusiones honestas (README + evaluación):**

1. **Ni wine ni navy funcionan como acento pequeño sobre fondo oscuro.** Es luminancia, no gusto.
2. **Harvard usa el vino como *campo* (fondo de bloque), no como acento** — bone sobre `#6E1D2E` = 10.46:1. Esa es la única vía seria del burdeos en dark.
3. Aclarar wine/navy para dark los empuja al pastel (lavanda Railway `#b4a4d5` es el mismo mecanismo). El cliché "IA glow" es en parte un accidente de contraste.
4. **Entre wine y navy (si hubiera que elegir sin olivo):**
   - **Claro:** ambos sirven; wine = gravedad institucional (Harvard); navy = dato/fintech (`color.png` COGS).
   - **Oscuro como acento:** ambos pierden. Wine gana solo si se usa como **campo de score** (panel filled). Navy gana solo como **neutro estructural** (no como signal).
   - **Como signal vivo del mic:** ninguno sobrevive el aclarado sin perder identidad.

### Olivo

Base extraída de `color.png`: **`#285828`**. Rampa de 11 pasos; pivote **`#457F42`
(600)** pasa umbral gráfico en claro (4.53:1) y en oscuro (3.99:1). Aclarar olivo →
salvia (sigue siendo olivo); aclarar vino → rosa (deja de ser vino). **La tabla de
tokens, la rampa completa y las reglas de animación están en `README.md`** — acá
no se duplican.

### Recomendación de color

| Rol | Elección | Motivo |
|---|---|---|
| **Portador único / signal (mic + charts)** | **Olivo rampa** | Identidad estable light+dark; ya en `color.png`; anti-cliché |
| Burdeos | Opcional solo como **campo** de un bloque score (modo Harvard), no como acento de UI | Cumple el pedido "evaluar wine" sin mentir sobre contraste |
| Navy | Secundario de datos *solo si* hacen falta dos series; preferir dos pasos de olivo; si no, slate `#46586B` / `#7E8FA3` del README | Evita competir con el signal |
| Evitar | Purple/indigo glow, neon green-cyan, amber/gold | Dirección explícita |

**Veredicto wine vs navy vs olivo:** para un producto light+dark con indicador vivo, **olivo gana**. Wine y navy fallan la prueba de acento en dark; wine solo como campo institucional; navy solo como neutro. No rechazar el pedido de evaluarlos — se evaluaron y pierden por física WCAG, no por moda.

---

## 3. Tipografía en contexto

Dirección: serif con carácter en títulos/score (Fraunces / Newsreader-like) + sans limpia en cuerpo (IBM Plex Sans-like). **Evitar Inter / Geist.**

### Refs locales → qué tomar

| Captura | Tipografía | Uso en pitch-coach |
|---|---|---|
| `03-tipografia/railway-com-tipografia.png` | IBM Plex **Serif** display con tracking negativo fuerte; sans de cuerpo con interlínea ~1.63 | Modelo técnico más cercano a "Plex Sans + serif carácter". **Descartar violeta del CTA** |
| `03-tipografia/tana-inc.png` | Source Serif 4 enorme, negro, un solo color en viewport | **Score + veredicto** al pliegue |
| `03-tipografia/moshimoshimusic-com.png` | Libre Baskerville chico como **etiqueta** | Labels de secciones colapsables (rúbrica, fillers…) |
| `03-tipografia/furoweb-eu.png` | Instrument Serif en oscuro, cálido | Alternativa serif display |
| `03-tipografia/danielsun-space.png` | LT Superior Serif oscuro | Techo de calidez editorial |
| Wealthsimple (web + captura) | Tiempos-like serif + sans geométrica | Pareja "inversionista editorial" |

### Pares recomendados (web-safe / Google Fonts adyacentes)

| Rol | Primaria | Alternativas | Notas |
|---|---|---|---|
| Display / score / veredicto | **Fraunces** o **Newsreader** | Source Serif 4, Instrument Serif, Libre Baskerville (solo labels) | Optical sizing si disponible; tracking −1% a −2% en >40px |
| Body / UI / transcript | **IBM Plex Sans** | IBM Plex Sans + Plex Mono para badges/rúbrica tags | Tabular nums (`tnum`) en scores y % |
| Evitar | Inter, Geist, system-ui genérico como voz de marca | — | Demasiado "AI SaaS default" |

### En contexto de pantallas

- **Grabación:** sans para timer/controles; el visualizador carga la personalidad (no hace falta serif en el mic).
- **Resultado:** serif enorme para número + etiqueta de veredicto ("Fuerte" / "A mejorar"); sans para rúbrica, fillers, transcript, Tavily.
- **Valencia del score:** por peso/tamaño tipográfico + label explícito — **no** bañar de verde/rojo el número (el olivo es identidad, no "aprobado").

---

## 4. Jerarquía — pantalla de resultado

Dirección: **score + veredicto grandes arriba**; rúbrica / fillers / transcript / Tavily en **secciones colapsables** abajo.

### Modelo de viewport (primer pliegue ~1280×800)

```
┌─────────────────────────────────────────────┐
│  [serif]  7.4          Fuerte               │  ← score + veredicto (inmediatos)
│  [opcional] el mismo motivo vivo → asentado │  ← barras/anillo/línea = score viz
│  ─ ─ ─ métricas Lucid: Clarity · Pace · … ─ │  ← versalita + valor + regla fina
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ▸ Rúbrica          (acordeón, fila layout)  │
│ ▸ Muletillas / fillers                      │
│ ▸ Transcripción                             │
│ ▸ Fuentes Tavily                            │
└─────────────────────────────────────────────┘
```

### Qué tomar de cada ref

| Ref | Patrón |
|---|---|
| **Tana** (`03-tipografia/tana-inc.png`) | Un número/frase monumental; resto subordinado; un solo portador de color |
| **Lucid** (`04-jerarquia-resultado/lucidmotors-com.png`) | Franja de métricas: versalita chica + valor grande + divisor vertical |
| **layout.png** (usuario) | Fila de acordeón: icono sobre `signal-tint` + título + badge mono + descripción; estado abierto = mismo matiz AA |
| **Basement** (`04-…/basement-studio.png`) | Techo de oscuridad art-directed — **no** copiar registro "estudio creativo" |
| **Copilot Money** (local + web) | **Contra-referencia:** dark fintech + bento + color decorativo → lee lúdico |

### Reglas de jerarquía

1. Score + veredicto caben **sin scroll** en desktop.
2. Secciones inferiores: chevron + label serif/sans chico (moshimoshimusic); una sola abierta a la vez o multi pero con ritmo ≥64–96px.
3. Hallazgos (`attention`) solo dentro de fillers/rúbrica — nunca tiñen el score.
4. Continuidad: si el mic era barras/anillo/línea, el score **reutiliza** ese motivo congelado.

---

## Best-fit — "coach serio, tipo inversionista, no genérico de IA"

### Núcleo a seguir (en orden)

1. **`color.png` + rampa olivo del README** — identidad, motivos de viz, anti-pastel.
2. **`layout.png`** — filas de rúbrica / acordeón.
3. **Wealthsimple (línea de señal + serif editorial)** — hero de grabación o transición.
4. **Tana** — score+veredicto al pliegue.
5. **Lucid metrics strip** — sub-scores.
6. **Railway tipografía (sin violeta)** — Plex serif/sans pairing.
7. **Harvard** — solo si se quiere wine como *campo* de score, no como accent UI.
8. **Granola / Descript / Otter / Yoodli** — tono producto (herramienta de trabajo), no landing awwwards.

### Contra-referencias (estudiar para no copiar)

- ChatGPT Voice / GodUI Voice Orb / LiveKit Aura / Deepgram Orb glow  
- Copilot Money (local) — fintech dark que se vuelve juguete  
- Railway CTA violeta / cualquier indigo-lavender glow  
- Basement Studio — demasiado "creative agency"

### Decisión corta de dirección

| Eje | Decisión |
|---|---|
| Color | **Olivo** como signal único; wine/navy evaluados y descartados como acento dark |
| Mic hero | **Barras EQ dashboard** o **línea de señal**; anillo como 2ª opción |
| Tipo | **Newsreader/Fraunces + IBM Plex Sans** |
| Resultado | Score serif arriba → acordeones abajo (`layout.png`) |
| Modo | Light + dark con la misma rampa; reposo `#457F42` en ambos |

---

## Índice de archivos locales

```
docs/referencias-ui/
  README.md               ← doc canónico: criterios, paleta, animación, descartes
  RESUMEN-REFS-UI.md      ← este archivo: resumen por categoría + refs públicas
  color.png · layout.png  ← set principal del usuario
  01-visualizador-audio/  ← 12 capturas + FICHAS.md (fichas verificadas)
  02-color/               ← copilot-money (contra-ref), harvard-edu
  03-tipografia/          ← railway-com-tipografia, tana-inc, moshimoshimusic-com,
                             furoweb-eu, danielsun-space
  04-jerarquia-resultado/ ← lucidmotors-com, basement-studio,
                             otter-1280-transcribiendo, fireflies-1280-transcribiendo
```

Cada imagen vive en **una sola** carpeta; qué aporta cada una está en la tabla del
`README.md`.

**Copia canónica:** `docs/referencias-ui/`, versionada en git dentro del repo. Es
la única fuente de verdad. Si existe una copia fuera del repo (p. ej.
`~/Proyectos/pitch-coach-refs/` o `/workspace/`), está desactualizada y debe
descartarse.
