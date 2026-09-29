# Pitch Coach

## 1. Problema

Practicar un pitch normalmente se hace frente a un espejo, grabándose en el celular, o frente a otras personas — sin retroalimentación estructurada, sin medir muletillas, sin verificar si realmente se cubrieron los puntos clave según el tipo de pitch (capital, educación, innovación, tecnología).

El feedback existente es subjetivo, tardío o inexistente. No hay una forma rápida de practicar en voz alta y recibir una evaluación objetiva e inmediata.

## 2. Concepto

**Pitch Coach** es una herramienta de práctica de pitch. El usuario habla en voz alta frente al micrófono, el sistema transcribe, analiza el contenido contra una rúbrica según el tipo elegido, detecta muletillas y muestra un dashboard con el detalle. El usuario puede escuchar un veredicto corto cuando quiera. La interfaz muestra un **indicador de estado del coach** en texto mientras se graba y se transcribe (ver §5.1).

La idea central:

> Practica en voz alta. Recibe feedback concreto — escrito primero, hablado si lo pides — como si un coach te estuviera escuchando.

## 3. Usuario objetivo

Builders, emprendedores, estudiantes y profesionales que necesitan preparar un pitch — de capital, educativo, de innovación o técnico — y quieren practicar con retroalimentación objetiva antes de presentar frente a una audiencia real. Mercado: **LATAM**, con interfaz y feedback en **español e inglés** (§15).

## 4. Experiencia principal (loop del usuario)

1. El usuario elige el **tipo de pitch** (capital / educación / innovación / tecnología) y la **duración máxima**, mediante presets de 1 a 7 minutos.
2. Presiona grabar y **pitchea en voz alta**. La grabación se **corta automáticamente** al alcanzar la duración máxima.
3. El sistema **graba el audio** (MediaRecorder) y, al detener, **lo transcribe** en el servidor (ElevenLabs Scribe). Mientras graba, la interfaz muestra el indicador `Escuchando…`; las muletillas se cuentan sobre la transcripción final — ver §5.1.
4. El sistema analiza la transcripción:
   - Detecta **muletillas** (conteo por palabra/frase).
   - Evalúa el contenido contra la **rúbrica del tipo elegido**.
   - Genera un **score** y un **veredicto breve**.
5. El **dashboard muestra el detalle** en texto: transcripción con muletillas resaltadas, puntos de rúbrica, score y tiempo usado.
6. El usuario **puede escuchar al coach**: el `veredicto_corto` se convierte a voz (ElevenLabs, con fallback a SpeechSynthesis). No se reproduce solo al terminar el análisis.
7. Si quiere más rigor, puede pedir **Análisis Ultra**: se reanaliza la misma transcripción con Nemotron Ultra (razonamiento activo). El resultado se muestra además del estándar, etiquetado, con una **traza** (log de 4–8 pasos: qué buscó, qué halló o faltó).
8. Si quedó al menos un punto de rúbrica sin cubrir, puede **resolver hallazgos**: hasta 3 preguntas de seguimiento (una por punto no cumplido, en orden de rúbrica). Cada pregunta aparece en texto; el usuario puede escucharla (misma voz de la sesión) si quiere. Tras cada respuesta recibe feedback; al final ve cuántos hallazgos resolvió.

## 5. Modelo híbrido (voz + visual)

Se **practica en voz** y el resultado se ve y se puede oír:

- **Canal visual:** durante la grabación, indicador de estado + cronómetro. Al terminar, transcripción, dashboard con rúbrica, score y muletillas. Es el canal principal del resultado.
- **Canal auditivo (a pedido):** el usuario pulsa "Escuchar veredicto". Si ElevenLabs falla, SpeechSynthesis cubre; si ambos fallan, el dashboard sigue ahí.

Nunca se depende de un solo canal.

### 5.1 Indicador de estado del coach (temporal)

El **avatar reactivo fue eliminado**. El flujo actual es grabar → transcribir → analizar, así que no hay resultados intermedios sobre los que reaccionar: el avatar solo tenía dos estados reales (`escuchando` y `asintiendo`). En su lugar hay un **indicador de texto simple**, sin animación ni diseño visual nuevo:

| Estado | Texto | Cuándo |
|---|---|---|
| Grabando | `Escuchando…` | mientras se graba el pitch |
| Transcribiendo | `Transcribiendo…` | mientras el servidor transcribe (Scribe) |
| Finalizado | una de las **3 frases de `MENSAJES_ASINTIENDO`** | al llegar la transcripción (o el texto de respaldo) |

