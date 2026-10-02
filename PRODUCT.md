# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cuatro perfiles, **deliberadamente sin usuario primario**: builders/emprendedores
(pitch de capital), docentes y estudiantes (pitch educativo), perfiles técnicos
(pitch de tecnología) y quien presenta una propuesta (pitch de innovación).

La situación es la misma para todos: **van a presentar frente a una audiencia real
y quieren practicar en voz alta antes**, con retroalimentación objetiva en lugar de
la del espejo, la grabación sin analizar o la opinión de alguien sin estructura.

La **única segmentación es el tipo de pitch**, que el usuario elige al empezar. No
hay segmentación por rol, plan, ni nivel de experiencia, y los cuatro tipos pesan
igual: ningún perfil puede volverse el camino principal del producto.

Mercado: **LATAM**, con interfaz y feedback en español e inglés.

## Product Purpose

**Pitch Coach** es una herramienta de práctica de pitch. El usuario habla en voz
alta frente al micrófono; el sistema transcribe, evalúa el contenido contra la
rúbrica del tipo elegido, cuenta muletillas y muestra un dashboard con el detalle.
El veredicto corto se puede escuchar cuando el usuario quiera.

La idea central:

> Practica en voz alta. Recibe feedback concreto — escrito primero, hablado si lo
> pides — como si un coach te estuviera escuchando.

El éxito es que alguien pueda **practicar y saber qué le falta** en un minuto, sin
ceremonia previa y con algo accionable al final.

## Positioning

**El diferenciador principal: la rúbrica está atada al tipo de pitch.** Cada tipo
—capital, educación, innovación, tecnología— tiene cinco puntos fijos que la
evaluación busca. Un coach genérico evalúa "comunicación"; este evalúa si
realmente cubriste el problema, el mercado, el ask.

**Segundo diferenciador: inmediatez sin cuenta.** Práctica en voz alta con
resultado objetivo en un minuto. Sin registro, sin subir archivos, sin ceremonia.

Un producto vecino —tipo Yoodli— no puede copiar esto honestamente sin adoptar el
mismo modelo: rúbrica por tipo como contrato con el usuario, y resultado inmediato
sin fricción de acceso.

## Operating Context

**Loop principal:** elegir idioma, tipo de pitch y duración máxima (presets de 1 a
7 minutos) → grabar en voz alta → la grabación **se corta sola** al llegar al
límite → el servidor transcribe (ElevenLabs Scribe) → se cuentan muletillas sobre
la transcripción → el modelo evalúa contra la rúbrica → dashboard con score,
puntos cumplidos y faltantes, transcripción resaltada y veredicto.

**Extras dentro de la misma sesión:** escuchar el veredicto (TTS); **Análisis
Ultra** (reanálisis con razonamiento extendido y traza); **Resolver hallazgos**
(hasta 3 preguntas de seguimiento sobre puntos no cumplidos, respondidas por voz o
texto); **guion descargable** con marcas de tiempo por frase, si se grabó;
**Tu progreso** (historial local).

**Entorno real de uso:** navegador moderno con micrófono, HTTPS fuera de
localhost. Sesión **anónima**. El ritual es hablar en voz alta, no escribir.

## Capabilities and Constraints

**Implementado:** selector de tipo (4 opciones fijas) y de duración (1–7 min);
grabación con corte automático; transcripción (MediaRecorder + Scribe) con campo
de **texto de respaldo** si no hay micrófono o se niega el permiso; detección de
muletillas por conteo (21 patrones de oratoria LATAM en español; lista propia en
inglés, que evita marcar "like"/"so"/"right" por la palabra suelta); evaluación
contra rúbrica vía el proveedor activo (Nebius por defecto, Gemini de
contingencia), con JSON estructurado; score calculado en el servidor; TTS del
veredicto con SpeechSynthesis como fallback obligatorio; dashboard; Análisis
Ultra; Resolver hallazgos; historial local de las últimas 20 prácticas.

**Restricciones que el diseño debe respetar:**

- **Los ids de los puntos de rúbrica son un contrato.** Viajan por la API y quedan
  guardados en el historial: renombrar uno rompe datos ya persistidos.
