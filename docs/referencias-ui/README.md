# Referencias de diseño — Pitch Coach

Carpeta de trabajo para la fase de UX/UI, **fuera del repo** para no ensuciar git.
Acá van las capturas que vayas juntando a mano; las que ya están sembradas vienen
de inspo/awwwards (MCP, 2026-10-02) y fueron **verificadas visualmente**, no solo
por metadata.

## Cómo agregar referencias

Lo que más ayuda: **nombre de archivo con el producto** (`linear-inbox.png`,
`granola-recording.png`) y, si se puede, **una línea de qué te gustó de esa
captura**. Desde los píxeles se puede describir lo que hay, pero no siempre se
sabe qué *elemento* te llamó la atención — y eso es lo que hace falta para curar
contra la dirección del proyecto.

## Criterio de validación

El criterio real de seriedad, medido en las capturas del núcleo (Tana, Harvard,
Lucid, Railway), **no es el matiz elegido sino la disciplina**:

1. **Un solo portador de color por cuadro.** Tana: negro + un verde. Harvard:
   vino + blanco. Lucid: foto + tan + blanco.
2. **Muy pocos radios de borde.** Wealthsimple usa exactamente dos en toda la
   página (`0px` y `12px`).
3. **Ritmo de espaciado generoso:** 80–160px entre secciones (mediana medida:
   96px). Por debajo de ~64px dos secciones leen como un bloque apretado.
4. **El hero cabe en el primer viewport** (~1280×800). El desborde bajo el
   pliegue es el fallo más común de páginas generadas por IA.

**Test rápido:** ¿la paleta sobrevive a ser el único color del cuadro?

## Paleta propuesta — olivo, un solo matiz

Diseñada con la **animación como restricción de primera clase**. El indicador en
vivo necesita un matiz con rango utilizable en los dos modos, y todo lo demás
tiene que ser incoloro — porque "en vivo" solo se lee como vivo si es lo único
con color en la pantalla.

Base: el olivo `#285828` extraído de `color.png`. Se extendió a una rampa de once
pasos y se verificó cada uno contra los dos fondos.

### La rampa — un matiz cubre ambos modos

| Paso | Sobre claro `#F9F8F6` | Sobre oscuro `#0F0F0E` |
|---|---|---|
| 950 `#16301A` | 13.44:1 AA | 1.34:1 |
| 900 `#1E4022` | 10.92:1 AA | 1.65:1 |
| 800 `#285828` ← tu elección | 7.86:1 AA | 2.30:1 |
| 700 `#356B34` | 5.99:1 AA | 3.02:1 gráfico |
| 600 `#457F42` ← **pivote / reposo** | 4.53:1 AA | 3.99:1 gráfico |
| 500 `#5C9655` | 3.33:1 gráfico | 5.43:1 AA |
| 400 `#7FA86B` | 2.56:1 | 7.05:1 AA |
| 300 `#A3C48F` | 1.82:1 | 9.91:1 AA |
| 200 `#C2DAB4` | 1.42:1 | 12.77:1 AA |
| 100 `#DFEBD6` | 1.16:1 | 15.52:1 AA |
| 50 `#F0F5EB` | 1.04:1 | 17.32:1 AA |

El cruce cae entre 600 y 500, y **el paso 600 pasa el umbral de gráfico en los
dos fondos** (4.53 claro / 3.99 oscuro). Ese es el pivote de todo el sistema.

Esto es lo que el olivo compra y el burdeos no: cuando aclarás el vino para que
funcione en oscuro se vuelve un rosa empolvado — *otro color*. El olivo aclarado
sigue siendo olivo, solo se vuelve salvia. **Un matiz, identidad estable en los
dos modos.**

### Tokens

**Claro** — fondo `#F9F8F6` · superficie `#F1F0ED` · elevada `#FFFFFF`

