# Pitch Coach

## Hackathon: The Next Craft — Track: Learning by Shipping

---

## 1. Problema

Practicar un pitch normalmente se hace frente a un espejo, grabándose en el celular, o frente a otras personas — sin retroalimentación estructurada, sin medir muletillas, sin verificar si realmente se cubrieron los puntos clave según el tipo de pitch (capital, educación, innovación, tecnología).

El feedback existente es subjetivo, tardío o inexistente. No hay una forma rápida de practicar en voz alta y recibir una evaluación objetiva e inmediata.

## 2. Concepto

**Pitch Coach** es una herramienta conversacional de práctica de pitch. El usuario habla su pitch en voz alta frente al micrófono, el sistema transcribe, analiza el contenido contra una rúbrica según el tipo de pitch elegido, detecta muletillas, y responde con un veredicto hablado (a través de bocina) además de un dashboard visual con el detalle completo.

La idea central:

> No leas feedback en una pantalla. Practica en voz alta y recibe una respuesta hablada, como si un coach real te estuviera escuchando.

## 3. Usuario objetivo

Builders, emprendedores, estudiantes y profesionales que necesitan preparar un pitch — de capital, educativo, de innovación o técnico — y quieren practicar con retroalimentación objetiva antes de presentar frente a una audiencia real.

## 4. Experiencia principal (loop del usuario)

1. El usuario elige el **tipo de pitch** (capital / educación / innovación / tecnología) y la **duración máxima** de su pitch, mediante presets de 1 a 7 minutos (en incrementos de 1 minuto).
2. Presiona grabar y **pitchea en voz alta** frente al micrófono. La grabación se **corta automáticamente** al alcanzar la duración máxima seleccionada.
3. El sistema **transcribe el audio a texto** en tiempo real (o al finalizar la grabación).
4. El sistema analiza la transcripción:
   - Detecta **muletillas** (conteo por palabra/frase).
   - Evalúa el contenido contra la **rúbrica del tipo de pitch elegido** (puntos cubiertos / faltantes).
   - Genera un **score** y un **veredicto breve**.
5. El veredicto se convierte a voz y se **reproduce por bocina** (modelo híbrido).
6. En paralelo, el **dashboard muestra el detalle completo**: transcripción, muletillas resaltadas, puntos de rúbrica cumplidos/faltantes, score visual.
7. (Opcional, si el tiempo lo permite) El usuario puede intentar de nuevo en la misma sesión y comparar contra el intento anterior.

## 5. Modelo híbrido (voz + visual)

El diferenciador central del producto frente a un simple "analizador de texto" es que la interacción principal ocurre **en voz**, no leyendo una pantalla:

- **Canal auditivo (la demo "wow")**: el usuario habla, la bocina responde con un veredicto corto y directo.
- **Canal visual (evidencia y detalle)**: mientras ocurre la interacción de voz, la pantalla muestra en tiempo real la transcripción, las muletillas detectadas, y el score — sirve como respaldo si el audio falla y como evidencia de "datos reales" para los jueces.

Este diseño es intencional: si el TTS o el hardware de audio fallan durante la demo en vivo, el dashboard visual sigue funcionando como respaldo. Nunca se depende de un solo canal.

## 6. Rúbricas por tipo de pitch

Cada tipo de pitch tiene una lista fija de 4-5 puntos que la IA busca en la transcripción del usuario.

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

> Nota: estas rúbricas van **hardcodeadas** en el MVP. No hay edición ni entrenamiento de rúbricas custom.

## 7. Duración máxima del pitch

El usuario selecciona la duración máxima antes de grabar, mediante presets fijos: **1, 2, 3, 4, 5, 6 o 7 minutos**. No se acepta un valor libre/personalizado en el MVP — solo estos presets.

- La grabación **se corta automáticamente** al llegar al límite seleccionado (deteniendo el reconocimiento de voz / grabación de audio).
- El tiempo usado (duración real del pitch vs. duración máxima seleccionada) **se incluye como contexto en la evaluación del LLM**, no es solo un cronómetro visual. Ejemplos de feedback que esto habilita:
  - El usuario se quedó sin tiempo antes de cubrir un punto clave de la rúbrica (ej. "se te acabó el tiempo antes de mencionar el ask de capital").
  - El usuario terminó muy por debajo del tiempo disponible, sugiriendo que el pitch podría desarrollarse con más profundidad.
  - El usuario administró bien el tiempo y cubrió todos los puntos de la rúbrica dentro del límite.
