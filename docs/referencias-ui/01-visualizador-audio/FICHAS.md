# Fichas — visualizador de audio

Capturas en `01-visualizador-audio/`. Columnas: **motivo** (forma del
visualizador) · **reacción al audio** · **en reposo** (sin audio) · **composición**
(dónde se ubica respecto de botón / timer / título) · **390px**.

`✔` verificado mirando la imagen · `~` afirmado en la ficha original, no verificado · `⚠` advertencia

## Demos de librería

| Archivo | Motivo | Reacción al audio | En reposo | Composición | 390px |
|---|---|---|---|---|---|
| `wavesurfer-1280-ecualizador.png` | **barras (faders)** | La onda se complementa con **9 barras verticales con perilla** — bandas de EQ ✔ | Onda cargada sigue visible; faders en neutro | Onda arriba, reproductor y faders debajo ✔ | no capturado |
| `wavesurfer-1280-mic-permiso.png` | onda (vacía) | Al grabar dibuja onda continua o scrolling; cronómetro en 00:00 | **Panel de onda VACÍO** + "Press Record to start recording" ✔ | Botón Record + select mic + checkbox arriba; panel vacío debajo ✔ | no capturado |
| `wavesurfer-1280-escuchando.png` | onda | Onda estática magenta de audio pre-cargado | Queda la onda de referencia | Onda ocupa el panel; controles no dominan | no capturado |
| `wavesurfer-390-escuchando.png` | onda | Onda pre-cargada en módulo compacto; estática | Igual, sin recorte vivo | Onda manda; nav y aviso se apilan | ✔ panel estrecho, onda recortada/scrollable |
| `peaksjs-1280-escuchando.png` | onda + línea | Waveform principal con overview y línea superior, tiempo y play | Forma gris, play en 00:00 | Visualizador ocupa casi toda la pantalla | no capturado |
| `howlerjs-1280-reproductor.png` | onda | Onda suave como indicador de progreso de pista | Conserva línea y controles en pausa | Reproductor y play/pause son foco | no capturado |

**Notas de las demos:**

- ⚠ Las dos capturas de `wavesurfer` son **páginas de documentación**, no UI de
  producto: dos tercios de la pantalla son un editor de código y hay un aviso
  publicitario. La ficha original describía el panel de demo y omitía esto.
  **No usarlas como referencia de composición** — sí como referencia del *elemento*.
- `~` La ficha original afirma que en `mic-permiso` el botón Record "queda
  deshabilitado". En la imagen se ve como un botón normal. No verificado.
- **El aporte real de `wavesurfer-1280-ecualizador`:** 9 barras verticales con
  perilla — un visualizador de barras que *además es control*. El indicador y el
  control son el mismo elemento.

## Analizador FFT (audioMotion)

| Archivo | Motivo | Reacción al audio | En reposo | Composición | 390px |
|---|---|---|---|---|---|
| `audiomotion-1280-activo.png` | barras / medidor | Oscilador de prueba A4: **pico estrecho en la banda central** ✔ | — | Analizador arriba, controles y test tone debajo | no capturado |
| `audiomotion-1280-sin-audio.png` | barras / medidor | — | **Canvas negro completamente vacío** + escala de frecuencias ✔ | El canvas domina; controles secundarios | no capturado |
| `audiomotion-1280-radial-contra-ejemplo.png` | anillo / barras radiales | Preset radial: rayo radial sobre fondo animado ✔ | Anillo y rayo mínimos sobre fondo oscuro | Visualizador domina por completo | no capturado |

**Notas del analizador:**

- ⚠ **Marcado de contra-ejemplo incompleto en la ficha original.** Las tres
  capturas usan el **mismo gradiente rainbow por frecuencia** (rojo → naranja →
  verde → azul). La original marcó como contra-ejemplo solo la radial. Si el
  gradiente es señal de contra-ejemplo, **aplica a la familia entera**.
- **El hallazgo más útil del lote:** el par `activo` / `sin-audio` responde la
  pregunta del estado de reposo. **Reposo = plano vacío**, no un pulso de espera.

## Producto

| Archivo | Motivo | Reacción al audio | En reposo | Composición | 390px |
|---|---|---|---|---|---|
| `zencastr-1280-grabando.png` | **botón de grabación** | **No hay visualizador de amplitud.** Es un **botón circular magenta** junto al timer 01:01 ✔ | no capturado | Mockup de teléfono dentro de una landing | ver versión 390 |
| `zencastr-390-grabando.png` | **botón de grabación** | Igual: botón + timer 01:02, CTA fijo inferior | no capturado | Mockup móvil + CTA sticky | ✔ header minimal, mockup apilado |

**Notas de producto:**

