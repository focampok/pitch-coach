import type { Diccionario } from "./diccionario-es";

// Diccionario en inglés. Tipado contra la forma del español: si acá falta una
// clave o sobra una que no existe en `es.ts`, `tsc` falla en el build.

export const en: Diccionario = {
  // --- Selector de idioma --------------------------------------------------
  selectorIdioma: {
    etiqueta: "Language",
  },

  // --- Textos compartidos entre pantallas ----------------------------------
  comun: {
    tipoPitch: {
      capital: "Capital",
      educacion: "Education",
      innovacion: "Innovation",
      tecnologia: "Technology",
    },
    minutos: (cantidad: number) => `${cantidad} ${cantidad === 1 ? "minute" : "minutes"}`,
  },

  // --- Pantalla principal (src/app/page.tsx) -------------------------------
  inicio: {
    subtitulo: "Pick the pitch type and the maximum length before you practice.",
    tipoPitch: "Pitch type",
    duracionMaxima: "Maximum length",
    resumenPitch: (tipo: string, duracion: string) => `${tipo} pitch — ${duracion}`,
    verProgreso: "Your progress",
    ocultarProgreso: "Hide progress",
    analizando: "Analyzing your pitch…",
    errorAnalisis: "Could not analyze the pitch.",
    errorAnalisisInesperado: "Unexpected error while analyzing the pitch.",
  },

  // --- Selector de tipo de pitch (descripciones de cada tarjeta) -----------
  selectorTipoPitch: {
    capital: "Problem, market, traction and the ask",
    educacion: "Learning goal and pedagogical structure",
    innovacion: "Differentiated proposal, validation and impact",
    tecnologia: "Technical problem, stack and differentiator",
  },

  // --- Grabador de voz (src/components/GrabadorVoz.tsx) --------------------
  grabador: {
    titulo: "Recording",
    grabando: "Recording",
    escuchando: "Listening…",
    transcribiendo: "Transcribing…",
    tiempoRestante: "Time left",
    transcripcionFinal: "Final transcript",
    transcripcion: "Transcript",
    esperandoGrabacion: "Recording… the transcript will appear when you stop.",
    transcribiendoAudio: "Transcribing the audio…",
    sinTranscripcion: "No transcript was captured.",
    transcripcionVacia: "Your pitch transcript will show up here.",
    ayudaRespaldo: "If you can't use the microphone, type the text.",
    ayudaSinSoporte: "This browser can't record audio. Type the text.",
    placeholderRespaldo: "Type your pitch or answer…",
    enviarTexto: "Send text",
    comenzar: "Start recording",
    detener: "Stop recording",
    transcribiendoEspera: "Transcribing… hang on a moment.",
    grabarDeNuevo: "Record again",
    errorTextoVacio: "The text is empty. Type your pitch or answer.",
    errorTranscripcion: "Could not transcribe the audio.",
    errorTranscripcionInesperado:
      "Could not transcribe the audio. Try again or type the text.",
    errorMicrofonoSinSoporte: "Could not reach the microphone. You can type the text.",
    errorMicrofonoSinPermiso:
      "Could not reach the microphone. Allow access or type the text.",
    errorGrabacion: "Something went wrong while recording. Try again.",
    errorSinAudio: "No audio was captured. Try again or type the text.",
    errorInicioGrabacion: "Could not start recording. Try again or type the text.",
  },

  // --- Panel "Tu progreso" (src/components/PanelProgreso.tsx) --------------
  progreso: {
    titulo: "Your progress",
    borrar: "Delete history",
    confirmarBorrado: "Delete this browser's history?",
    vacio: "No saved sessions in this browser yet.",
    score: (puntos: number) => `Score ${puntos}`,
    rubrica: (cumplidos: number, total: number) => `Rubric ${cumplidos}/${total}`,
    ultra: "Ultra",
    hallazgos: (reforzados: number, hechas: number) => `Findings ${reforzados}/${hechas}`,
  },

  // --- Dashboard del análisis (src/components/DashboardResultado.tsx) -----
  dashboard: {
    rubrica: "Rubric",
    rubricaUltra: "Rubric (Ultra)",
    muletillas: (total: number) => `Filler words (${total})`,
    sinMuletillas: "None detected — good control.",
    transcripcion: "Transcript",
    descargarGuion: "Download script",
    archivoGuion: "pitch-script.txt",
    datosSugeridos: "Data that could back up your pitch",
    buscando: "Searching…",
    sinSugerencias: "No verified suggestions for now.",
    fuente: "Source",
    escucharDato: "Listen to the figure",
    analisisUltra: "Ultra analysis",
    reanalizando: "Re-analyzing with Nemotron Ultra…",
    tituloUltra: "Ultra analysis — extended reasoning with Nemotron Ultra",
    traza: "Reasoning trace",
    tiempoUsado: (real: number, maximo: number) => `${real}s of ${maximo}s used`,
    errorReanalisis: "Could not re-analyze the pitch.",
    errorReanalisisInesperado: "Unexpected error while re-analyzing the pitch.",
  },

  // --- Resolver hallazgos (src/components/SparringCoach.tsx) ---------------
  sparring: {
    titulo: "Resolve findings",
    resolver: "Resolve findings",
    oferta: (cantidad: number) =>
      `${cantidad} ${cantidad === 1 ? "finding" : "findings"} left (rubric points you didn't cover). You can work through them with follow-up questions (up to 3, in rubric order).`,
    preparando: (actual: number, total: number) =>
      `Preparing question ${actual} of ${total}…`,
    punto: (nombre: string, actual: number, total: number) =>
      `Point: ${nombre} (${actual}/${total})`,
    escucharPregunta: "Listen to the question",
    evaluando: "Evaluating your answer…",
    cubierto: "Covered",
    pendiente: "Still missing",
    verResumen: "See summary",
    siguiente: "Next question",
    resumen: (reforzados: number, total: number) =>
      `You resolved ${reforzados} of ${total} findings.`,
    errorRespuestaVacia: "The answer is empty. Try again.",
    errorGenerarPregunta: "Could not generate the question.",
    errorGenerarPreguntaInesperado: "Error while generating the question.",
    errorEvaluarRespuesta: "Could not evaluate the answer.",
    errorEvaluarRespuestaInesperado: "Error while evaluating the answer.",
  },

  // --- Reproductor del veredicto (src/components/ReproductorVeredicto.tsx) -
  reproductor: {
    escucharVeredicto: "Listen to the verdict",
    conectando: "Connecting to the coach…",
    hablando: "Speaking",
    hablandoElevenlabs: "Speaking (ElevenLabs)",
    error: "Could not play — retry",
  },

  // --- Mensajes de las API routes (src/app/api/**) -------------------------
  // Los ve el usuario final: se devuelven en el idioma que pidió la petición.
  api: {
    jsonInvalido: "Invalid request body (JSON required).",
    idiomaInvalido: "Invalid language. Must be 'es' or 'en'.",
    // Análisis
    transcripcionObligatoria: "The transcript is required and cannot be empty.",
    tipoPitchInvalido:
      "Invalid pitch type. Must be capital, educacion, innovacion or tecnologia.",
    duracionInvalida: "Invalid maximum length. Must be a preset from 1 to 7 minutes.",
    tiempoRealInvalido: "Invalid tiempoRealSegundos. Must be a non-negative number.",
    nivelInvalido: "Invalid level. Must be estandar, ultra or rapido.",
    analisisFallido:
      "We couldn't analyze the pitch right now. Please try again in a few seconds.",
    // Resolver hallazgos
    puntoObligatorio: "The rubric point is required.",
    puntoFueraDeRubrica: "That point does not belong to the rubric for this pitch type.",
    preguntaObligatoria: "The question is required.",
    respuestaObligatoria: "The answer is required and cannot be empty.",
    preguntaFallida:
      "We couldn't generate the question right now. Please try again in a few seconds.",
    evaluacionFallida:
      "We couldn't evaluate the answer right now. Please try again in a few seconds.",
    // Transcripción de audio
    cuerpoInvalido: "Invalid request body.",
    faltaAudio: "The audio is missing.",
    formatoAudioNoSoportado: "Unsupported audio format.",
    transcripcionFallida: "We couldn't transcribe the audio right now.",
    // TTS
    faltaTexto: "'texto' is missing.",
    ttsFallido: "We couldn't generate the audio right now.",
    // Enriquecimiento (Tavily)
    enriquecimientoInvalido: "Invalid JSON.",
    // Límites de entrada (400/413), compartidos por varias rutas
    transcripcionLarga:
      "The transcript goes over the 8000-character limit. Shorten the pitch or split the recording.",
    respuestaSparringLarga: "The answer goes over the 2000-character limit. Keep it shorter.",
    puntoSparringLargo: "The rubric point goes over the allowed limit.",
    preguntaSparringLarga: "The follow-up question goes over the allowed limit.",
    audioGrande: "The audio goes over the maximum allowed size. Shorten the recording.",
    // Rate limit
    demasiadasSolicitudes: "Too many requests. Wait a moment and try again.",
  },

  // --- Error boundaries (src/app/error.tsx, src/app/global-error.tsx) ------
  errores: {
    titulo: "Something went wrong",
    mensaje:
      "An unexpected error happened and we couldn't show this screen. The team has already been notified.",
    reintentar: "Retry",
  },
};