- El dashboard visual debe mostrar el tiempo transcurrido vs. el máximo seleccionado (ej. barra de progreso o conteo regresivo durante la grabación).

## 8. Detección de muletillas

No requiere IA — se resuelve con matching simple (regex / keyword count) sobre la transcripción.

Lista inicial de muletillas a detectar (ajustable durante pruebas con la propia voz del usuario):

- "eeee" / "ehh"
- "o sea"
- "como les decía"
- "este..."
- "bueno pues"
- "a mi me tocó hablar de"
- "digamos"
- "en ese sentido"

El sistema cuenta ocurrencias por muletilla y las presenta en el dashboard (ej. "dijiste 'eeee' 12 veces").

## 9. MVP — Alcance dentro

El prototipo debe demostrar el ciclo completo:

**tipo de pitch + duración máxima → grabación de voz (con corte automático) → transcripción → análisis (muletillas + rúbrica + manejo del tiempo) → veredicto hablado + dashboard visual**

Debe incluir:

- [ ] Selector de tipo de pitch (4 opciones fijas).
- [ ] Selector de duración máxima (presets de 1 a 7 minutos).
- [ ] Grabación de audio desde el micrófono del navegador, con corte automático al alcanzar la duración máxima seleccionada.
- [ ] Transcripción de voz a texto (Web Speech API).
- [ ] Detección de muletillas por conteo simple.
- [ ] Evaluación de contenido contra la rúbrica del tipo elegido, vía LLM (Gemini), devolviendo JSON estructurado.
- [ ] Veredicto corto convertido a voz (SpeechSynthesis) y reproducido por el dispositivo de salida de audio (bocina Bluetooth).
- [ ] Dashboard visual con: transcripción completa, muletillas resaltadas con conteo, puntos de rúbrica cumplidos/faltantes, score numérico o visual.
- [ ] Sesión anónima, sin login — un intento completo funcional de punta a punta.

## 10. Fuera del alcance

Explícitamente no se construye en este MVP:

- Sistema de usuarios, login o perfiles.
- Persistencia de historial entre sesiones (base de datos). Si sobra tiempo, un segundo intento comparado **en memoria de la misma sesión** es aceptable, pero no persistencia real.
- Edición o creación de rúbricas custom por el usuario.
- Soporte multi-idioma (solo español).
- Análisis de video, lenguaje corporal o expresión facial — únicamente audio.
- Integración con n8n (se evaluó y se descartó: no aporta valor claro a un flujo lineal de 12h).
- Backend separado (NestJS u otro) — todo corre en un solo proyecto Next.js con API routes.

## 11. Qué debe demostrar la demo

Al finalizar una sesión corta, debe ser evidente que:

- El usuario realmente pitcheó en voz alta (no fue un texto pre-cargado).
- El sistema transcribió correctamente lo dicho.
- La detección de muletillas es real y específica (no genérica).
- La evaluación de rúbrica identificó puntos concretos cubiertos y faltantes del pitch real del usuario.
- El veredicto hablado y el dashboard visual coinciden y se refuerzan.

## 12. Uso de patrocinadores (orgánico)

- **Exa o Tavily** (opcional, si el tiempo lo permite): cuando la rúbrica detecta que el usuario no dio un dato concreto (ej. "el mercado es grande" sin cifra), el sistema busca en vivo una estadística real relacionada al tema del pitch y la sugiere como mejora en el dashboard. No es parte del loop crítico — es un enriquecimiento opcional.
- **n8n**: descartado para el MVP. No hay un flujo de orquestación multi-paso que lo justifique en 12 horas.

## 13. Stack técnico

### Frontend + Backend (proyecto único)
- **Next.js** (React) con **API routes** — un solo proyecto, un solo deploy. Las API routes corren server-side, ocultando la API key de Gemini del cliente.
- **Tailwind CSS** para estilos rápidos.