- ⚠ **Corrección importante.** La ficha original clasificaba `zencastr` como
  `anillo/medidor` y describía un "aro rojo de grabación". Verificado: es una
  **landing de marketing con un mockup de teléfono**, y lo que hay dentro es un
  **botón de grabación circular**, no un anillo de amplitud. Sirve como referencia
  del *estado grabando* (botón + timer juntos) y **no** como precedente del motivo
  anillo.
- El fondo es un degradado azul — fuera de nuestra dirección.

## Precedente formal (no es app de audio)

| Archivo | Motivo | Nota |
|---|---|---|
| `wealthsimple-com.png` | línea de señal | **Línea blanca de ancho completo** que enhebra tarjetas fotográficas y termina en un pico agudo. Aporta el motivo "línea tipo mercado". También sirve de referencia de color y de serif editorial. |

## Balance del barrido

Se capturaron 22 pantallas; **11 eran landings de producto sin visualizador vivo**
y se descartaron (riverside ×2, descript ×2, otter, fireflies, tldv ×2, podcastle,
adobe podcast, howlerjs inicio). Dos pantallas de transcripción se movieron a
`04-jerarquia-resultado/`.

**Conclusión del primer barrido: las landings públicas de productos de grabación
no exponen su visualizador.** El material vino de demos de librería (`wavesurfer`,
`peaksjs`, `audiomotion`) y de un mockup (`zencastr`). Eso se resolvió después con
los dos barridos de abajo.

## Capturas propias — estados en vivo (`vivo/`)

Capturadas con Chromium automatizado y **micrófono sintético habilitado**
(`--use-fake-device-for-media-stream`), o sea con señal real corriendo.

| Archivo | Qué muestra |
|---|---|
| `audiomotion-index-1440-vivo.png` | Los **cuatro motivos corriendo a la vez**: barras lineales, **anillo radial segmentado**, área rellena, matriz de barras |
| `audiomotion-index-390-vivo.png` | Lo mismo a ancho de teléfono |
| `audiomotion-minimal-1440-vivo.png` | **Espectro completo en vivo.** El hallazgo más útil: barras delgadas sobre línea base **con LED de pico sostenido** arriba — los puntos que quedan flotando un instante tras el pico |
| `audiomotion-minimal-390-vivo.png` | A ancho de teléfono |
| `mdn-voice-visualizer-1440-vivo.png` | App real de micrófono (MDN), barras desde línea base. Señal débil por el dispositivo sintético, pero es una implementación real |

⚠ Las cinco usan el **gradiente rainbow** por frecuencia. Sirven como referencia de
**forma y movimiento**, no de color.

**La idea aprovechable es el LED de pico sostenido:** es literalmente "reposo con
memoria" — el pico queda un instante y cae. Resuelve el estado de reposo **sin
necesidad de un pulso decorativo**, que es justo lo que buscábamos.

## Capturas nativas — apps reales (`nativas/`)

Bajadas de la ficha de Google Play a resolución completa (1080×1920).

| Archivo | Qué muestra |
|---|---|
| `app-recorder-grabando.png` | **El mejor hallazgo del barrido nativo.** Timer gigante como héroe (`0H 00M 00S`), botón de micrófono circular con halo, y **waveform de ancho completo, simétrico sobre una línea central**, al pie de la pantalla |
| `app-otter-grabando.png` | El timer **en línea, flanqueado por dos mitades de waveform**: `00:14` entre barras espejadas. Arriba, tabs Summary / Transcript / AI Chat — el patrón de nuestras secciones colapsables |
| `app-recorder-prerecord.png` | Estado previo a grabar: "is ready to start" + botón circular. El reposo como pantalla vacía con un solo control |
| `app-recorder-lista.png` | Jerarquía de lista: nombre + duración + formato + peso por fila, **con el ítem activo marcado con el color de acento** |

**Dato convergente:** de los íconos que bajé y descarté, **los cinco eran barras o
waveform**. El motivo barras/waveform es el idioma universal de las apps de
grabación — lo cual valida nuestra elección y a la vez advierte que hay que darle
**tratamiento propio**, porque es el default de todos.

## Estado del hueco

**Cerrado en lo esencial.** Tenemos: forma y movimiento en vivo (`vivo/`),
composición del estado de grabación en producto real (`nativas/`), el estado de
reposo resuelto por evidencia (plano vacío + LED de pico), y los tres motivos
respaldados por captura (barras, anillo, línea).

Lo que **no** hay, y ya no hace falta buscar: un precedente de producto para el
anillo en nuestra dirección — el anillo aparece en `audiomotion-index` (radial) y
en tu `color.png`, pero siempre en otro registro de color. Es una decisión de
diseño nuestra, no una copia.
