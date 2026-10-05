# Pitch Coach — mejoras UX/UI

Revisión del **5 oct 2026** (America/Guatemala), sobre el árbol local en
`/home/focampo/Proyectos/pitch-coach`, HEAD `48519996` (`feat(ui): propuesta de
valor en masthead y pie con atribución`). Incluye los cambios **sin commitear**
del mismo día en `src/components/DashboardResultado.tsx` y
`src/styles/dashboard-resultado.css`.

**No se modificó nada del proyecto en este pase.** Solo hubo lecturas, un
cálculo local de contraste WCAG 2.x sobre los tokens y una búsqueda web sobre
Emergent. No se levantó el dev server, no se hizo commit y no se desplegó nada.

## 1. Veredicto

El diseño **no necesita una revisión de estilo**. El sistema «El Acta» es
coherente, disciplinado y está por encima de la media: tokens reales, modo
oscuro por reasignación de roles, contraste de texto que pasa AA en ambos modos,
objetivos táctiles de 44 px forzados en CSS, manejo de foco y anuncios de
`aria-live`. El trabajo pendiente es de **acabado**, no de dirección, y se
concentra en tres cosas: **deriva entre `DESIGN.md` y el código**, **semántica de
accesibilidad en los selectores** y **legibilidad de los filetes**.

Sobre los 10 créditos de Emergent: **no sirven para mejorar esta app** (§7).

## 2. Alcance y método

Leído en este pase:

- `DESIGN.md`, `docs/README.md`, `PRODUCT.md` (contexto).
- `src/app/globals.css`, `src/styles/dashboard-resultado.css` (tokens y estilos).
- `src/app/page.tsx`, `src/app/layout.tsx`.
- `src/components/DashboardResultado.tsx`, `GrabadorVoz.tsx`, `AnilloSenal.tsx`,
  `SelectorTipoPitch.tsx`, `PiePagina.tsx`.
- `git log` de `DESIGN.md` y `DashboardResultado.tsx`; mtimes de los archivos.

Verificado de forma reproducible:

- Contraste WCAG de 23 pares de tokens (claro y oscuro) con un script local
  (fórmula de luminancia relativa). Resultados en §5.
- Semántica ARIA de los selectores por inspección (`grep` de `aria-pressed`,
  `role`, `aria-checked`).
- Presencia del fallback de TTS por inspección de `ReproductorVeredicto.tsx`.

**No cubierto por este pase:** no se levantó la app ni se probó con lector de
pantalla real, ni con un audit automático (axe/Lighthouse). No se verificó
rendimiento, ni comportamiento en dispositivos físicos.

## 3. Lo que ya está bien (no tocar)

Verificado en el código, no asumido:

- **Contraste de texto: pasa AA en ambos modos en todos los pares medidos.** Los
  16 pares de texto dieron ≥ 4.87:1 (la mayoría AAA). El anillo de foco `2px` en
  señal da **7.86:1** en claro y **9.91:1** en oscuro.
- **Tokens de verdad:** no hay hex sueltos en los componentes; el modo oscuro
  reasigna roles, no invierte la paleta. La regla «The One Hue Rule» se respeta:
  el olivo es el único matiz y la teja solo aparece en conteos y errores.
- **Objetivos táctiles de 44 px forzados en CSS** con la norma citada
  (`src/app/globals.css:92`), incluso en las píldoras de transporte
  (`.pc-transporte-btn`, `min-width/min-height: 44px`).
- **Manejo de foco y anuncios:** `role="status"` / `role="alert"`, `aria-live`
  para el mensaje del coach (`GrabadorVoz.tsx:463`), y `scrollIntoView` al llegar
  el resultado y el análisis Ultra que **respeta `prefers-reduced-motion`**
  (`DashboardResultado.tsx:471-492`).
- **La caja de transcripción con scroll** lleva `role="region"` +
  `aria-labelledby` + `tabIndex=0` con el porqué comentado
  (`DashboardResultado.tsx:737-749`): es enfocable con teclado y tiene nombre.
- **Tipografías por `next/font`** (la cara que se carga es la que se usa,
  `layout.tsx:12-21`), y las transiciones se desactivan con movimiento reducido
  (`globals.css:203-208`, `dashboard-resultado.css:331-336`).

Es un sistema con criterio. El trabajo pendiente es de acabado.

## 4. Hallazgos priorizados

### P1 — Deriva entre documentación y código (dos instancias)

`CLAUDE.md` declara que `DESIGN.md` es «fuente de verdad del diseño», y
`docs/README.md:7-11` insiste: «Ante cualquier discrepancia visual, manda
`DESIGN.md`». Pero el doc contradice al código en la fila de rúbrica:

- `DESIGN.md:273` — «**La primera rúbrica incumplida** lleva la clase abierta:
  fondo tinte… **Cumplido o no no cambia el color del punto.**»
- `DESIGN.md:286` — Do: «marcar la primera rúbrica que **falta** con el tinte».

El código hace lo contrario:

