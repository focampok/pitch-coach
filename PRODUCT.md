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

La **narrativa de la submission** (video y texto de Devpost) muestra un solo caso,
de punta a punta: alguien en LATAM ensayando en voz alta un pitch de capital, la
noche anterior, sin coach. Eso no cambia la segmentación: los cuatro tipos siguen
pesando igual en la interfaz. El detalle está en Hackathon.

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

**La misma sesión, en cadena — no son adornos:** escuchar el veredicto (TTS);
**cifra citada** (Tavily, solo si un punto de rúbrica no se cumplió); **Análisis
Ultra** (reanálisis con razonamiento extendido y traza, a pedido); **Resolver
hallazgos** (hasta 3 preguntas de seguimiento sobre puntos no cumplidos,
respondidas por voz o texto); **guion descargable** con marcas de tiempo por
frase, si se grabó; **Tu progreso** (historial local).

**Contrato de visibilidad del resultado.** En la primera vista, sin un clic,
conviven tres cosas: el score, el punto de rúbrica que faltó, y la cifra citada
que se puede decir en voz alta, con fuente. Ultra sigue siendo un paso deliberado
—es más lento y se reserva para el razonamiento serio— pero el pedido es obvio, y
una vez corrido la traza queda junto al score. Los nombres de modelo son
procedencia corta, no el titular. El detalle de por qué este contrato existe está
en Hackathon.

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
veredicto con SpeechSynthesis como fallback obligatorio; dashboard; cifra citada
con Tavily en puntos no cumplidos; Análisis Ultra; Resolver hallazgos; historial
local de las últimas 20 prácticas.

**Ruteo de modelos en Nebius Token Factory** (el hecho que el resultado debe
poder mostrar como procedencia, y que el video y el README tienen que narrar):

| Nivel | Modelo | Para qué |
|---|---|---|
| `estandar` | Nemotron 3 Super | El score del minuto, contra la rúbrica |
| `ultra` | Nemotron 3 Ultra | Reanálisis a pedido, con traza de 4 a 8 pasos |
| `rapido` | Nemotron 3 Nano | Sparring, entidades, reescritura de la consulta, validación y frase hablada de la cifra |

Gemini es contingencia manual e **ignora el nivel**. No es la historia de la
entrega. Tavily solo corre si hay un punto sin cumplir: busca una estadística
citable; **la transcripción nunca se envía a Tavily**. Si no hay key o falla, el
resto del resultado sigue.

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
- **Dirección visual comprometida, aún en fase propuesta.** La dirección y la
  paleta viven en `docs/referencias-ui/README.md` como **propuesta de trabajo**
  (no contrato cerrado) y todavía no son un sistema visual en código. El
  **único destino formal** de los tokens aprobados es `DESIGN.md`; ante
  cualquier discrepancia visual, manda `DESIGN.md`. Acá se registra **como
  puntero, sin expandirla**: el mundo visual es materia de `DESIGN.md` y del
  flujo de new-work, no de este documento.
- **Anti-orbe.** La dirección visual descarta explícitamente la esfera/orbe
  brillante como representación del coach; el reemplazo es un indicador en vivo
  que reacciona al audio, con un solo matiz.
- **Sin muro de logos.** Los nombres de modelo (Nebius/Nemotron, Tavily) son
  procedencia, no el titular del dashboard.

## Evidence on Hand

**Real y disponible:**

- Documentación de producto y contrato: `docs/alcance.md`, `docs/status.md`,
  `docs/README.md`.
- Demo en línea funcionando:
  `https://pitch-coach-production-1c0c.up.railway.app`.
- Capturas del estado actual en `public/screenshots/` — **son del mundo visual
  anterior y este rediseño las reemplaza**; no son una referencia a preservar.
- Material de dirección visual y referencias en `docs/referencias-ui/`.
- **No existe el video de submission.** Es requisito (YouTube público, ≤3 min,
  inglés, con audio). No inventar un enlace.
- **No está escrito el delta del periodo de submission.** El proyecto es anterior
  al 26 de agosto de 2026; la explicación es obligatoria y todavía no existe.

**Ausencias que el trabajo futuro NO debe fabricar:** no hay testimonios, clientes,
casos de estudio, métricas de uso, benchmarks, prensa, ni precio. Cualquier prueba
social o número de tracción sería inventado.

## Hackathon

Pitch Coach se entrega a la **Nebius x NVIDIA Global AI Hackathon** (Devpost).
Esta sección es contexto de entrega, vigente hasta el cierre. No reescribe los
principios de producto: los cuatro tipos de pitch siguen pesando igual en la
interfaz.

**Track confirmado:** Best Apps and Agents. Construir una app o un agente que
alguien usaría de verdad, con modelos Nemotron en Nebius vía Token Factory.
Ultra para el razonamiento serio; Nano o Super para lo rápido, para que la app
siga respondiendo. Serverless Endpoints y Serverless Jobs están alentados y **no
son requisito**. No migrar el hosting para marcar esa casilla: la inferencia ya
corre en Token Factory y la demo vive en Railway.