Los textos salen del diccionario de la sesión (`es` / `en`); la frase final se elige al azar entre tres. Aplica igual al flujo principal de pitch y a **"Resolver hallazgos"**, que reusa el mismo grabador.

**Es un estado temporal.** El reemplazo visual —una animación tipo esfera, construida desde cero— está planeado para la fase de **UX/UI**. No hay motor de reacciones ni estados reservados: el STT en vivo (Scribe Realtime) sigue fuera de alcance y no tiene fecha de calendario.

#### Reglas

- **Sin animación nueva** por ahora: el lenguaje visual del coach lo define la fase de UX/UI.
- **El resultado sigue siendo el dashboard**, más el canal auditivo a pedido (TTS). El indicador no es un canal de feedback.
- **El humor va en el copy, no en el dibujo** (ej. "ese 'o sea' sonó fuerte — van 12").

## 6. Rúbricas por tipo de pitch

Cada tipo tiene 5 puntos fijos que la IA busca en la transcripción. Van **hardcodeadas**; no hay rúbricas custom en esta versión.

Cada punto tiene un **id estable** —es lo que viaja por la API y lo que se guarda en el historial— y su nombre y descripción "qué buscar" traducidos a cada idioma. Traducir un punto no invalida los datos ya guardados. Los ids por tipo están en §15; los nombres de abajo son los del español.

### Capital
1. Problema claro
2. Tamaño del mercado / oportunidad
3. Solución / diferenciador
4. Tracción o evidencia (datos, usuarios, ingresos)
5. El "ask" (cuánto capital se busca y para qué)

### Educación
1. Objetivo de aprendizaje claro
2. Estructura pedagógica (inicio, desarrollo, cierre)
3. Ejemplo o caso concreto que ilustra el concepto
4. Conexión con el conocimiento previo de la audiencia
5. Llamado a la acción o siguiente paso para el aprendiz

### Innovación
1. Problema u oportunidad identificada
2. Qué hace diferente/innovador a la propuesta
3. Evidencia de validación (aunque sea temprana)
4. Impacto esperado
5. Próximos pasos o visión a futuro

### Tecnología
1. Problema técnico que resuelve
2. Cómo funciona (sin perderse en jerga excesiva)
3. Diferenciador técnico real (qué lo hace difícil de replicar)
4. Estado actual (funcional, en desarrollo, escalabilidad)
5. Uso de recursos o stack relevante mencionado con claridad

## 7. Duración máxima del pitch

Presets fijos: **1, 2, 3, 4, 5, 6 o 7 minutos**. No hay valor libre.

- La grabación **se corta automáticamente** al llegar al límite.
- El tiempo real vs. el máximo **entra como contexto del LLM** (¿se acabó el tiempo antes del ask? ¿sobraron minutos?).
- El dashboard muestra el tiempo usado vs. el máximo.

## 8. Detección de muletillas

No requiere IA: regex / keyword count sobre la transcripción.

Lista base:

- "eeee" / "ehh"
- "o sea"
- "como les decía"
- "este..."
- "bueno pues"
- "a mi me tocó hablar de"
- "digamos"
- "en ese sentido"

La implementación en español tiene **21 patrones** (oratoria LATAM) y umbral ≥3 para "pues" y "bueno". La misma lista (`PATRONES_MULETILLAS`) sirve para el conteo y para el resaltado. "eeee / ehh" solo cuenta si Scribe escribe el relleno.

En inglés, `patronesMuletillas("en")`: "um", "uh", "you know", "I mean", "actually", "basically", "kind of" / "sort of", más "well", "like", "so" y "right?" con contexto. "like", "so" y "right" no se marcan por la palabra suelta (tienen uso legítimo: "I like", "and so on", "the right market", "right now"). Se marcan al inicio de cláusula, entre comas, repetidas, o —"right"— como coletilla ("right?"). "um" / "uh" tienen la misma limitación que "eeee": dependen de que Scribe las transcriba. "you know" puede coincidir con "do you know"; es un falso positivo conocido, del mismo tipo que "este" en español. El análisis y el resaltado usan el idioma de la sesión.

## 9. Alcance actual

Ciclo completo:

**tipo de pitch + duración máxima → grabación (corte automático) → transcripción → análisis (muletillas + rúbrica + tiempo) → dashboard + veredicto a pedido → [opcional] Análisis Ultra y/o resolver hallazgos**

