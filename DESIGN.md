---
name: Pitch Coach
description: Práctica de pitch hablada con feedback estructurado por rúbrica
colors:
  background: "#ffffff"
  foreground: "#171717"
  background-dark: "#0a0a0a"
  foreground-dark: "#ededed"
  zinc-50: "oklch(98.5% 0 none)"
  zinc-100: "oklch(96.7% 0.001 286.375)"
  zinc-200: "oklch(92% 0.004 286.32)"
  zinc-300: "oklch(87.1% 0.006 286.286)"
  zinc-400: "oklch(70.5% 0.015 286.067)"
  zinc-500: "oklch(55.2% 0.016 285.938)"
  zinc-600: "oklch(44.2% 0.017 285.786)"
  zinc-700: "oklch(37% 0.013 285.805)"
  zinc-800: "oklch(27.4% 0.006 286.033)"
  zinc-900: "oklch(21% 0.006 285.885)"
  accent: "oklch(59.6% 0.145 163.225)"
  accent-hover: "oklch(50.8% 0.118 165.612)"
  accent-fill: "oklch(69.6% 0.17 162.48)"
  score-bar: "#3b82f6"
  filler-count: "#e03131"
  filler-mark: "#ffe066"
  panel-muted: "#fafafa"
  chip-surface: "#f3f4f6"
  quote-rule: "#d0d0d0"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  xs: "3px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  pill: "999px"
spacing:
  xs: "12px"
  sm: "16px"
  md: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "{colors.panel-muted}"
    textColor: "{colors.zinc-700}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.chip-surface}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  score-ring:
    textColor: "{colors.accent}"
    borderRadius: "50%"
    size: "88px"
---

# Design System: Pitch Coach

<!-- Registro del estado PRE-REDISEJO. La fase de UX/UI reemplaza este mundo:
     nada de lo visual de acá se conserva. Existe como evidencia y
     anti-referencia para deliberar el reemplazo — no como on-brand a seguir. -->

## Fuente de verdad del diseño

Este archivo es la **única fuente de verdad formal del sistema visual** de Pitch
Coach. Su contenido hoy describe el **mundo anterior al rediseño** y funciona como
anti-referencia; el bloque YAML de arriba, en particular, **no** es la paleta del
producto.

Reparto de responsabilidades, para no duplicar ni contradecir:

- **`PRODUCT.md`** — capa de producto: usuarios, propósito, compromisos de marca,
  accesibilidad. No contiene tokens.
- **`docs/referencias-ui/`** — **pre-dirección**: capturas, criterios y una paleta
  **propuesta** para decidir el rediseño. No es contrato visual.
- **`DESIGN.md`** (este archivo) — **destino formal** de la dirección aprobada y
  del sistema de tokens. Cuando un valor de `docs/referencias-ui/` se adopte para
  producción, se consolida acá; ante cualquier discrepancia, **manda `DESIGN.md`**.

Estado: el rediseño **todavía no arrancó**. Hasta que sus tokens se aprueben y se
escriban en este documento, el diseño visual del producto se rige por las reglas
de negocio de `alcance.md` (el coach es un indicador de texto, §5.1) y por los
principios de `PRODUCT.md`.

## Overview

**Creative North Star: "El Andamiaje Neutro"**

Este documento captura el sistema visual **anterior al rediseño**. No es una
recomendación ni un destino: es el registro de lo que hay, para que el reemplazo
se decida contra evidencia y no contra un recuerdo. Ninguna de sus decisiones
visuales sobrevive a la fase de UX/UI.

Lo que hay es un andamiaje correcto y sin carácter. El loop del producto
—elegir tipo y duración, grabar, leer el dashboard— se entiende sin esfuerzo,
y eso está bien resuelto. Lo que no existe es un punto de vista: los neutros son
el gris frío por defecto de Tailwind, el acento es el verde esmeralda por
defecto de Tailwind, y los componentes son tarjetas blancas con borde de 1px.
Ninguna decisión fue tomada mirando el producto; se tomaron mirando el
framework.

El problema más concreto no es la falta de ambición sino la **incoherencia**.
El sistema se declara de una manera y se implementa de otra: `layout.tsx` carga
Geist y lo expone como variable, pero el `body` renderiza Arial. El acento
declarado es el esmeralda, y un segundo archivo de estilos —escrito a mano y sin
tokens compartidos— introduce azul, rojo y amarillo por su cuenta. El resultado
es un sistema con **cinco colores de acento** repartidos en dos estilos que no se
hablan entre sí.

**Key Characteristics:**

- Neutros fríos (zinc) sobre tarjetas blancas con borde de 1px
- Un acento declarado (esmeralda) más cuatro hardcodeados (azul, rojo, amarillo)
- Dos sistemas de estilos sin tokens compartidos (utilidades Tailwind + CSS propio)
- Tipografía declarada que no es la que renderiza
- Plano por defecto: `shadow-sm` en dos tarjetas, nada más
- Una sola columna de lectura, 720px

## Colors

Neutros fríos del sistema por defecto de Tailwind, con un acento declarado y
cuatro acentos hardcodeados que conviven sin jerarquía entre ellos.