**Fechas:**

- Submission: 26 de agosto de 2026, 9:00 PT – **30 de octubre de 2026, 10:00 PDT**.
- Juzgamiento: 1–15 de diciembre de 2026. Ganadores alrededor del 11 de enero de 2027.
- El proyecto es **anterior** al 26 de agosto. Hay que explicar por escrito qué
  cambió en el periodo. El rediseño es parte de esa explicación. No presentar la
  app como si hubiera nacido en la hackathon.

**Stage one** es pasa/no pasa: encaje real con el track, no un rebrand superficial.
**Stage two** puntúa 1–5, peso igual, en este orden (el mismo orden desempata):

1. **Technological Implementation** — qué tan bien está construido y qué tan
   efectivamente usa Token Factory (o AI Cloud) y Nemotron.
2. **Design** — experiencia de producto completa y coherente, no una prueba de
   concepto.
3. **Potential Impact** — un caso creíble y específico de un problema real para
   una audiencia real, y que lo demostrado lo ataque de verdad.
4. **Quality of the Idea** — uso creativo y no obvio de los modelos, y
   comprensión genuina del problema.

Lo que el track pide ver más allá de lo básico: **un flujo de varios pasos que
encadena herramientas**, no una sola llamada a un modelo. Pitch Coach ya es esa
cadena (voz → transcripción → rúbrica con Super → cifra citada con Tavily en el
punto que faltó → traza con Ultra si se pide → sparring con Nano → veredicto
hablado). El rediseño tiene que hacer esa cadena legible. Esconderla compite como
"un LLM que da feedback".

**Los jueces no están obligados a abrir la app.** Pueden puntuar solo con el
texto, las imágenes y el video. Lo que se muestra en pantallas y en el video es
superficie de evaluación. El video no puede mostrar una traza o una cifra que la
app no produzca de verdad.

**Paquete de juzgamiento, en inglés.** Video, descripción e instrucciones de
prueba van en inglés, o traen traducción. La app sigue bilingüe; el español
latino sigue siendo caso de primera clase. El video y las capturas de la
submission usan la interfaz en inglés.

**Video (todavía no existe):** YouTube público, **≤3 minutos** (no miran más),
con la app funcionando. Se trata como un pitch, no como un tutorial: problema,
solución andando, para quién es, y **en voz alta** cómo usa Nebius Token Factory
y Nemotron — una mención de pasada no alcanza. Muestra un solo tipo de punta a
punta (pitch de capital, LATAM, la noche anterior). Los otros tres tipos quedan
en la app y en una frase del texto.

**README y descripción** tienen que decir qué modelo Nemotron hace qué, dónde
Token Factory acelera el flujo, y qué otros servicios de Nebius entran. La
licencia MIT ya es visible y el README de setup ya existe.

**Tavily es parte de la solución, no un extra escondido.** Best Use of Tavily
son USD 3.000. La elegibilidad es una llamada real a la API dentro de la
solución (ya está). Ganarlo depende de que el uso sea evidente y cargue peso:
el punto de rúbrica que faltó recibe una cifra que se puede decir, con fuente.
Se puede ganar **junto con el premio del track** (un Jetson Orin Nano) y no junto
con un premio general (USD 20.000 / 10.000 / 6.000): es un premio general, o
track más un bonus.

**Feedback escrito, obligatorio, y no es una pantalla.** Para Token Factory y
cada modelo: para qué se usó, qué funcionó, qué no, cómo fue de cero al primer
llamado, y si se volvería a construir con ellos. Hay un premio aparte chico
(USD 100, 10 ganadores) por feedback específico. No diseñar un widget de feedback
dentro del producto.

**Premio de ciudad (USD 500): no es input de diseño.** Las reglas oficiales
exigen haber asistido a un Builders & Brews; la página de recursos dice que basta
con estar asociado a una ciudad, y ante el conflicto mandan las reglas. No consta
asistencia. Ciudad de México ya pasó (23 de septiembre de 2026).

**Lo que el rediseño no debe hacer:**

- Colapsar la cifra citada, ni la traza de Ultra una vez corrida.
- Convertir el dashboard en un muro de logos de Nebius o Tavily. Los nombres de
  modelo son procedencia, no el titular. Eso protege el criterio Design.
- Reducir el producto a un solo tipo de pitch para perseguir Potential Impact.
- Inventar tracción, testimonios, precio o métricas.
- Agregar cuentas, Serverless, o un formulario de feedback de la hackathon.

**Fuentes (mandan las reglas oficiales si un post las contradice):**

- https://nebiusglobalaihackathon.devpost.com/rules
- https://nebiusglobalaihackathon.devpost.com/updates/46204-here-s-how-judging-works
- https://nebiusglobalaihackathon.devpost.com/updates/46205-how-to-build-a-winning-project
- https://nebiusglobalaihackathon.devpost.com/resources

Los extractos locales en `oficina-agente/salidas/md/` cortan esos dos updates.
`perks.md` de esa carpeta es de Shipaton / RevenueCat y no aplica acá.

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