- [x] Selector de tipo de pitch (4 opciones fijas).
- [x] Selector de duración máxima (presets de 1 a 7 minutos).
- [x] Grabación con corte automático.
- [x] Transcripción (MediaRecorder + ElevenLabs Scribe, con texto de respaldo si no hay micrófono).
- [x] Detección de muletillas por conteo.
- [x] Evaluación contra rúbrica vía el proveedor activo (Nebius por defecto; Gemini de contingencia). JSON estructurado.
- [x] Veredicto en voz (ElevenLabs, fallback SpeechSynthesis), a pedido.
- [x] Dashboard: transcripción, muletillas resaltadas, rúbrica, score.
- [x] Indicador de estado del coach en texto (`Escuchando…` / `Transcribiendo…` / 3 frases al terminar), §5.1. El reemplazo visual (esfera) queda para la fase de UX/UI.
- [x] Sesión anónima, sin login.
- [x] Análisis Ultra: reanálisis de la misma transcripción con razonamiento extendido (Nemotron Ultra).
- [x] Resolver hallazgos: hasta 3 preguntas de seguimiento sobre puntos no cumplidos (orden de rúbrica), texto + escuchar a pedido, respuesta por voz o texto de respaldo.
- [x] Historial local y panel "Tu progreso": las últimas 20 prácticas de este navegador (fecha, tipo, duración, score, claridad, rúbrica sin comentario, conteo de muletillas, si se usó Ultra y, si se completó, el resumen de hallazgos). No hay cuentas ni copia en servidor.

## 10. Fuera de esta versión

- Sistema de usuarios, login o perfiles.
- Persistencia en servidor y sincronización entre navegadores o dispositivos. El historial que sí existe es local (`localStorage` de este navegador) y no guarda transcripción, comentarios, traza de Ultra, preguntas, respuestas ni audio.
- Comparar dos intentos en la misma sesión.
- Edición o creación de rúbricas custom.
- Idiomas nuevos más allá de español e inglés (§15).
- Animación del coach más allá del indicador de texto (esfera): la define la fase de UX/UI.
- Análisis de video, lenguaje corporal o expresión facial.
- Animación del coach más elaborada ("talking head", 3D).
- Backend separado — todo corre en Next.js con API routes.

## 11. Qué debe ser evidente al usarlo

- El usuario pitcheó en voz alta (no un texto pre-cargado).
- La transcripción corresponde a lo dicho.
- Las muletillas son específicas, no genéricas.
- La rúbrica marca puntos concretos cubiertos y faltantes.
- El dashboard y el veredicto hablado (si se escucha) coinciden.
- El indicador de estado refleja el momento real del flujo (grabando / transcribiendo / listo) y la transcripción aparece al terminar.
- Si pide Análisis Ultra, ve un segundo resultado etiquetado (con traza de razonamiento), no un reemplazo del primero.
- Si hay puntos sin cubrir, puede resolver hallazgos (máx. 3) y ve cuántos resolvió.
- "Tu progreso" lista intentos de este navegador (score y cobertura) sin mostrar la transcripción ni los comentarios.

## 12. Servicios externos

Todas las keys viven server-side (API routes). Ninguna se expone al cliente.

- **Nebius Token Factory** — análisis del pitch por defecto (Nemotron Super). Ultra usa Nemotron Ultra; sparring usa Nemotron Nano.
- **Gemini** — respaldo manual de contingencia (`MODEL_PROVIDER=gemini`). Ignora el nivel (`estandar` / `ultra` / `rapido`).
- **ElevenLabs** — TTS del veredicto y de las preguntas de sparring (SpeechSynthesis es fallback obligatorio) y **STT (Scribe)** de la grabación. El audio del usuario no se escribe a disco ni se adjunta a logs o a Sentry.
- **Tavily** — enriquecimiento opcional: si un punto de rúbrica no se cumplió, busca una estadística y la sugiere en el dashboard. Si no hay key o falla, el resto de la UI no se rompe.

## 13. Stack técnico

### Frontend + backend (proyecto único)
- **Next.js** (React) con **API routes**. Las keys no salen del servidor.
- **Tailwind CSS**.