### Primary

- **Esmeralda de acción** (`oklch(59.6% 0.145 163.225)`): el único acento
  declarado. Botones primarios en fondo pleno con texto blanco, y relleno de la
  barra de tiempo (`oklch(69.6% 0.17 162.48)`). No está justificado en ningún
  lado del código: es la elección por defecto de la paleta de Tailwind.

### Secondary

Cuatro acentos más, todos **hardcodeados** en `src/styles/dashboard-resultado.css`
y por lo tanto invisibles para el sistema declarado:

- **Azul de barra** (`#3b82f6`): el relleno de la barra de tiempo usada vs.
  máxima. Un azul que no se parece al esmeralda en ningún sentido.
- **Rojo de conteo** (`#e03131`): el número de cada muletilla. Compite con el
  esmeralda como si fuera un estado de error, pero no lo es.
- **Amarillo de resaltado** (`#ffe066`): el fondo de las muletillas marcadas
  dentro de la transcripción. Cumple la función de un marcador de texto.
- Clases `red-*` y `amber-*` de Tailwind para errores y un aviso, sin valor
  declarado en tokens.

### Neutral

- **Zinc** (`oklch(98.5% 0 none)` a `oklch(21% 0.006 285.885)`): toda la escala
  de neutros, del fondo de tarjeta elevada al texto principal. Es un gris **frío**
  (matiz 286), que es el valor por defecto de Tailwind.
- **Lienzo** (`#ffffff`) e **tinta** (`#171717`): declarados como `--background`
  y `--foreground`, con variantes oscuras (`#0a0a0a` / `#ededed`) que siguen
  `prefers-color-scheme`. El modo oscuro existe pero no fue diseñado: es la
  inversión automática de dos valores.

### Named Rules

**The Accent Proliferation Rule.** Cinco colores de acento conviven sin jerarquía
declarada. Cada uno se agregó resolviendo el problema local de un componente, y
ninguno se revisó contra los otros. Este es el problema central que el rediseño
corrige.

**The Two-Systems Rule.** El color vive en dos lugares que no comparten tokens:
las utilidades de Tailwind dentro de los componentes, y un CSS escrito a mano
para el dashboard. Un valor definido en uno no existe en el otro.

## Typography

**Display Font:** Arial, Helvetica, sans-serif — lo que efectivamente renderiza
**Body Font:** Arial, Helvetica, sans-serif
**Label/Mono Font:** Geist Mono (declarado, sin uso visible)

**Character:** Sin carácter. Es la fuente del sistema, sin decisión tipográfica
detrás. No hay contraste entre display y texto: la jerarquía se hace solo con
tamaño y peso.

### Hierarchy

- **Display** (700, 1.75rem): el número del score dentro del anillo. El tamaño
  más grande del producto y su único momento de énfasis real.
- **Title** (400, 1.05rem): el veredicto del coach.
- **Body** (400, 0.95rem, interlínea 1.6): descripciones de rúbrica y
  transcripción. La transcripción usa `white-space: pre-wrap` sin medida máxima
  dentro de la columna de 720px.
- **Label** (600, 0.85rem): títulos de sección de la rúbrica, nombre del punto.
- **Caption** (400, 0.8rem, con `opacity` 0.6–0.75 en lugar de un color de
  token): metadatos, fechas, tiempos secundarios.

### Named Rules

**The Declared-But-Unused Rule.** `layout.tsx` carga Geist Sans y Geist Mono con
`next/font` y las expone como `--font-geist-sans` / `--font-geist-mono`. `body`
declara `font-family: Arial, Helvetica, sans-serif` y gana. La tipografía
declarada nunca llega a la pantalla.

**The Opacity-Instead-Of-Color Rule.** La jerarquía secundaria se logra con
`opacity` (0.6, 0.75, 0.8) sobre el color de texto heredado, en lugar de un token
de color secundario. Es frágil sobre fondos que no sean blanco puro.

## Layout

Una sola columna de lectura. El dashboard usa `max-width: 720px` con
`display: flex; flex-direction: column; gap: 1.5rem`.

Las tarjetas son contenedores con `padding: 24px` y `gap: 24px` entre secciones
internas. El ancho de 720px no cambia entre breakpoints: la columna se angosta
con el viewport pero no se reorganiza en varias columnas.

El espaciado sale de la escala por defecto de Tailwind (base 4px), aplicada por
utilidad: `p-3` (12px), `p-4` (16px), `p-6` (24px). No hay ritmo vertical
declarado ni token de espaciado propio.

## Elevation & Depth

**Plano por defecto.** No hay sistema de elevación. La profundidad se comunica
con un borde de 1px (`zinc-200`) sobre fondo blanco, que separa la tarjeta del
lienzo sin usar sombra.

### Shadow Vocabulary

- **`shadow-sm`** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): la única sombra del
  sistema, aplicada a dos tarjetas del dashboard. Es el valor por defecto de
  Tailwind, no una decisión.

### Named Rules

**The Flat-At-Rest Rule.** Las superficies son planas. La elevación no
existe como vocabulario: cuando algo tiene sombra, es porque se copió una clase
por defecto, no porque haya una jerarquía detrás.