- **Sin persistencia en servidor.** El historial vive en `localStorage` de ese
  navegador y no guarda transcripción, comentarios, traza de Ultra, preguntas,
  respuestas ni audio.
- **El audio se procesa en memoria y se descarta.** No se escribe a disco ni se
  adjunta a logs, breadcrumbs o Sentry.
- **Bilingüe por contrato.** Un único valor `idioma` (`'es' | 'en'`) gobierna
  interfaz, rúbricas, prompts, mensajes de error, el par de voces, el hint de STT
  y las muletillas. Agregar un idioma debe ser agregar datos, no tocar
  componentes. Ausente vale `'es'`; cualquier otro valor es 400.
- **Nunca depender de un solo canal.** Si un servicio externo falla, el loop no se
  corta: TTS cae a SpeechSynthesis, y sin micrófono hay texto de respaldo.
- **Sin STT en vivo.** El flujo es grabar → detener → transcribir el clip completo.
- **Fuera de alcance en esta versión:** cuentas/login, sincronización entre
  dispositivos, comparar dos intentos en la misma sesión, rúbricas custom, idiomas
  más allá de es/en, análisis de video o lenguaje corporal, backend separado.
- **Sin dato de negocio decidido:** precio, modelo de negocio y métricas de uso no
  están definidos y no deben inventarse.

## Brand Commitments

- **Nombre:** Pitch Coach.
- **Open source, licencia MIT.** El proyecto se puede usar, forkear y madurar.
- **El humor va en el copy, no en el dibujo.** (§5.1) El tono puede ser
  conversacional y con guiño —"ese 'o sea' sonó fuerte— van 12"— pero eso vive en
  el texto, no en el lenguaje visual.
- **Bilingüe es identidad, no traducción.** El español latino es caso de primera
  clase, no una localización posterior.
- **Dirección visual ya comprometida por el usuario.** Hay decisiones visuales
  vinculantes tomadas y registradas en `docs/referencias-ui/README.md`. Se
  registran acá **como puntero, sin expandirlas**: el mundo visual es materia de
  `DESIGN.md` y del flujo de new-work, no de este documento.

## Evidence on Hand

**Real y disponible:**

- Documentación de producto y contrato: `docs/alcance.md`, `docs/status.md`,
  `docs/README.md`.
- Demo en línea funcionando:
  `https://pitch-coach-production-1c0c.up.railway.app`.
- Capturas del estado actual en `public/screenshots/` — **son del mundo visual
  anterior y este rediseño las reemplaza**; no son una referencia a preservar.
- Material de dirección visual y referencias en `docs/referencias-ui/`.

**Ausencias que el trabajo futuro NO debe fabricar:** no hay testimonios, clientes,
casos de estudio, métricas de uso, benchmarks, prensa, ni precio. Cualquier prueba
social o número de tracción sería inventado.

## Product Principles

1. **El tipo de pitch es la única segmentación, y los cuatro pesan igual.** Ningún
   perfil ni tipo puede volverse el camino principal del diseño.
2. **La evaluación es específica, nunca genérica.** Cada punto de rúbrica es
   concreto y auditable; el feedback que serviría para cualquier pitch no sirve.
3. **Fricción casi cero.** Practicar en voz alta y obtener resultado sin cuenta,
   sin subir nada y sin ceremonia previa.
4. **Nunca un solo canal.** Voz y visual se sostienen mutuamente; si un servicio
   externo falla, el loop sigue.
5. **Nada sale del navegador por defecto.** Audio descartado, historial local,
   sesión anónima.

## Accessibility & Inclusion

**Estándar adoptado: WCAG 2.2 AA** — contraste, foco visible, navegación por
teclado y tamaño de objetivo táctil, verificable en auditoría.

Necesidades de producto ya establecidas:

- **Bilingüe es/en** con selección automática por navegador y preferencia
  guardada; el idioma gobierna también lo que se escucha.
- **Voz primero, pero con alternativa real.** El flujo depende de hablar en voz
  alta, así que el campo de texto de respaldo y las alternativas al audio son
  parte del diseño, no un parche.
- **La interfaz muestra y además dice.** El resultado nunca depende solo del audio:
  el dashboard es el canal principal y el TTS es a pedido.