### Voz → texto (STT)
- **MediaRecorder** en el cliente (Chrome, Firefox, Safari, Brave, móvil) y **ElevenLabs Scribe** (`POST /v1/speech-to-text`, `scribe_v2`) en `/api/transcribir`.
- Flujo de esta fase: grabar → detener → transcribir → mostrar el texto completo. Sin palabra por palabra en vivo.
- Scribe acepta `audio/webm` (Chrome/Firefox) y `audio/mp4` (Safari) sin transcodificar.
- Si `getUserMedia` no existe o el permiso se niega, hay un **campo de texto de respaldo** (pitch principal y Resolver hallazgos).
- El audio se procesa **en memoria** y se descarta al obtener el texto: no se escribe a disco ni se adjunta a logs, breadcrumbs o Sentry.

### Análisis (LLM)
- **Nebius Token Factory** por defecto (Nemotron Super / Ultra / Nano según el
  nivel). Gemini sigue disponible como contingencia.
- El prompt recibe transcripción + tipo + rúbrica + tiempo real vs. máximo, y el
  **idioma** de la petición: las instrucciones y la salida van en ese idioma
  (§15). La transcripción se marca como **dato no confiable** entre delimitadores,
  que no se traducen.
- El modelo devuelve **solo** esta porción, en **JSON estructurado**:

```json
{
  "veredicto_corto": "Buen manejo del problema, pero te faltó mencionar el ask de capital.",
  "claridad": 15,
  "rubrica": [
    { "cumplido": true, "comentario": "..." },
    { "cumplido": false, "comentario": "..." }
  ]
}
```

En Análisis Ultra el modelo añade `"traza": ["paso 1", "..."]` (4 a 8 pasos de
razonamiento). El análisis estándar no la pide.

- El modelo **no** calcula el score, **no** nombra los puntos y **no** cuenta
  muletillas. El servidor asigna el **id** de cada punto desde la rúbrica por
  índice, calcula el score (`clamp(round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100)`)
  y cuenta las muletillas con `src/lib/muletillas.ts`.

### Resolver hallazgos (interno: sparring)
- Si hay puntos con `cumplido: false`, se ofrecen hasta 3 preguntas (los
  primeros en el orden de la rúbrica).
- Cada pregunta se genera y cada respuesta se evalúa con el nivel `rapido`
  (Nano). El modelo de evaluación devuelve solo `{ cumplido, comentario }`.
- La pregunta se muestra en texto. El usuario puede pulsar "Escuchar pregunta"
  (misma voz de ElevenLabs de la sesión); no se reproduce sola.
- El usuario responde por voz (mismo grabador) o con el texto de respaldo si no hay micrófono.

### Texto → voz (TTS)
- **ElevenLabs** como primera opción (voz natural). La voz se reutiliza en el
  sparring de la misma sesión: el género queda fijo y el idioma elige el par
  de Voice IDs (§15).
- **SpeechSynthesis** nativa como fallback: si ElevenLabs falla o tarda, el loop no se corta.

### Muletillas
- Regex / keyword matching. No requiere LLM.

### Indicador del coach
- Texto plano en el idioma de la sesión (`Escuchando…` / `Transcribiendo…` / frase de asintiendo). Sin SVG, sin animación. §5.1.

### Deploy
- Un solo servicio Next.js (p. ej. Railway). HTTPS hace falta para el micrófono fuera de localhost.

## 14. Entorno de desarrollo

- Ejecución nativa (`npm run dev`). El `Dockerfile` es solo para el deploy, no para desarrollar.
- Las keys van en `.env.local` (no se commitea). `.env.example` documenta los nombres, sin valores.

## 15. Modo bilingüe (es / en)

El producto funciona en **español e inglés**. Un único valor `idioma` (`'es' | 'en'`)
gobierna lo que se lee y lo que se escucha: interfaz, rúbricas, prompts,
mensajes de error, el par de voces de ElevenLabs, el hint de Scribe, las
muletillas y las tres frases de asintiendo.

### Registro de idiomas

`src/lib/idiomas.ts` es la fuente de verdad de qué idiomas existen: código,
nombre, etiqueta BCP-47 (`es-419` / `en-US`) y `codigoStt` (el hint
`language_code` de Scribe, ISO 639-1). Los Voice IDs no viven en el registro:
son variables de entorno (`ELEVENLABS_VOICE_ID_MALE` / `_FEMALE` en español,
`ELEVENLABS_VOICE_ID_EN_MALE` / `_EN_FEMALE` en inglés). Las muletillas viven
en `src/lib/muletillas.ts`. Agregar un idioma nuevo debe ser **agregar datos**
(registro, diccionario, par de voces, patrones), no tocar componentes.

