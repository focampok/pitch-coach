# Pitch Coach

## 1. Problema

Practicar un pitch normalmente se hace frente a un espejo, grabándose en el celular, o frente a otras personas — sin retroalimentación estructurada, sin medir muletillas, sin verificar si realmente se cubrieron los puntos clave según el tipo de pitch (capital, educación, innovación, tecnología).

El feedback existente es subjetivo, tardío o inexistente. No hay una forma rápida de practicar en voz alta y recibir una evaluación objetiva e inmediata.

## 2. Concepto

**Pitch Coach** es una herramienta de práctica de pitch. El usuario habla en voz alta frente al micrófono, el sistema transcribe, analiza el contenido contra una rúbrica según el tipo elegido, detecta muletillas y muestra un dashboard con el detalle. El usuario puede escuchar un veredicto corto cuando quiera. Un **coach visual (avatar)** escucha en vivo durante la grabación y reacciona a lo que el sistema detecta (ver §5.1).

La idea central:

> Practica en voz alta. Recibe feedback concreto — escrito primero, hablado si lo pides — como si un coach te estuviera escuchando.

## 3. Usuario objetivo

Builders, emprendedores, estudiantes y profesionales que necesitan preparar un pitch — de capital, educativo, de innovación o técnico — y quieren practicar con retroalimentación objetiva antes de presentar frente a una audiencia real. Mercado: **LATAM**, interfaz y feedback en español.

## 4. Experiencia principal (loop del usuario)

1. El usuario elige el **tipo de pitch** (capital / educación / innovación / tecnología) y la **duración máxima**, mediante presets de 1 a 7 minutos.
2. Presiona grabar y **pitchea en voz alta**. La grabación se **corta automáticamente** al alcanzar la duración máxima.
3. El sistema **transcribe el audio a texto** en tiempo real. Mientras graba, el **avatar escucha y reacciona** (muletillas, frases de impacto, silencios) — ver §5.1.
4. El sistema analiza la transcripción:
   - Detecta **muletillas** (conteo por palabra/frase).
   - Evalúa el contenido contra la **rúbrica del tipo elegido**.
   - Genera un **score** y un **veredicto breve**.
5. El **dashboard muestra el detalle** en texto: transcripción con muletillas resaltadas, puntos de rúbrica, score y tiempo usado.
6. El usuario **puede escuchar al coach**: el `veredicto_corto` se convierte a voz (ElevenLabs, con fallback a SpeechSynthesis). No se reproduce solo al terminar el análisis.

## 5. Modelo híbrido (voz + visual)

Se **practica en voz** y el resultado se ve y se puede oír:

- **Canal visual:** durante la grabación, transcripción y muletillas en vivo + avatar. Al terminar, dashboard con rúbrica, score y mejoras. Es el canal principal del resultado.
- **Canal auditivo (a pedido):** el usuario pulsa "Escuchar veredicto". Si ElevenLabs falla, SpeechSynthesis cubre; si ambos fallan, el dashboard sigue ahí.

Nunca se depende de un solo canal.

### 5.1 Coach visual (avatar reactivo)

Personaje estilizado (SVG inline) que **escucha en vivo** y reacciona con micro-gestos. **Toda reacción se dispara por un dato real y es verificable en pantalla.**

#### Estados (uno activo a la vez)

| Estado | Disparador | Gesto | Refuerzo en dashboard |
|---|---|---|---|
| `Escuchando` (idle) | grabando con texto normal | postura atenta, parpadeo sutil | transcripción en vivo |
| `Estremecido` | muletilla detectada en texto intermedio | leve retroceso / ceja levantada | la muletilla y su contador se muestran |
| `Sorprendido` | frase de impacto (keyword matching local) | expresión de sorpresa | punto de rúbrica marcado cumplido |
| `Asintiendo` | fin de grabación / veredicto positivo | pequeño asentimiento | score y resumen |
| `MirandoReloj` | silencio prolongado (~3s sin texto nuevo) | gesto de espera / mira el reloj | barra de tiempo |

#### Reglas de diseño

- **Una reacción a la vez**, breve (~1.2s) y con prioridad a la más reciente.
- **Micro-gestos, no bailes.** El gesto sobrio se lee como "coach", no como "juguete".
- **Sin flashes** (WCAG) y respetar `prefers-reduced-motion`: si está activo, el avatar queda estático y el feedback pasa por contadores y TTS.
- **El color nunca es el único canal.**
- **El humor va en el copy, no en el dibujo** (ej. "ese 'o sea' sonó fuerte — van 12").

#### Dependencia con el resto del sistema

- Usa los **interim results** de la Web Speech API y la misma lógica regex de `src/lib/muletillas.ts` — **sin IA en tiempo real**. Gemini queda reservado al análisis final.
- Las "frases de impacto" son **keyword matching local** sobre el texto intermedio, no una llamada al LLM por cada fragmento.