- `dashboard-resultado.css:184` — `.pc-rubrica-item.cumplido { background: var(--signal-tint) }`
- `dashboard-resultado.css:198-201` — la marca **sí** cambia a `--field`/`--bone`
  cuando está cumplida.
- `DashboardResultado.tsx:93-110` — check para cumplido, punto para pendiente.

Los mtimes lo confirman: `DESIGN.md` es del 02-oct; la fila «cumplido» viene del
commit `fc6f081` (`feat(resultado): mark covered rubric points`, 04-oct) y de las
ediciones sin commitear de hoy (`dashboard-resultado.css` y
`DashboardResultado.tsx`, 05-oct 09:01).

**Riesgo:** un agente futuro que siga `CLAUDE.md` al pie de la letra va a
«corregir» el código para que coincida con el doc, y borrará la feature de puntos
cumplidos. Es la misma trampa que `CLAUDE.md` advierte con el inglés.

**Segunda instancia:** `docs/README.md:36` describe `DESIGN.md` como «(hoy
pre-rediseño, anti-referencia)», mientras las líneas 7-11 del **mismo archivo** lo
declaran el «único destino formal del sistema visual». Se contradice consigo
mismo: el doc ya describe «El Acta» y dice que «el mundo anterior queda retirado».

**Acción recomendada:** el cambio de código es *mejor* que lo documentado — el
estado se lee por **forma** (check vs. punto), no solo por color, que es lo que
exige la propia regla `color-not-only`. Por eso: actualizar `DESIGN.md`
(§Components → *Rubric row* + una Named Rule «The Covered Mark Rule») y corregir
`docs/README.md:36`. Alternativa: revertir el código. Que dejen de contradecirse.

### P1 — Los selectores son single-select anunciados como toggles

`SelectorTipoPitch.tsx:37`, `SelectorDuracion.tsx:28` y `SelectorIdioma.tsx:38`
usan `aria-pressed` sobre botones independientes. Para una elección mutuamente
excluyente, el contrato correcto es `role="radiogroup"` + `role="radio"` con
`aria-checked` (o inputs nativos). Hoy:

- El lector de pantalla dice «pulsado / no pulsado» en vez de «3 de 4,
  seleccionado».
- **No hay navegación con flechas** dentro del grupo (solo Tab).

Es categoría CRITICAL en la guía UX (`keyboard-nav`, `nav-label-icon`). El
arreglo es local y no cambia el aspecto.

### P2 — El filete es lo único que delimita los paneles, y es casi invisible

- `--border` contra su superficie = **1.42:1** en claro y **1.55:1** en oscuro.
  WCAG 1.4.11 pide 3:1 para límites que identifican componentes.
- El escalón «hundido» es apenas perceptible: `ground #f9f8f6` vs.
  `sunken #f1f0ed` ≈ **1.1:1**.

La profundidad del sistema («por hundimiento, sin sombra») descansa entonces
sobre un filete de 1.42:1. Es una decisión deliberada, pero el hundimiento es
demasiado sutil para cargar solo. Opciones: subir el filete a ~3:1, o ampliar el
delta ground/sunken. No rompe el «Acta».

### P2 — Textarea sin nombre accesible

`GrabadorVoz.tsx:517-524`: el `<textarea>` del respaldo tiene `placeholder` y un
`<p>` de ayuda encima, pero **nada asociado programáticamente** (ni `<label>`, ni
`aria-label`, ni `aria-describedby`). El placeholder no es etiqueta. Arreglo de
una línea.

### P2 — La voz del veredicto degrada a SpeechSynthesis

`ReproductorVeredicto.tsx:88-118` cae a `window.speechSynthesis` cuando ElevenLabs
falla. Según verificación previa, `/api/tts` da 402 en el free tier, así que el
fallback es lo que suena. Es **el mayor riesgo de calidad percibida de la UI**: el
producto promete «veredicto hablado» y una voz robótica del navegador pesa más en
la percepción que cualquier contraste de borde. La decisión de dejarlo está
tomada; se anota como el primer sitio donde invertiría calidad si sube el plan.

### P3 — Menores

- **Scroll anidado:** `.pc-transcripcion-cuerpo` (14rem + `overflow-y:auto`,
  `dashboard-resultado.css:264-276`) dentro del scroll de página es una trampa de
  scroll en móvil. El doc lo quiere fijo; en `< 640px` un disclosure «expandir»
  sería mejor.
- **Anuncio duplicado del score:** `AnilloSenal` lleva `aria-label` con el score
  (`DashboardResultado.tsx:184`) y al lado está el número visible `{score}` +
  `/100` (`:186-187`). El lector lo dice dos veces. Marcar la leyenda con
  `aria-hidden`.
- **Chrome de demo en la UI:** «Acta de comité» muestra el `jobId` crudo
  (`DashboardResultado.tsx:608-613`) y hace polling cada 20 s. Para la demo del
  hackathon tiene sentido; para un producto público es ruido de desarrollador.