Los textos viven en diccionarios tipados (`src/lib/diccionario-es.ts`,
`src/lib/diccionario-en.ts`, y el selector en `src/lib/diccionarios.ts`). El
inglés está tipado contra `typeof es`, así que una clave faltante o de más falla
el build; un test verifica lo mismo en runtime, incluida la aridad de las
funciones de plural.

### Cómo se elige el idioma

1. El guardado en `localStorage` (`pitch-coach:idioma`), si lo hay.
2. Si no, `navigator.languages[0]`: `es*` → español, cualquier otra cosa → inglés.
3. Si no hay ninguna señal, español (también es el valor del servidor).

La home es **estática** (se prerenderiza en build), así que el servidor no puede
leer `localStorage` ni `navigator`. Por eso un script en el `<head>` fija
`<html lang>` **antes del primer paint**, y el árbol de React arranca con el
mismo idioma por defecto que el servidor —sin advertencia de hidratación— para
corregirse en un *layout effect*, que React ejecuta antes de que el navegador
pinte. El resultado: primer frame ya en el idioma correcto, y la home sigue
sirviéndose estática.

### Ids estables de los puntos de rúbrica

Los ids son un **contrato**: viajan por la API y quedan guardados en el historial
de cada usuario, así que renombrar uno rompe datos ya persistidos (hay un test que
fija la lista para que el cambio sea deliberado). Son únicos **dentro de cada
tipo**, no entre tipos.

| Tipo | Ids (en orden) |
|---|---|
| Capital | `problema`, `mercado`, `solucion`, `traccion`, `ask` |
| Educación | `objetivo`, `estructura`, `ejemplo`, `conocimiento-previo`, `llamado-accion` |
| Innovación | `problema-oportunidad`, `diferenciador`, `validacion`, `impacto`, `proximos-pasos` |
| Tecnología | `problema-tecnico`, `funcionamiento`, `diferenciador-tecnico`, `estado`, `stack` |

El modelo nunca ve un id: el servidor asigna el id por índice y el prompt solo
lleva los nombres visibles del idioma elegido.

### Historial y continuidad

Cada sesión guarda el **id** de cada punto y el **idioma** en que se practicó.
Las entradas anteriores al modo bilingüe (nombre en español, sin `idioma`) se
leen sin romper: el nombre se mapea a su id y el idioma se asume español, que es
el único que existía. Un valor que no corresponde a ningún punto se conserva tal
cual y se muestra así.

La continuidad —qué puntos quedaron sin cubrir en el intento anterior— solo mira
sesiones del **mismo tipo de pitch y del mismo idioma**, para que una práctica en
inglés no condicione una en español.

### Contrato de las API

Todas las rutas reciben `idioma` (`'es' | 'en'`); ausente vale `'es'` y cualquier
otro valor es un **400**. Los mensajes genéricos, los 413 y el 429 se devuelven en
ese idioma. En `/api/transcribir` el idioma va como **campo del FormData**, porque
su cuerpo es multipart y no JSON.

El **429** es el único caso especial: lo arma el rate limit, que corre *antes* de
leer el cuerpo (a propósito: no se parsean 20 MB de audio bajo abuso), así que
toma el idioma de la cabecera `X-Idioma` que el cliente manda en cada petición.
Cuando el cuerpo sí se puede leer, manda el cuerpo.

`/api/enriquecer` acepta y valida el campo, pero todavía no lo usa: localizar la
consulta y los resultados de Tavily es una fase propia.

### Voz

El veredicto y las preguntas de Resolver hallazgos pasan por `/api/tts`. El
género (`male` / `female` / `random`) es el de la sesión y no cambia al
cambiar de idioma; el idioma elige el par de Voice IDs. Si faltan las variables
del idioma, el cliente cae a SpeechSynthesis.

Scribe (`POST /v1/speech-to-text`) acepta `language_code` opcional (ISO 639-1 o
639-3). Si se omite, autodetecta. Pitch Coach manda el idioma de la sesión
(`es` o `en`) porque ya se conoce y el hint puede mejorar la transcripción.
`ELEVENLABS_SCRIBE_MODEL` solo elige el modelo (default `scribe_v2`).
`no_verbatim` se deja apagado: ese flag borra muletillas.

### Fuera de esta fase

- Animación del coach (esfera) y STT en vivo (Scribe Realtime). El reemplazo
  visual llega en la fase de UX/UI.
- Traducción de la consulta de Tavily.
