---
name: Pitch Coach
description: Práctica de pitch en voz alta, leída como un acta de un solo matiz
colors:
  ground: "#f9f8f6"
  sunken: "#f1f0ed"
  text: "#1a1917"
  text-muted: "#6b6862"
  signal: "#285828"
  signal-peak: "#16301a"
  signal-rest: "#457f42"
  signal-tint: "#dfebd6"
  field: "#1e4022"
  bone: "#f4f3f0"
  attention: "#9e4a38"
  border: "#d6d2c9"
typography:
  display:
    fontFamily: "Alike, serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Alike, serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Alike, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "3px"
  sm: "8px"
  row: "10px"
  md: "12px"
  pill: "999px"
spacing:
  tight: "6px"
  control: "12px"
  gutter: "24px"
  stack: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.bone}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    typography: "{typography.label}"
  button-quiet:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    typography: "{typography.label}"
  button-pill:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    minHeight: "44px"
  panel:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.md}"
    padding: "24px"
  alert:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.attention}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  row-open:
    backgroundColor: "{colors.signal-tint}"
    textColor: "{colors.signal}"
    rounded: "{rounded.row}"
    padding: "11px 14px"
  score-ring:
    textColor: "{colors.signal}"
    width: "148px"
    height: "148px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: Pitch Coach

## Overview

**Creative North Star: "El Acta"**

Pitch Coach se lee como el acta de un examen, no como un tablero de celebración. El papel es hueso, las superficies se hunden un paso, y el único color con voz es un olivo. El anillo geométrico es la medición: en reposo es un arco corto, al hablar crece con la voz, y al llegar el resultado ese mismo arco es el score.

La densidad es la de una hoja, no la de un dashboard. Hasta 1120px, y desde 960px en dos columnas, serif solo en la frase que se recuerda (el veredicto, el nombre del producto, el título de sección) y una sans para todo lo que se lee seguido. La fila que falta en la rúbrica es la única que toma el tinte. El resto de la lista permanece en silencio. Los cuatro tipos de pitch se presentan con el mismo peso; el elegido cambia de tinte, no de importancia.

El mundo anterior queda retirado: lienzo blanco, acento esmeralda, Arial que ganaba a una Geist declarada y no usada, círculo de score de 88px pintado de verde, ámbar o rojo, y una sopa de azul, rojo y amarillo. No se genera ninguna pantalla nueva en ese estilo.

**Key Characteristics:**

- Un solo matiz, olivo, sobre papel hueso
- Profundidad por hundimiento, sin sombra
- El anillo es la señal en vivo y el score asentado
- Alike para la frase; Source Sans 3 para la lectura
- La atención (teja) solo marca conteos y errores, nunca el score
- Foco visible en todo control interactivo

## Colors

Un olivo y un papel cálido. El verde no significa aprobado: el valor del score lo dicen el número y las palabras.

Los valores de abajo son el modo claro (`:root`). El modo oscuro reasigna los mismos roles; no inventa una segunda paleta.

### Primary

- **Olivo de señal** (`{colors.signal}`): el arco asentado, la fila abierta, la línea de sesión y el foco. Es el color que dice "esto es lo que falta mirar".
- **Pico** (`{colors.signal-peak}`): el extremo oscuro del mismo olivo. En claro llena el hover del botón primario. En vivo, el arco llega aquí solo cuando la voz pasa el umbral alto.
- **Reposo** (`{colors.signal-rest}`): el paso medio de la rampa. El arco en silencio y el relleno de la barra de tiempo usan este valor en los dos modos.
- **Tinte** (`{colors.signal-tint}`): el campo de la fila abierta y del tipo de pitch elegido. También el fondo de la muletilla marcada dentro de la transcripción.
- **Campo** (`{colors.field}`): el botón primario. Texto hueso encima.

### Neutral

- **Hueso** (`{colors.ground}`): el lienzo.
- **Hundido** (`{colors.sunken}`): paneles, filas en silencio, chips y el botón quieto.
- **Tinta** (`{colors.text}`): el texto principal.
- **Tinta baja** (`{colors.text-muted}`): comentarios, metadatos y el "/100".
- **Hueso de botón** (`{colors.bone}`): el texto sobre el campo. En oscuro es también el texto principal.
- **Filete** (`{colors.border}`): el borde de paneles, campos y botones quietos.

### Tertiary

- **Teja de atención** (`{colors.attention}`): el conteo de una muletilla y el texto de un error (micrófono, análisis, alerta). No colorea el score ni un punto cumplido.

### Modo oscuro

Misma rampa, invertida en claridad. El reposo no cambia.