| Token | Valor | Contraste |
|---|---|---|
| `text` | `#1A1917` | 16.55:1 sobre fondo · 17.57:1 sobre elevada |
| `text-muted` | `#6B6862` | 5.23:1 |
| `text-subtle` | `#726E67` | 4.78:1 |
| `signal` | `#285828` | 7.86:1 · 8.34:1 sobre elevada |
| `signal-peak` | `#16301A` | 13.44:1 |
| `signal-rest` | `#457F42` | 4.53:1 |
| `signal-tint` | `#DFEBD6` | fila activa, ver abajo |
| `field` | `#1E4022` | campo olivo, texto bone 10.92:1 |
| `attention` | `#9E4A38` | 5.67:1 — solo hallazgos, nunca el score |
| `border` | `#D6D2C9` | 1.42:1 |
| `border-strong` | `#CCC8BF` | 1.57:1 |

**Oscuro** — fondo `#0F0F0E` · superficie `#1A1A18` · elevada `#242422`

| Token | Valor | Contraste |
|---|---|---|
| `text` | `#F4F3F0` | 17.28:1 sobre fondo |
| `text-muted` | `#A3A099` | 7.35:1 |
| `text-subtle` | `#807D76` | 4.67:1 |
| `signal` | `#A3C48F` | 9.91:1 · 9.01:1 sobre superficie |
| `signal-peak` | `#DFEBD6` | 15.52:1 |
| `signal-rest` | `#457F42` | 3.99:1 |
| `signal-tint` | `#1E4022` | fila activa |
| `field` | `#1E4022` | campo olivo, texto bone 10.45:1 |
| `attention` | `#C97C68` | 6.00:1 |
| `border` | `#35352F` | 1.55:1 |
| `border-strong` | `#454540` | 1.99:1 |

Nota: `border` está deliberadamente bajo (1.4-1.6:1). Un borde no es texto; por
debajo de ~1.3:1 deja de verse. Los valores probados acá se ven sin gritar.

### Fila activa (patrón tomado de `layout.png`)

Tu `layout.png` ya lo resolvía bien: icono sobre tinte del mismo matiz. Verificado:

- Claro: `signal` `#285828` sobre `signal-tint` `#DFEBD6` → **6.75:1 AA**
- Oscuro: `signal` `#A3C48F` sobre `signal-tint` `#1E4022` → **5.99:1 AA**

Es el patrón para la sección abierta de un acordeón de rúbrica.

## La animación — reglas que la paleta tiene que sostener

### 1. Un matiz, y el reposo es 600 en ambos modos

El indicador **nunca introduce un segundo color**. La animación mueve *un paso de
la misma rampa*, y se aleja de 600 según la polaridad del modo:

| | reposo (sin audio) | en vivo | pico |
|---|---|---|---|
| Claro | `#457F42` 4.53:1 | `#285828` 7.86:1 | `#16301A` 13.44:1 |
| Oscuro | `#457F42` 3.99:1 | `#A3C48F` 9.91:1 | `#DFEBD6` 15.52:1 |

En claro la señal **se oscurece** al subir la amplitud; en oscuro **se aclara**.
Es contraintuitivo pero es lo correcto: cada modo se aleja de su fondo. Y como el
reposo es el mismo `#457F42` en los dos, el comportamiento se describe una vez.

### 2. Sin brillo, sin degradado

El look de IA que estamos evitando viene de *material* + *brillo*. La regla:
**la animación varía altura y opacidad, nunca luminiscencia.** Si hace falta un
rastro de decaimiento, es el mismo `signal` a ~40% de opacidad — no un glow.

### 3. Los motivos salen de tu propia referencia

`color.png` ya contiene los tres, usados como lenguaje de datos:

- **Barras** — el gráfico "Order volume" *es* un ecualizador: barras delgadas
  sobre línea base punteada. El paso más corto. La línea base usa `border`, **no**
  `signal`, para que el matiz quede exclusivo del elemento vivo.
- **Anillo** — el de "Registrations" (`73.37K`). Un anillo que se segmenta o
  engrosa con el audio es la mejor respuesta anti-orbe: geométrico, no una esfera,
  y ya justificado por el sistema del producto.
- **Línea de señal** — la de "NPS", con relleno de área. Mismo motivo que el
  precedente de Wealthsimple.