### Voz → Texto (STT)
- **Web Speech API** (`SpeechRecognition`) nativa del navegador — gratis, sin dependencias externas. Funciona en Chrome/Chromium (disponible en Linux Mint).
- **Requisito crítico de navegador**: `SpeechRecognition` solo tiene soporte confiable en navegadores basados en Chromium (Chrome, Chromium, Edge). **Brave no lo soporta** (decisión deliberada de privacidad del navegador) y **Firefox lo tiene deshabilitado por defecto** detrás de una flag. El desarrollo y la demo del hackathon deben hacerse en Chromium o Chrome — instalar con `sudo apt install chromium` en Linux Mint si no está disponible.
- Requiere conexión a internet activa (el reconocimiento de Chrome procesa el audio en servidores de Google) — riesgo a considerar si el wifi del venue falla.
- El componente `GrabadorVoz.tsx` debe detectar si el navegador no soporta `SpeechRecognition` y mostrar un mensaje claro en vez de fallar silenciosamente.
- **Fallback** (si la precisión falla en pruebas con acento/velocidad): Whisper API de OpenAI, llamada server-side con el audio grabado como blob. *(Nota: esto tendría costo — evaluar solo si Web Speech API falla de forma crítica en las pruebas previas al evento).*

### Análisis de contenido (LLM)
- **Gemini API (Flash / Flash-Lite)** — tier gratuito, sin costo, ya conocido por el desarrollador de otros proyectos.
- El prompt recibe: transcripción + tipo de pitch + rúbrica correspondiente.
- La respuesta se solicita en **JSON estructurado** (structured output) para mapear directo al dashboard sin parsing frágil. Ejemplo de forma esperada:

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

### Texto → Voz (TTS)
- **SpeechSynthesis API** nativa del navegador — base garantizada, sin costo, sin latencia de red.
- **Mejora opcional** (si sobra tiempo): ElevenLabs o OpenAI TTS para voz más natural. Se mantiene SpeechSynthesis como fallback en el código, nunca se reemplaza por completo.

### Detección de muletillas
- Lógica simple de regex/keyword matching, corre en frontend o en el mismo API route — no requiere LLM.

### Hardware
- Micrófono USB-C (ya disponible).
- Bocina Bluetooth para eventos (ya disponible) — **probar conexión antes del evento**; tener como plan B la salida de audio de la laptop por cable, ante posible saturación de Bluetooth con 300 asistentes conectando dispositivos simultáneamente.

### Deploy
- **Railway** (plan Hobby, $5/mes — ya activo). Un solo servicio (el proyecto Next.js completo).

### Costos totales del proyecto
- $0 adicionales fuera del plan Railway Hobby ya existente.

## 14. Orden de construcción sugerido (12 horas)

1. Setup del proyecto Next.js + primer deploy en Railway ("hola mundo" funcionando en producción desde el inicio).
2. Grabación de audio + transcripción con Web Speech API → mostrar texto en pantalla.
3. Conexión a Gemini API con una rúbrica hardcodeada (solo un tipo de pitch), pasando también la duración máxima seleccionada y el tiempo real que tomó el pitch como contexto del prompt desde el inicio → validar el JSON de respuesta antes de invertir en UI.
4. Detección de muletillas → integrar al output del análisis.
5. TTS nativo leyendo el veredicto corto → validar reproducción por bocina Bluetooth.
6. Dashboard visual (transcripción, muletillas resaltadas, rúbrica, score).
7. *(Si sobra tiempo)* Selector completo de los 4 tipos de pitch con sus rúbricas.
8. *(Si sobra tiempo)* Segundo intento en la misma sesión con comparación simple.
9. *(Si sobra tiempo)* Voz más natural (ElevenLabs/OpenAI TTS) y/o enriquecimiento con Exa/Tavily.

## 15. Corte de emergencia (si el tiempo aprieta)

Si a mitad del evento el tiempo se complica, el corte más seguro es:

- Quedarse con **un solo tipo de pitch** (ej. solo "Capital") en vez de los 4.
- Priorizar que el **loop completo funcione de punta a punta** (voz → análisis → voz + dashboard) antes que agregar más tipos de pitch o rúbricas.
- Un producto que hace una sola cosa bien, funcionando en vivo, vence a uno que promete cuatro y falla en la demo.

## 16. Entorno de desarrollo

- **SO**: Linux Mint (nativo).
- **Editor/Agentes**: Roo Code y Claude Code, con acceso al codebase del proyecto.
- **Flujo de trabajo**: prompts detallados generados de antemano → ejecutados por el agente dentro del proyecto → salida revisada y ajustada iterativamente.