| Rol | Claro | Oscuro |
| --- | --- | --- |
| Lienzo | `{colors.ground}` | `#0f0f0e` |
| Hundido | `{colors.sunken}` | `#1a1a18` |
| Tinta | `{colors.text}` | `#f4f3f0` |
| Tinta baja | `{colors.text-muted}` | `#a3a099` |
| Señal | `{colors.signal}` | `#a3c48f` |
| Pico | `{colors.signal-peak}` | `#dfebd6` |
| Reposo | `{colors.signal-rest}` | `{colors.signal-rest}` |
| Tinte | `{colors.signal-tint}` | `#1e4022` |
| Campo | `{colors.field}` | `{colors.field}` |
| Atención | `{colors.attention}` | `#c97c68` |
| Filete | `{colors.border}` | `#35352f` |

`--elevated` existe en la hoja (`#ffffff` en claro, `#242422` en oscuro) y ninguna superficie lo usa. No es un token de producción.

### Named Rules

**The One Hue Rule.** El olivo es la única voz cromática. La teja no es un segundo acento: aparece en un conteo o en un error, y en ningún otro sitio.

**The Rest Step Rule.** El arco en silencio usa el paso de reposo, el mismo en claro y en oscuro. No se apaga a gris.

**The Score Is Not a Color Rule.** Un 64 y un 90 usan el mismo olivo. Lo que cambia es el largo del arco, el número y la frase.

## Typography

**Display Font:** Alike (con serif)
**Body Font:** Source Sans 3 (con sans-serif)

**Character:** Alike es la frase que se recuerda, en peso 400, sin negrita. Source Sans 3 es la voz de trabajo: botones, comentarios, transcripción. No hay mono de marca.

### Hierarchy

- **Display** (400, 2.75rem, interlínea 1): el número del score, con cifras tabulares.
- **Headline** (400, 2rem, interlínea 1.15): el veredicto. El nombre del producto en la práctica usa la misma cara un paso más grande (2.25rem).
- **Title** (400, 1.5rem): títulos de sección en la práctica. En el resultado, los títulos de bloque bajan a 1.25rem, misma cara y mismo peso.
- **Body** (400, 1rem, interlínea 1.6): la transcripción, con medida máxima de 68ch y alto máximo de 14rem. Lo que no cabe se recorre dentro de la caja. El comentario de rúbrica es 0.9rem.
- **Label** (600, 0.875rem): botones y el nombre del punto de rúbrica. La línea de sesión es 0.95rem en Source Sans 3, color señal, no serif.

### Named Rules

**The Face You Load Rule.** La cara que se carga es la que se pinta. Alike y Source Sans 3 entran por `next/font` y el cuerpo las usa. Arial y Geist no son la marca.

**The Serif Is the Sentence Rule.** Alike no se usa para párrafos, botones ni metadatos. Si la frase no cabe en una línea de veredicto o en un título, es Source Sans 3.

## Layout

La hoja llega a `max-width: 1120px`. Desde 960px la práctica se parte en dos: a la izquierda el tipo, la duración y el resumen; a la derecha el grabador, que permanece fijo al desplazar. El resultado hace lo mismo bajo el anillo: la rúbrica a la izquierda, y a la derecha las acciones, la cifra citada, las muletillas y la transcripción. La transcripción no crece con el pitch: se queda en 14rem y el resto se desplaza dentro. Por debajo de 960px todo vuelve a una columna. No hay barra lateral.

Los cuatro tipos pasan a dos columnas desde 640px. La duración es una fila que envuelve. El anillo (148px) se sienta al lado del veredicto.

El ritmo observado es 6px entre filas de rúbrica, 12px de padding vertical en controles, 24px de padding de panel y de margen horizontal, 28px entre bloques del resultado y 32px entre secciones de la práctica.

## Elevation & Depth

No hay sombras. La profundidad es un escalón hacia abajo: el lienzo, y sobre él un panel hundido. La fila abierta no se eleva; se tiñe. El anillo no tiene halo.

### Named Rules

**The Sunken Rule.** Una superficie nueva es hundida o es el propio lienzo. No se levanta con blanco ni con sombra. `--elevated` no se aplica.

**The No Sunken-on-Sunken Rule.** Hundir un panel dentro de otro panel hundido no crea profundidad: son el mismo relleno y solo queda un filete de más. Lo que vive dentro de un panel hundido se disuelve en él (sin fondo ni borde propios, como el grabador dentro de "Resolver hallazgos") o se pinta con el lienzo.

## Shapes

Esquinas cortas y una geometría. El botón es 8px. El panel y la alerta son 12px. La fila de rúbrica es 10px. Las píldoras (idioma activo, escuchar, chip de muletilla, barra de tiempo) cierran a 999px. La marca dentro de la transcripción es 3px.