Un polígono en **wireframe** también sirve, pero solo si es estructural: contorno
plano, vértices movidos por bandas de frecuencia, un color, sin sombreado. Un
poliedro brillante devuelve al cliché — es el primo de la esfera, no su alternativa.

### 4. Continuidad grabación → resultado

La versión más fuerte: **el indicador en vivo se convierte en el score.** Mientras
grabás, las barras o el anillo responden al micrófono; al terminar, ese mismo
elemento se asienta y pasa a ser la visualización del score. Sin corte ni pantalla
nueva — y sirve directo a la jerarquía de "score grande e inmediato", porque el
elemento que estaba vivo *es* el veredicto.

El panel del score es `field` `#1E4022` con texto bone (10.92:1 claro / 10.45:1
oscuro): el mismo panel funciona en los dos modos con el mismo color de texto.

### 5. El verde no puede significar "aprobado"

El verde en UI lee *éxito*. Si el verde es el portador del color, un score de 3/10
igual lee "bien" — el mismo problema que tenía el rojo, espejado (ahí un score bajo
leía "error"). **El color es identidad y estructura; la valencia del score se
comunica por otra vía**: peso y tamaño tipográfico, posición, y una etiqueta
explícita ("Fuerte" / "A mejorar") con un punto, no un baño de color.

`attention` queda reservado para hallazgos concretos y estados de error (permiso de
micrófono denegado) — nunca para el score.

### 6. Secundario opcional — solo si hay dos series

Si un gráfico necesita dos series distinguibles (ej. esta sesión vs. la anterior):

- **Preferido:** dos pasos de la misma rampa (`signal` + `signal-peak`). Conserva
  la disciplina de un solo portador.
- **Si hace falta un matiz distinto:** slate `#46586B` en claro (6.90:1) y
  `#7E8FA3` en oscuro (5.79:1). Subordinado y desaturado a propósito: no compite
  con el olivo.

No agregar un tercer matiz.

## Contrastes verificados (WCAG, calculados)

> La tabla siguiente es la exploración previa (burdeos vs. azul marino). Se
> conserva porque documenta *por qué* se descartaron: ningún vino ni ningún navy
> funciona como acento sobre fondo oscuro, y el olivo sí sobrevive el aclarado.

`>= 4.5:1` texto normal · `>= 3:1` solo display grande

| Color | sobre near-black `#0E0B0C` | sobre bone `#FAF7F2` |
|---|---|---|
| Burdeos `#6E1D2E` | **1.75:1 — falla** | **10.46:1 — AA** |
| Burdeos profundo `#5C1A2B` | 1.53:1 — falla | 12.00:1 — AA |
| Crimson Harvard `#A4293A` | 2.76:1 — falla | 6.65:1 — AA |
| Wine Harvard `#681521` | 1.60:1 — falla | 11.44:1 — AA |
| Navy `#1B2A4A` | **1.38:1 — falla** | **13.31:1 — AA** |
| Navy sobre navy `#152853` | **1.00:1 — invisible** | 13.46:1 — AA |
| Vino oxidado `#B8637A` | 4.76:1 — AA | 3.85:1 — display |
| Rosa pulverizado `#C9808C` | 6.48:1 — AA | 2.83:1 — falla |
| bone `#FAF7F2` sobre burdeos `#6E1D2E` | — | **10.46:1** (burdeos como campo) |

### Las tres conclusiones que salen de esa tabla

1. **Ningún vino ni ningún navy funciona como acento chico sobre fondo oscuro.**
   Falla por luminancia, no por gusto. Es física, no estética.
2. **Harvard usa el vino como *campo*, no como acento** — y esa es la única
   forma en que el vino funciona en oscuro. Bone sobre `#6E1D2E` = 10.46:1.
3. **En fondos oscuros estás obligado a aclarar el acento**, y aclarar empuja
   cualquier matiz saturado hacia el pastel — que es exactamente la lavanda del
   cliché de IA (el acento de Railway es `#b4a4d5`, un violeta *claro*). El look
   "IA" es en parte un movimiento forzado por el contraste. Saberlo permite
   desafiarlo en vez de sufrirlo.