- **`--elevated` no se usa** (`globals.css:11,30`; ya admitido en `DESIGN.md:174`).

## 5. Datos de contraste (reproducibles)

Medidos con un script local sobre los valores de `:root` en `globals.css`.
Umbrales WCAG: AA = 4.5:1 (texto normal), AAA = 7:1, UI/large = 3:1.

| Par | Claro | Oscuro |
| --- | --- | --- |
| Texto principal / lienzo | 16.55 AAA | 17.28 AAA |
| Tinta baja / lienzo | 5.23 AA | 7.35 AAA |
| Tinta baja / hundido (comentario rúbrica, chips, fecha) | 4.87 AA | 6.68 AA |
| Señal / lienzo (línea de sesión, links) | 7.86 AAA | 9.91 AAA |
| Señal / hundido | 7.32 AAA | 9.01 AAA |
| Señal / tinte (fila cumplida, muletilla) | 6.75 AA | 5.99 AA |
| Atención / hundido (error, conteo de muletilla) | 5.28 AA | 5.45 AA |
| Atención / lienzo | 5.67 AA | 6.00 AA |
| Hueso / campo (botón primario) | 10.45 AAA | 10.45 AAA |
| Hueso / pico (hover primario, solo claro) | 12.86 AAA | — |
| **Filete / lienzo** | **1.42 FALLA** | **1.55 FALLA** |
| **Filete / hundido** | **1.32 FALLA** | — |
| Reposo / lienzo (barra de tiempo, arco en reposo) | — | 3.99 UI |

Lectura: **todo el texto pasa.** El único incumplimiento es el filete, que es un
borde de componente, no texto (ver P2).

## 6. Plan de acción ordenado

1. **Actualizar `DESIGN.md`** a la fila «cumplido» (o revertir el código) y
   corregir `docs/README.md:36`. Que la fuente de verdad deje de contradecir al
   código.
2. **`role="radiogroup"` + flechas** en los tres selectores.
3. **Subir el contraste del filete** o ampliar el escalón hundido.
4. **`<label>` asociado** al textarea de respaldo.
5. **Capturas nuevas del README** y cierre de la fase UX/UI (el screenshot actual
   está deliberadamente desactualizado).

Los pasos 1-4 son cambios locales, sin rediseño. El paso 5 depende de que 1-4
estén hechos.

## 7. Sobre los 10 créditos de Emergent

**Recomendación: no gastarlos en esta app.** Tres razones concretas:

1. **Genera una app nueva, no mejora la tuya.** Emergent produce
   React/Next.js + FastAPI + MongoDB desde cero. No lee `DESIGN.md`, no conoce
   «El Acta», no respeta la rampa olivo. Mejor caso: un lenguaje visual paralelo
   que no se puede mergear.
2. **El tier de 10 créditos es de evaluación, no de entrega.** No despliega (los
   preview links caducan a los 30 min) y no tiene integración con GitHub ni
   dominios propios.
3. **Los números no dan.** Cada run consume ~5 créditos por defecto → **10
   créditos ≈ 2 generaciones**. Un deploy son **50 créditos/mes**: no alcanza ni
   para uno. Con 2 runs no se itera nada.

**Único uso con sentido:** quemarlos a propósito en un artefacto **desechable**
donde «app nueva» *es* el objetivo — por ejemplo un prototipo de una sola página
(teaser o landing para la entrega del hackathon). Se trata como **boceto**: se
captura lo que salió, se descarta, y se reimplementa en el repo con el sistema
existente.

**Lo que da gratis dentro del repo:** hacer los pasos 1-5 de §6. No cuesta
créditos y mueve la aguja de verdad.

Fuentes consultadas (el pricing de Emergent cambia; contrastar con la página viva):

- [Emergent Credits Explained: What a Run, a Deploy and a Chatbot Cost](https://rationalgo.ai/resources/app-builder/pricing-guides/how-emergent-credits-work)
- [Emergent Deployment Cost: What 50 Credits Buys, and Why Preview Costs Nothing](https://rationalgo.ai/resources/app-builder/pricing-guides/emergent-deployment-credit-cost)
- [Emergent Free Trial: How Long It Lasts and What 10 Credits Cover](https://rationalgo.ai/resources/app-builder/pricing-guides/emergent-free-trial)
- [Emergent pricing in 2026: plans, credits and what an app really costs](https://cadrant.ai/blog/emergent-pricing)

## 8. Lo que este pase no cerró

- No se corrió la app ni un audit automático (axe/Lighthouse) ni se probó con
  lector de pantalla real: los hallazgos de semántica son por inspección de
  código, no por prueba con usuario.
- No se verificó rendimiento (LCP/CLS), ni el comportamiento del fallback de TTS
  en un navegador concreto.
- El contraste se midió sobre los tokens de `:root`; no sobre cada par
  fondo/texto que resulta de las combinaciones en runtime (p. ej. píldora sobre
  tarjeta hundida). Los valores cubren los pares que el CSS declara.