El anillo es un arco, no un círculo con pista. Trazo de 10 en un viewBox de 120, sin círculo de fondo, arranque a las doce. En reposo el arco es el 14% de la circunferencia. En vivo parte de ese 14% y crece con la amplitud. Asentado, el arco es el score sobre 100: un 64 ocupa el 64%. La opacidad solo se mueve en vivo (de 0.5 a 1). Nunca hay brillo, escala ni segundo trazo.

### Named Rules

**The Open Arc Rule.** No se dibuja la pista circular detrás del arco. Lo que no está medido no se pinta.

## Components

### Buttons

- **Shape:** 8px. La acción de escuchar, dentro del veredicto, es píldora.
- **Primary:** campo con texto hueso, padding 12px 16px, 600, 0.875rem. En claro el hover llena con el pico. En oscuro el pico es claro, así que el hover mantiene el campo y solo el filete pasa a la señal.
- **Hover / Focus:** el foco de todo control es un outline de 2px en la señal, separado 3px. No hay transición de color.
- **Quiet:** hundido, texto de tinta, filete. El hover toma el tinte. Deshabilitado: opacidad 0.6.
- **Pill (acciones de escucha):** radio píldora y 0.85rem, pero **nunca por debajo del objetivo táctil de 44px** — la forma no exime del mínimo. La mecánica la aporta el botón base; la píldora solo cambia la forma. Sobre una tarjeta hundida (los datos sugeridos) se pinta con el lienzo, no con otro hundido: ver la Regla del Hundido.
- **Text (acciones terciarias):** "Tu progreso", "Borrar historial". Se leen como enlace subrayado, pero conservan los 44px de alto para poder tocarse.

### Chips

- **Style:** píldora hundida, 0.85rem, padding 4px 11px. La palabra entre comillas y el conteo al lado.
- **State:** solo lectura. El conteo es teja y peso 700, con cifras tabulares.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** hundido sobre el hueso.
- **Shadow Strategy:** ninguna. Ver Elevation.
- **Border:** 1px del filete.
- **Internal Padding:** 24px.

### Inputs / Fields

- **Style:** el respaldo de texto es un área con fondo de lienzo, filete, radio 12px y padding 12px.
- **Focus:** el outline global de 2px.
- **Error / Disabled:** el error es texto teja, sin caja roja de relleno. El botón deshabilitado baja a opacidad 0.6.

### Navigation

No hay navegación persistente. El idioma es un segmento: la opción activa es campo con texto hueso; la inactiva es tinta baja sobre hundido. El tipo de pitch es una rejilla de botones iguales; el elegido toma tinte y texto de señal. La duración elegida toma campo y texto hueso. Ningún tipo es más grande que otro.

### Signal ring

El mismo componente en la grabación y en el resultado. En la grabación mide 72px y no lleva número. En el resultado mide 148px y el número (display) se centra encima del arco, con "/100" en tinta baja a 0.85rem. Reposo, vivo y asentado son tres modos del mismo trazo.

### Rubric row

Fila horizontal, radio 10px, padding 11px 14px. Una marca de 28px (cuadrado de 8px con un punto) en señal. La primera rúbrica incumplida lleva la clase abierta: fondo tinte, texto de señal, marca sobre el lienzo. Las demás no tienen fondo propio. Cumplido o no no cambia el color del punto.

### Alert

Panel hundido con filete y texto teja, radio 12px, padding 12px 16px. Sirve para el fallo de análisis, de ultra y de sparring.

## Do's and Don'ts

### Do:

- **Do** usar los tokens de `:root` y su reasignación oscura. Un color nuevo tiene que ser un paso de esta rampa o no existe.
- **Do** dejar el foco visible: outline de 2px en la señal, offset de 3px.
- **Do** tratar los cuatro tipos de pitch con la misma forma. La selección es tinte, no jerarquía.
- **Do** marcar la primera rúbrica que falta con el tinte, y dejar las otras en silencio.

### Don't:

- **Don't** revivir el mundo anterior: lienzo blanco, esmeralda, Arial, Geist de marca, círculo de 88px en verde/ámbar/rojo, ni azul, rojo o amarillo de acento.
- **Don't** pintar el score con semáforo. El arco asentado es siempre la señal.
- **Don't** usar un orbe, un brillo, una sombra o una pista circular detrás del anillo.
- **Don't** usar emoji como icono de rúbrica.
- **Don't** poner texto hueso sobre el pico cuando el modo oscuro ha aclarado ese paso.
- **Don't** elevar una superficie. Hundirla, o dejarla en el lienzo.