## Referencias sembradas → qué tomar de cada una

| Captura | Qué tomar exactamente |
|---|---|
| `03-tipografia/railway-com-tipografia.png` | El sistema tipográfico: IBM Plex Serif con tracking negativo fuerte (−1.96px a 54px) sobre sans de cuerpo con interlínea amplia (1.63), en fondo oscuro. **Descartar el violeta del botón.** |
| `02-color/harvard-edu.png` | La prueba de que el vino lee como gravedad institucional, no como estridencia — y de que va como **campo** con tipo claro encima. |
| `03-tipografia/tana-inc.png` | La disciplina: negro puro, `Source Serif 4` grande, y **un solo elemento de color** en todo el viewport. Modelo para "score y veredicto grandes e inmediatos". |
| `04-jerarquia-resultado/lucidmotors-com.png` | La franja de métricas: **versalita chica + valor grande + regla vertical fina**, en fila. Es la jerarquía para el score. |
| `01-visualizador-audio/wealthsimple-com.png` | **Línea de señal** blanca de ancho completo que enhebra tarjetas, terminando en un pico agudo. Mejor precedente formal del enfoque "línea tipo mercado". |
| `03-tipografia/moshimoshimusic-com.png` | Serif (`Libre Baskerville`) en tamaño chico con función de **etiqueta**, sobre grilla. Recurso para secciones colapsables. |
| `02-color/copilot-money.png` | **Contra-referencia.** Es fintech, oscuro y con bento — cumple los criterios y así todo lee lúdico. Advertencia de qué pasa cuando el color decorativo entra sin disciplina. |
| `03-tipografia/furoweb-eu.png` | `Instrument Serif` en oscuro, registro cálido. |
| `03-tipografia/danielsun-space.png` | `LT Superior Serif` en oscuro, registro cálido. |
| `04-jerarquia-resultado/basement-studio.png` | Oscuro extremo y art-directed; útil como techo de contención, registro demasiado "estudio creativo" para nosotros. |
| `color.png` **(agregada por el usuario)** | El set principal. Fondo `#f8f8f8` y tarjetas `#f0f0f0` (nota: la tarjeta es *más oscura* que el fondo — superficie hundida, no elevada). Datos en olivo `#285828` + navy `#284078` + lavanda `#a0b0f0`. Contiene los tres motivos de animación: barras-ecualizador, anillo y línea de señal. De acá sale la rampa de la paleta. |
| `layout.png` **(agregada por el usuario)** | El patrón de fila: icono sobre tinte del mismo matiz + título + badge mono + descripción. Y el estado seleccionado resuelto con tinte + texto del mismo matiz (verificado AA). Es el modelo para las filas de rúbrica y para la sección abierta del acordeón. |

## Registro de descartes y correcciones

Aplicado el 2026-10-02 sobre el lote completo, para dejar un punto limpio. Se
borran los archivos pero **se conserva la decisión**.

### Imágenes descartadas (13)

**Landings sin visualizador vivo (9).** Se capturaron pero no muestran UI de
grabación, así que no aportan: `howlerjs-1280-inicio`, `descript-1280-inicio`,
`descript-390-inicio`, `riverside-1280-inicio`, `riverside-390-inicio`,
`podcastle-1280-inicio`, `adobe-podcast-1280-inicio`, `tldv-1280-inicio`,
`tldv-390-inicio`.

**Duplicados exactos al sembrar la carpeta (4).** Ahora hay una sola copia por
imagen:

- `02-color/wealthsimple-senal.png` → queda `01-visualizador-audio/wealthsimple-com.png`
- `02-color/lucidmotors-com.png` → queda `04-jerarquia-resultado/lucidmotors-com.png`
- `04-jerarquia-resultado/copilot-money.png` → queda `02-color/copilot-money.png`
- `02-color/railway-com.png` → queda `03-tipografia/railway-com-tipografia.png`

### Movidas

`otter-1280-transcribiendo.png` y `fireflies-1280-transcribiendo.png` →
`04-jerarquia-resultado/`. Son pantallas de transcripción, no de visualizador.

### Correcciones aplicadas