## 6. Rúbricas por tipo de pitch

Cada tipo tiene 5 puntos fijos que la IA busca en la transcripción. Van **hardcodeadas**; no hay rúbricas custom en esta versión.

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

La implementación tiene **21 patrones** (oratoria LATAM) y umbral ≥3 para "pues" y "bueno". La misma lista (`PATRONES_MULETILLAS` en `src/lib/muletillas.ts`) sirve para el conteo y para el resaltado.

## 9. Alcance actual

Ciclo completo:

**tipo de pitch + duración máxima → grabación (corte automático) → transcripción → análisis (muletillas + rúbrica + tiempo) → dashboard + veredicto a pedido**

- [x] Selector de tipo de pitch (4 opciones fijas).
- [x] Selector de duración máxima (presets de 1 a 7 minutos).
- [x] Grabación con corte automático.
- [x] Transcripción (Web Speech API).
- [x] Detección de muletillas por conteo.
- [x] Evaluación contra rúbrica vía Gemini (JSON estructurado).
- [x] Veredicto en voz (ElevenLabs, fallback SpeechSynthesis), a pedido.
- [x] Dashboard: transcripción, muletillas resaltadas, rúbrica, score.
- [x] Avatar con reacciones en vivo (§5.1).
- [x] Sesión anónima, sin login.

## 10. Fuera de esta versión

- Sistema de usuarios, login o perfiles.
- Persistencia de historial entre sesiones (base de datos).
- Comparar dos intentos en la misma sesión.
- Edición o creación de rúbricas custom.
- Soporte multi-idioma (solo español).
- Análisis de video, lenguaje corporal o expresión facial.
- Avatar 3D o "talking head".
- Backend separado — todo corre en Next.js con API routes.

## 11. Qué debe ser evidente al usarlo

- El usuario pitcheó en voz alta (no un texto pre-cargado).
- La transcripción corresponde a lo dicho.
- Las muletillas son específicas, no genéricas.
- La rúbrica marca puntos concretos cubiertos y faltantes.
- El dashboard y el veredicto hablado (si se escucha) coinciden.
- El avatar reacciona a algo real del pitch (ej. se estremece al decir "o sea").

## 12. Servicios externos

Todas las keys viven server-side (API routes). Ninguna se expone al cliente.

- **Gemini** — análisis del pitch (rúbrica, score, `veredicto_corto`). Requerido para el loop.
- **ElevenLabs** — TTS del veredicto. Primera opción; **SpeechSynthesis es fallback obligatorio** y no se elimina.
- **Tavily** — enriquecimiento opcional: si un punto de rúbrica no se cumplió, busca una estadística y la sugiere en el dashboard. Si no hay key o falla, el resto de la UI no se rompe.

## 13. Stack técnico

### Frontend + backend (proyecto único)
- **Next.js** (React) con **API routes**. Las keys no salen del servidor.
- **Tailwind CSS**.

### Voz → texto (STT)
- **Web Speech API** (`SpeechRecognition`), sin dependencias.
- Soporte fiable en Chrome / Chromium / Edge. Brave no lo expone; Firefox lo trae deshabilitado.
- Requiere internet (Chrome procesa el audio en servidores de Google).
- `GrabadorVoz.tsx` muestra un mensaje claro si el navegador no soporta reconocimiento.
- Fallback posible a futuro: Whisper (u otro STT) server-side, si Web Speech API no alcanza.

### Análisis (LLM)
- **Gemini API** (Flash / Flash-Lite).
- El prompt recibe transcripción + tipo + rúbrica + tiempo real vs. máximo.
- Respuesta en **JSON estructurado**:

```json
{
  "score": 72,
  "veredicto_corto": "Buen manejo del problema, pero te faltó mencionar el ask de capital.",
  "rubrica": [
    { "punto": "Problema claro", "cumplido": true, "comentario": "..." },
    { "punto": "Tamaño del mercado", "cumplido": false, "comentario": "..." }
  ],
  "muletillas": {
    "eeee": 12,
    "o sea": 3
  }
}
```

### Texto → voz (TTS)
- **ElevenLabs** como primera opción (voz natural en español).
- **SpeechSynthesis** nativa como fallback: si ElevenLabs falla o tarda, el loop no se corta.

### Muletillas
- Regex / keyword matching. No requiere LLM.

### Avatar
- SVG inline + CSS transforms. Matching local sobre interim results. Respeta `prefers-reduced-motion`.

### Deploy
- Un solo servicio Next.js (p. ej. Railway). HTTPS hace falta para el micrófono fuera de localhost.

## 14. Entorno de desarrollo

- Ejecución nativa (`npm run dev`). El `Dockerfile` es solo para el deploy, no para desarrollar.
- Las keys van en `.env.local` (no se commitea). `.env.example` documenta los nombres, sin valores.