## Shapes

El lenguaje de forma es de esquinas redondeadas por utilidad, sin sistema:
`rounded-lg` (8px, 12 usos), `rounded-xl` (12px, 7 usos), `rounded-full` (6 usos)
y `rounded-2xl` (16px, 2 usos). En el CSS propio aparecen además 999px para
píldoras, 8px y 3px.

No hay criterio que explique cuál radio va dónde: la tarjeta principal usa
`rounded-2xl`, la secundaria `rounded-xl`, y los botones `rounded-lg`. El mismo
tipo de elemento puede llevar radios distintos en pantallas distintas.

**Ausencia de recorte y de geometría recurrente.** No hay `overflow: hidden` con
propósito, ni silueta propia del producto. La única forma que se repite con
intención es el **círculo del score**.

## Components

### Buttons

- **Shape:** `rounded-lg` (8px) para acciones primarias; píldoras de 999px para
  acciones secundarias dentro del dashboard.
- **Primary:** fondo esmeralda pleno (`oklch(59.6% 0.145 163.225)`), texto blanco,
  padding 12px 16px, 600, 0.85rem. Sin borde ni sombra.
- **Hover / Focus:** `hover:bg-emerald-700`. **No hay estado de foco declarado**
  en ningún componente: no aparece una sola clase `focus-*` en el código.
- **Secondary / Ghost:** borde de 1px, fondo `#fafafa` o `#ffffff`, texto
  `zinc-700`. Se usa para "Escuchar veredicto", "Escuchar pregunta" y descargar
  el guion.

### Chips

- **Style:** píldora de 999px con fondo `#f3f4f6`, padding 4px 11px, 0.85rem.
  Cada chip lleva una palabra de relleno y su conteo.
- **State:** el conteo va en rojo (`#e03131`) y en negrita. No hay estado
  seleccionado: son solo lectura.

### Cards / Containers

- **Corner Style:** `rounded-2xl` (16px) en las tarjetas principales,
  `rounded-xl` (12px) en las secundarias. Inconsistente por uso.
- **Background:** `#ffffff` sobre lienzo `#ffffff`; se distinguen solo por el borde.
- **Shadow Strategy:** ver Elevation — `shadow-sm` en dos casos, nada más.
- **Border:** 1px `zinc-200` (`oklch(92% 0.004 286.32)`).
- **Internal Padding:** 24px (`p-6`).

### Inputs / Fields

- **Style:** el campo de texto de respaldo es un `textarea` con borde `zinc-200`,
  `rounded-xl`, fondo `zinc-50`, texto `zinc-800`.
- **Focus:** **sin tratamiento declarado.** Es la ausencia más seria del sistema
  desde accesibilidad.
- **Disabled:** `opacity: 0.6` y `cursor: default`, en los botones del dashboard.

### Navigation

No hay navegación persistente. La "navegación" son tres selectores en la home
—idioma, tipo de pitch, duración— y un par de pestañas/segmentos en el
dashboard. Los selectores usan el mismo patrón de tarjeta con borde 1px.

### Score Ring

El componente con más carácter del sistema, y el único que sobrevive
conceptualmente al rediseño como referencia formal: un círculo de **88px** con
`border: 4px solid` en el color del acento, número a 1.75rem/700 y un "/100"
a 0.8rem con `opacity: 0.6`. Es el ancla visual del dashboard y el punto donde
el producto se ve a sí mismo como una medición.

### Filler Highlight

Las muletillas dentro de la transcripción se marcan con un `mark` de fondo
`#ffe066`, padding 0 2px y radio 3px — el patrón de un resaltador. Es el único
lugar del sistema donde el color es *evidencia* en vez de decoración.

## Do's and Don'ts

Guardarraíles confirmados con el usuario antes de reemplazar este mundo. Las
prohibiciones rigen para el rediseño; no describen el sistema actual.

### Do:

- **Do** tratar este documento como **anti-referencia**. Sirve para deliberar el
  reemplazo con evidencia, no para generar pantallas nuevas en este estilo.
- **Do** preservar los hechos de producto que el rediseño hereda: el loop
  elegir → grabar → dashboard, los cuatro tipos de pitch, los ids de rúbrica como
  contrato, y el contrato bilingüe.
- **Do** mirar el Score Ring como referencia **formal** —un anillo de medición
  como ancla— sin heredar su color, su tipografía ni su ejecución.

### Don't:

- **Don't** reproducir el cliché de IA: morado o índigo con glow, esfera u orbe
  brillante, degradados luminosos.
- **Don't** repetir el andamiaje gris: correcto pero anodino, sin jerarquía ni
  punto de vista. El rediseño no puede terminar siendo un formulario prolijo.
- **Don't** repetir la sopa de acentos: cinco colores compitiendo sin jerarquía.
  Un solo portador de color.
- **Don't** usar degradados brillantes: pastel luminoso, neón, corona rainbow.
- **Don't** declarar una fuente y renderizar otra. La tipografía que se carga es
  la que se usa.
- **Don't** dejar componentes sin estado de foco visible.