1. **`zencastr` estaba mal clasificado.** Figuraba como `anillo/medidor` con un
   "aro rojo de grabación". Verificado: es una **landing de marketing con un
   mockup de teléfono**, y el "aro" es un **botón de grabación circular**. El
   motivo anillo **no tiene precedente de producto** en el lote — es una
   extrapolación desde `color.png`, y conviene saberlo.
2. **Gradiente rainbow de `audiomotion`.** Las tres capturas usan el mismo
   gradiente por frecuencia (rojo→azul). Se marcó como contra-ejemplo solo la
   radial; **aplica a la familia entera**.
3. **`FICHAS.md`** tenía tabla sin encabezado (5 columnas sin etiquetar) y estaba
   duplicado byte a byte. Rehecho con encabezados, una sola copia, en
   `01-visualizador-audio/`.
4. **Afirmación no verificada retirada:** que el botón Record de `wavesurfer`
   quedaba deshabilitado.
5. **Copia canónica:** se eliminó una referencia a `/workspace/` que apuntaba a un
   entorno inexistente. La canónica es esta carpeta.
6. **Ancho:** las capturas nuevas son de **1280px**, no 1440px como pedía el
   prompt. Defendible (la guía medida del propio archivo es "primer viewport
   ~1280×800"), pero **no son comparables 1:1** con las de inspo, que son 1440.

## Visualizador de audio

Estado: **cerrado en lo esencial.** Ver `01-visualizador-audio/FICHAS.md` para el
detalle por captura, incluidas las dos tandas propias (`vivo/` y `nativas/`).

`01-visualizador-audio/` tiene 12 capturas, pero de las 22 que se barrieron, **11
eran landings de producto sin visualizador vivo**. El material utilizable vino de
**demos de librería** (`wavesurfer`, `peaksjs`, `audiomotion`) y de un mockup
(`zencastr`) — no de UI de producto en vivo.

**El aprendizaje que importa: las landings públicas de productos de grabación no
exponen su visualizador.** Tampoco lo cubren las fuentes MCP — inspo devuelve
sitios de *marcas* de audio (SoundCloud, Dolby, Epidemic Sound, ElevenLabs) y
awwwards devolvió un sitio.

Eso se resolvió con dos barridos propios: **estados en vivo** capturados con
Chromium y micrófono sintético (`vivo/`), y **capturas nativas** de apps reales
desde la ficha de Google Play a 1080px (`nativas/`).

Lo que sí quedó resuelto de esta categoría, verificado mirando las imágenes:

- **El estado de reposo es un plano vacío**, no un pulso de espera
  (`audiomotion` activo vs. sin-audio).
- **El panel de onda vacío + "Press Record"** de `wavesurfer` es el estado previo
  al permiso de micrófono, que es específicamente web y ninguna captura nativa
  enseña.
- **Barras que son indicador y control a la vez** (los 9 faders de `wavesurfer`).
- **El LED de pico sostenido** (`audiomotion-minimal`): el pico queda un instante
  y cae. Es "reposo con memoria" — resuelve el estado de reposo sin pulso
  decorativo.
- **La composición nativa del estado grabando** (`app-recorder-grabando`): timer
  gigante como héroe, botón circular con halo, waveform de ancho completo al pie.
- **El timer en línea entre dos mitades de waveform** (`app-otter-grabando`), con
  tabs Summary / Transcript / AI Chat arriba — el patrón de nuestras secciones.
- **Convergencia de motivo:** los cinco íconos de apps de grabación que bajé y
  descarté eran **todos** barras o waveform. Es el idioma universal de la
  categoría, y por eso mismo necesita tratamiento propio para no ser el default.

## Fuentes

- inspo — `https://inspomcp.dev/api/mcp` · DESIGN.md por sitio en
  `https://inspomcp.dev/d/<slug>/DESIGN.md`
- awwwards — `npx -y awwwards-mcp`
- Capturas originales `hero.1440.webp` en
  `https://0nme3pk5am3urwa9.public.blob.vercel-storage.com/captures/<slug>/`
  (también `full.1440`, `mobile.384`)
