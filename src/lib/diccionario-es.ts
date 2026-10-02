// Diccionario en español — FUENTE DE VERDAD DE LA FORMA.
//
// `Diccionario` se deriva de este objeto, y `en.ts` se tipa con esa interfaz:
// si a un idioma le falta (o le sobra) una clave, `tsc` falla. Lo mismo verifica
// en runtime `test/diccionarios.test.ts`, que compara las dos formas clave por
// clave.
//
// Convenciones:
// - Textos planos: string.
// - Textos con partes variables o plural: función. Así el llamador no arma
//   frases concatenando trozos, que es donde se rompen los idiomas.
// - El código se escribe en inglés; acá el contenido es contenido de producto.
//
// Lo que NO vive acá: los nombres y descripciones de los puntos de rúbrica
// (están en src/lib/rubricas.ts, junto a sus ids) y los mensajes del avatar
// (Parte B).

export const es = {
  // --- Selector de idioma --------------------------------------------------
  selectorIdioma: {
    /** Etiqueta accesible del grupo de botones. */
    etiqueta: "Idioma",
  },

  // --- Textos compartidos entre pantallas ----------------------------------
  comun: {
    tipoPitch: {
      capital: "Capital",
      educacion: "Educación",
      innovacion: "Innovación",
      tecnologia: "Tecnología",
    },
    minutos: (cantidad: number) => `${cantidad} ${cantidad === 1 ? "minuto" : "minutos"}`,
  },

  // --- Pantalla principal (src/app/page.tsx) -------------------------------
  inicio: {
    subtitulo: "Elige el tipo de pitch y la duración máxima antes de practicar.",
    tipoPitch: "Tipo de pitch",
    duracionMaxima: "Duración máxima",
    resumenPitch: (tipo: string, duracion: string) => `Pitch de ${tipo} — ${duracion}`,
    verProgreso: "Tu progreso",
    ocultarProgreso: "Ocultar progreso",
    analizando: "Analizando tu pitch…",
    errorAnalisis: "Error al analizar el pitch.",
    errorAnalisisInesperado: "Error inesperado al analizar el pitch.",
  },

  // --- Selector de tipo de pitch (descripciones de cada tarjeta) -----------
  selectorTipoPitch: {
    capital: "Problema, mercado, tracción y ask",
    educacion: "Objetivo de aprendizaje y estructura pedagógica",
    innovacion: "Propuesta diferenciada, validación e impacto",
    tecnologia: "Problema técnico, stack y diferenciador",
  },

  // --- Grabador de voz (src/components/GrabadorVoz.tsx) --------------------
  grabador: {
    titulo: "Grabación",
    grabando: "Grabando",
    escuchando: "Escuchando…",
    transcribiendo: "Transcribiendo…",
    tiempoRestante: "Tiempo restante",
    transcripcionFinal: "Transcripción final",
    transcripcion: "Transcripción",
    esperandoGrabacion: "Grabando… la transcripción aparecerá al terminar.",
    transcribiendoAudio: "Transcribiendo el audio…",
    sinTranscripcion: "No se capturó ninguna transcripción.",
    transcripcionVacia: "Aquí se mostrará la transcripción de tu pitch.",
    ayudaRespaldo: "Si no puedes usar el micrófono, escribe el texto.",
    ayudaSinSoporte: "Este navegador no puede grabar audio. Escribe el texto.",
    placeholderRespaldo: "Escribe tu pitch o respuesta…",
    enviarTexto: "Enviar texto",
    comenzar: "Comenzar a grabar",
    detener: "Detener grabación",
    transcribiendoEspera: "Transcribiendo… espera un momento.",
    grabarDeNuevo: "Grabar de nuevo",
    errorTextoVacio: "El texto está vacío. Escribe tu pitch o respuesta.",
    errorTranscripcion: "No se pudo transcribir el audio.",
    errorTranscripcionInesperado:
      "No se pudo transcribir el audio. Intenta de nuevo o escribe el texto.",
    errorMicrofonoSinSoporte: "No se pudo acceder al micrófono. Puedes escribir el texto.",
    errorMicrofonoSinPermiso:
      "No se pudo acceder al micrófono. Permite el acceso o escribe el texto.",
    errorGrabacion: "Ocurrió un error durante la grabación. Intenta de nuevo.",
    errorSinAudio: "No se capturó audio. Intenta de nuevo o escribe el texto.",
    errorInicioGrabacion:
      "No se pudo iniciar la grabación. Intenta de nuevo o escribe el texto.",
  },

  // --- Panel "Tu progreso" (src/components/PanelProgreso.tsx) --------------
  progreso: {
    titulo: "Tu progreso",
    borrar: "Borrar historial",
    confirmarBorrado: "¿Borrar el historial de este navegador?",
    vacio: "Todavía no hay sesiones guardadas en este navegador.",
    score: (puntos: number) => `Score ${puntos}`,
    rubrica: (cumplidos: number, total: number) => `Rúbrica ${cumplidos}/${total}`,
    ultra: "Ultra",
    hallazgos: (reforzados: number, hechas: number) => `Hallazgos ${reforzados}/${hechas}`,
  },

  // --- Dashboard del análisis (src/components/DashboardResultado.tsx) -----
  dashboard: {
    rubrica: "Rúbrica",
    rubricaUltra: "Rúbrica (Ultra)",
    muletillas: (total: number) => `Muletillas (${total})`,
    sinMuletillas: "Ninguna detectada — buen control.",
    transcripcion: "Transcripción",
    datosSugeridos: "Datos que podrían reforzar tu pitch",
    buscando: "Buscando…",
    sinSugerencias: "Sin sugerencias verificadas por ahora.",
    fuente: "Fuente",
    escucharDato: "Escuchar el dato",
    analisisUltra: "Análisis Ultra",
    reanalizando: "Reanalizando con Nemotron Ultra…",
    tituloUltra: "Análisis Ultra — razonamiento extendido con Nemotron Ultra",
    traza: "Traza del razonamiento",
    tiempoUsado: (real: number, maximo: number) => `${real}s de ${maximo}s usados`,
    errorReanalisis: "Error al reanalizar el pitch.",
    errorReanalisisInesperado: "Error inesperado al reanalizar el pitch.",
  },

  // --- Resolver hallazgos (src/components/SparringCoach.tsx) ---------------
  sparring: {
    titulo: "Resolver hallazgos",
    resolver: "Resolver hallazgos",
    oferta: (cantidad: number) =>
      `Quedaron ${cantidad} ${cantidad === 1 ? "hallazgo" : "hallazgos"} (puntos de la rúbrica sin cubrir). Puedes resolverlos con preguntas de seguimiento (máximo 3, en el orden de la rúbrica).`,
    preparando: (actual: number, total: number) =>
      `Preparando la pregunta ${actual} de ${total}…`,
    punto: (nombre: string, actual: number, total: number) =>
      `Punto: ${nombre} (${actual}/${total})`,
    escucharPregunta: "Escuchar pregunta",
    evaluando: "Evaluando tu respuesta…",
    cubierto: "Cubierto",
    pendiente: "Aún pendiente",
    verResumen: "Ver resumen",
    siguiente: "Siguiente pregunta",
    resumen: (reforzados: number, total: number) =>
      `Resolviste ${reforzados} de ${total} hallazgos.`,
    errorRespuestaVacia: "La respuesta está vacía. Intenta de nuevo.",
    errorGenerarPregunta: "No se pudo generar la pregunta.",
    errorGenerarPreguntaInesperado: "Error al generar la pregunta.",
    errorEvaluarRespuesta: "No se pudo evaluar la respuesta.",
    errorEvaluarRespuestaInesperado: "Error al evaluar la respuesta.",
  },

  // --- Reproductor del veredicto (src/components/ReproductorVeredicto.tsx) -
  reproductor: {
    escucharVeredicto: "Escuchar veredicto",
    conectando: "Conectando con el coach…",
    hablando: "Hablando",
    hablandoElevenlabs: "Hablando (ElevenLabs)",
    error: "No se pudo reproducir — reintentar",
  },

  // --- Mensajes de las API routes (src/app/api/**) -------------------------
  // Los ve el usuario final: se devuelven en el idioma que pidió la petición.
  api: {
    jsonInvalido: "Cuerpo de la petición inválido (JSON requerido).",
    idiomaInvalido: "Idioma inválido. Debe ser 'es' o 'en'.",
    // Análisis
    transcripcionObligatoria: "La transcripción es obligatoria y no puede estar vacía.",
    tipoPitchInvalido:
      "Tipo de pitch inválido. Debe ser capital, educacion, innovacion o tecnologia.",
    duracionInvalida: "Duración máxima inválida. Debe ser un preset de 1 a 7 minutos.",
    tiempoRealInvalido: "tiempoRealSegundos inválido. Debe ser un número no negativo.",
    nivelInvalido: "Nivel inválido. Debe ser estandar, ultra o rapido.",
    analisisFallido:
      "No se pudo analizar el pitch en este momento. Inténtalo de nuevo en unos segundos.",
    // Resolver hallazgos
    puntoObligatorio: "El punto de la rúbrica es obligatorio.",
    puntoFueraDeRubrica: "El punto no pertenece a la rúbrica de este tipo de pitch.",
    preguntaObligatoria: "La pregunta es obligatoria.",
    respuestaObligatoria: "La respuesta es obligatoria y no puede estar vacía.",
    preguntaFallida:
      "No se pudo generar la pregunta en este momento. Inténtalo de nuevo en unos segundos.",
    evaluacionFallida:
      "No se pudo evaluar la respuesta en este momento. Inténtalo de nuevo en unos segundos.",
    // Transcripción de audio
    cuerpoInvalido: "Cuerpo de la petición inválido.",
    faltaAudio: "Falta el audio.",
    formatoAudioNoSoportado: "Formato de audio no soportado.",
    transcripcionFallida: "No se pudo transcribir el audio en este momento.",
    // TTS
    faltaTexto: "Falta 'texto'.",
    ttsFallido: "No se pudo generar el audio en este momento.",
    // Enriquecimiento (Tavily)
    enriquecimientoInvalido: "JSON inválido.",
    // Límites de entrada (400/413), compartidos por varias rutas
    transcripcionLarga:
      "La transcripción supera el máximo de 8000 caracteres. Acorta el pitch o divide la grabación.",
    respuestaSparringLarga: "La respuesta supera el máximo de 2000 caracteres. Sé más breve.",
    puntoSparringLargo: "El punto de la rúbrica supera el máximo permitido.",
    preguntaSparringLarga: "La pregunta de sparring supera el máximo permitido.",
    audioGrande: "El audio supera el tamaño máximo permitido. Acorta la grabación.",
    // Rate limit
    demasiadasSolicitudes: "Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.",
  },

  // --- Error boundaries (src/app/error.tsx, src/app/global-error.tsx) ------
  errores: {
    titulo: "Algo salió mal",
    mensaje:
      "Ocurrió un error inesperado y no pudimos mostrar esta pantalla. El equipo ya fue notificado.",
    reintentar: "Reintentar",
  },
};

/**
 * Forma del diccionario. Se deriva del español para que agregar una clave sea
 * agregarla en `es.ts` y que el compilador exija el resto de los idiomas.
 */
export type Diccionario = typeof es;
