"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DuracionMaxima } from "@/types/pitch";
import type { EstadoCoach, ReaccionCoach } from "@/types/coach";
import { crearMotorReacciones, MENSAJES_COACH } from "@/lib/reacciones";
import CoachAvatar from "./CoachAvatar";

type EstadoGrabador = "inactivo" | "grabando" | "finalizado";

interface GrabadorVozProps {
  /** Duración máxima del pitch en minutos (presets 1–7, docs/alcance.md §7). */
  duracionMaxima: DuracionMaxima;
  /** Se dispara al terminar la grabación (manual o por límite de tiempo) con el texto completo. */
  onTranscripcionCompleta: (transcripcion: string) => void;
}

// Español latinoamericano (mercado objetivo LATAM). Si en pruebas con el acento
// del usuario la precisión falla, probar con "es-MX" o "es-ES".
const IDIOMA_RECONOCIMIENTO = "es-419";

const MENSAJE_NO_SOPORTADO =
  "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Chromium.";

// Duración de una reacción transitoria del coach (docs/alcance.md §5.1).
const DURACION_REACCION_MS = 1200;

// La Web Speech API vive en window.SpeechRecognition (estándar W3C) o en
// window.webkitSpeechRecognition (Chrome/Chromium/Edge). Tipos mínimos en
// src/types/web-speech.d.ts — TS 5.9 ya trae Alternative/Result/ResultList.
function obtenerConstructorReconocimiento():
  | (new () => SpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GrabadorVoz({
  duracionMaxima,
  onTranscripcionCompleta,
}: GrabadorVozProps) {
  const [estado, setEstado] = useState<EstadoGrabador>("inactivo");
  const [transcripcionFinal, setTranscripcionFinal] = useState("");
  const [transcripcionInterim, setTranscripcionInterim] = useState("");
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [duracionTotal, setDuracionTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Estado del coach visual (docs/alcance.md §5.1): "escuchando" por defecto.
  const [estadoCoach, setEstadoCoach] = useState<EstadoCoach>("escuchando");
  // Mensaje breve del coach (el humor va en el copy, no en el dibujo).
  const [mensajeCoach, setMensajeCoach] = useState<string | null>(null);

  // Motor de reacciones: detecta muletillas/frases de impacto NUEVAS sobre el
  // texto transcrito en vivo. Se crea una vez (las refs internas persisten).
  const motorReaccionesRef = useRef(crearMotorReacciones());
  // Texto ya evaluado por el motor, para no re-disparar en cada actualización.
  const textoEvaluadoRef = useRef("");
  // Marca temporal del último fragmento de texto recibido (para detectar
  // silencio prolongado → "mirandoReloj").
  const ultimoTextoRef = useRef(0);
  // Ref espejo del estado del coach: permite leer el estado actual desde
  // callbacks que cierran sobre el valor (onresult, intervalos) sin quedar obsoletos.
  const estadoCoachRef = useRef<EstadoCoach>("escuchando");
  // Timer que revierte las reacciones transitorias a "escuchando".
  const reaccionTimerRef = useRef<number | null>(null);

  const actualizarEstadoCoach = useCallback((nuevo: EstadoCoach) => {
    estadoCoachRef.current = nuevo;
    setEstadoCoach(nuevo);
  }, []);

  const limpiarTimerReaccion = useCallback(() => {
    if (reaccionTimerRef.current !== null) {
      window.clearTimeout(reaccionTimerRef.current);
      reaccionTimerRef.current = null;
    }
  }, []);

  const dispararReaccion = useCallback(
    (reaccion: ReaccionCoach) => {
      limpiarTimerReaccion();
      actualizarEstadoCoach(reaccion);
      const opciones = MENSAJES_COACH[reaccion];
      setMensajeCoach(opciones[Math.floor(Math.random() * opciones.length)]);
      // "asintiendo" y "mirandoReloj" persisten (se revierten desde el padre);
      // el resto vuelve a "escuchando" tras ~1.2s.
      if (reaccion !== "asintiendo" && reaccion !== "mirandoReloj") {
        reaccionTimerRef.current = window.setTimeout(() => {
          actualizarEstadoCoach("escuchando");
          setMensajeCoach(null);
          reaccionTimerRef.current = null;
        }, DURACION_REACCION_MS);
      }
    },
    [actualizarEstadoCoach, limpiarTimerReaccion],
  );

  const reconocimientoRef = useRef<SpeechRecognition | null>(null);
  const debeContinuarRef = useRef(false);
  const errorFatalRef = useRef(false);
  const transcripcionFinalRef = useRef("");
  const reinicioTimeoutRef = useRef<number | null>(null);

  // El soporte de la Web Speech API solo puede detectarse en el cliente.
  // useSyncExternalStore devuelve null en el servidor (getServerSnapshot) y el
  // valor real en el navegador (getSnapshot), evitando un mismatch de
  // hidratación sin necesidad de setState dentro de un effect.
  const soporte = useSyncExternalStore(
    () => () => {}, // El valor no cambia tras el mount: sin suscripción.
    () => Boolean(obtenerConstructorReconocimiento()),
    () => null,
  );

  const finalizar = useCallback(() => {
    debeContinuarRef.current = false;
    setTranscripcionFinal(transcripcionFinalRef.current);
    setTranscripcionInterim("");
    setEstado("finalizado");
    // El coach asiente al terminar: cierre de la grabación (docs/alcance.md §5.1).
    dispararReaccion("asintiendo");
    onTranscripcionCompleta(transcripcionFinalRef.current.trim());
  }, [dispararReaccion, onTranscripcionCompleta]);

  const reiniciarReconocimiento = useCallback(() => {
    const rec = reconocimientoRef.current;
    if (!rec || !debeContinuarRef.current) return;

    try {
      rec.start();
    } catch {
      // Caso conocido de Chrome: start() justo tras onend puede fallar por una
      // transición aún en curso. Se reintenta una vez, con un breve retraso.
      reinicioTimeoutRef.current = window.setTimeout(() => {
        if (!debeContinuarRef.current) return;
        try {
          rec.start();
        } catch {
          setError("No se pudo reiniciar el reconocimiento de voz.");
          setEstado("inactivo");
        }
      }, 300);
    }
  }, []);

  const manejarFin = useCallback(() => {
    if (errorFatalRef.current) {
      // Error irrecuperable (sin micrófono, sin permiso, sin red…): se vuelve
      // al estado inactivo conservando el mensaje de error, sin finalizar con
      // un texto parcial.
      debeContinuarRef.current = false;
      setEstado("inactivo");
      return;
    }
    if (debeContinuarRef.current) {
      // Chrome termina la sesión tras silencios largos: se reinicia sin avisar
      // al usuario (comportamiento normal, no es un fallo).
      reiniciarReconocimiento();
    } else {
      finalizar();
    }
  }, [finalizar, reiniciarReconocimiento]);

  const detenerGrabacion = useCallback(() => {
    debeContinuarRef.current = false;
    const rec = reconocimientoRef.current;
    if (!rec) {
      finalizar();
      return;
    }
    try {
      // stop() dispara onend de forma asíncrona, que es quien finaliza el estado.
      rec.stop();
    } catch {
      // El reconocimiento ya estaba detenido: se finaliza directamente.
      finalizar();
    }
  }, [finalizar]);

  const iniciarGrabacion = useCallback(() => {
    const Constructor = obtenerConstructorReconocimiento();
    if (!Constructor) {
      setError(MENSAJE_NO_SOPORTADO);
      return;
    }

    // Limpiar estado previo.
    transcripcionFinalRef.current = "";
    setTranscripcionFinal("");
    setTranscripcionInterim("");
    setError(null);
    setTiempoRestante(0);
    debeContinuarRef.current = true;
    errorFatalRef.current = false;

    const rec = new Constructor();
    rec.lang = IDIOMA_RECONOCIMIENTO;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        if (resultado.isFinal) {
          // Los resultados finales se acumulan; los intermedios solo se muestran.
          transcripcionFinalRef.current += resultado[0].transcript;
        } else {
          interim += resultado[0].transcript;
        }
      }
      setTranscripcionFinal(transcripcionFinalRef.current);
      setTranscripcionInterim(interim);

      // Coach visual: evaluar el texto completo (final + interim) y disparar la
      // reacción correspondiente (docs/alcance.md §5.1). Solo reacciona a
      // detecciones NUEVAS y resetea el timer de silencio cuando hay texto.
      const textoActual = (transcripcionFinalRef.current + interim).trim();
      if (textoActual && textoActual !== textoEvaluadoRef.current) {
        textoEvaluadoRef.current = textoActual;
        ultimoTextoRef.current = Date.now();
        const reaccion = motorReaccionesRef.current.evaluar(textoActual);
        if (reaccion !== null) {
          dispararReaccion(reaccion);
        } else if (estadoCoachRef.current === "mirandoReloj") {
          // Volvió a hablar: el coach deja de mirar el reloj y escucha.
          actualizarEstadoCoach("escuchando");
          setMensajeCoach(null);
        }
      }
    };

    rec.onerror = (event) => {
      // no-speech y aborted son normales (silencio / detención manual): onend
      // decide el siguiente paso, no se muestra ningún mensaje.
      switch (event.error) {
        case "no-speech":
        case "aborted":
          return;
        case "not-allowed":
        case "service-not-allowed":
          errorFatalRef.current = true;
          setError(
            "No se pudo acceder al micrófono. Permite el acceso e intenta de nuevo.",
          );
          return;
        case "audio-capture":
          errorFatalRef.current = true;
          setError("No se encontró un micrófono disponible.");
          return;
        case "network":
          errorFatalRef.current = true;
          setError(
            "Error de red al conectar con el servicio de reconocimiento de voz.",
          );
          return;
        case "language-not-supported":
          errorFatalRef.current = true;
          setError(
            "El idioma de reconocimiento no está soportado en este navegador.",
          );
          return;
        default:
          errorFatalRef.current = true;
          setError(
            "Ocurrió un error durante el reconocimiento de voz. Intenta de nuevo.",
          );
          return;
      }
    };

    rec.onend = manejarFin;

    reconocimientoRef.current = rec;

    try {
      rec.start();
    } catch {
      setError("No se pudo iniciar el reconocimiento de voz.");
      setEstado("inactivo");
      return;
    }

    // Arrancar el countdown con la duración capturada al inicio, para que un
    // cambio del selector a mitad de grabación no reinicie el temporizador.
    setDuracionTotal(duracionMaxima * 60);
    setTiempoRestante(duracionMaxima * 60);
    setEstado("grabando");
  }, [actualizarEstadoCoach, dispararReaccion, duracionMaxima, manejarFin]);

  const reiniciar = useCallback(() => {
    setEstado("inactivo");
    setTranscripcionFinal("");
    setTranscripcionInterim("");
    setTiempoRestante(0);
    setDuracionTotal(0);
    setError(null);
    transcripcionFinalRef.current = "";
    debeContinuarRef.current = false;
    errorFatalRef.current = false;
    reconocimientoRef.current = null;
    // Coach visual: volver a "escuchando" y limpiar el motor para la nueva
    // grabación (docs/alcance.md §5.1).
    limpiarTimerReaccion();
    actualizarEstadoCoach("escuchando");
    setMensajeCoach(null);
    motorReaccionesRef.current.reset();
    textoEvaluadoRef.current = "";
    ultimoTextoRef.current = 0;
  }, [actualizarEstadoCoach, limpiarTimerReaccion]);

  // Intervalo que decrementa el tiempo restante mientras se graba.
  useEffect(() => {
    if (estado !== "grabando") return;
    const id = window.setInterval(() => {
      setTiempoRestante((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [estado]);

  // Corte automático al alcanzar la duración máxima seleccionada.
  useEffect(() => {
    if (estado === "grabando" && tiempoRestante <= 0) {
      detenerGrabacion();
    }
  }, [estado, tiempoRestante, detenerGrabacion]);

  // Silencio prolongado (~3s sin texto nuevo) mientras se graba → el coach
  // mira el reloj (docs/alcance.md §5.1). Se dispara solo si no está ya en
  // esa reacción; persiste hasta que el usuario vuelve a hablar (ver onresult).
  useEffect(() => {
    if (estado !== "grabando") return;
    const id = window.setInterval(() => {
      if (
        Date.now() - ultimoTextoRef.current > 3000 &&
        estadoCoachRef.current === "escuchando"
      ) {
        dispararReaccion("mirandoReloj");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [dispararReaccion, estado]);

  // Limpieza al desmontar: detener el reconocimiento y cualquier reinicio
  // pendiente para no dejar el micrófono activo de fondo.
  useEffect(() => {
    return () => {
      debeContinuarRef.current = false;
      if (reinicioTimeoutRef.current !== null) {
        window.clearTimeout(reinicioTimeoutRef.current);
      }
      reconocimientoRef.current?.abort();
    };
  }, []);

  if (soporte === null) {
    return null; // Evita un flash de "no soportado" durante el primer render.
  }

  if (soporte === false) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
      >
        <p className="font-semibold">Reconocimiento de voz no disponible</p>
        <p className="mt-1 text-sm">{MENSAJE_NO_SOPORTADO}</p>
      </div>
    );
  }

  const textoTranscrito = (transcripcionFinal + transcripcionInterim).trim();
  const totalSegundos = duracionTotal;
  const progreso =
    totalSegundos > 0
      ? Math.min(100, ((totalSegundos - tiempoRestante) / totalSegundos) * 100)
      : 0;

  return (
    <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800">Grabación</h2>
        {estado === "grabando" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Grabando
          </span>
        )}
      </div>

      {/* Coach visual: escucha y reacciona en vivo durante la grabación
          (docs/alcance.md §5.1). */}
      <div className="mt-4 flex justify-center">
        <CoachAvatar estado={estadoCoach} mensaje={mensajeCoach} />
      </div>

      {estado === "grabando" && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm text-zinc-500">
            <span>Tiempo restante</span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-900">
              {formatoTiempo(tiempoRestante)}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 min-h-32 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {estado === "finalizado" ? "Transcripción final" : "Transcripción"}
        </p>
        {textoTranscrito ? (
          <p className="whitespace-pre-wrap text-zinc-800">{textoTranscrito}</p>
        ) : (
          <p className="text-zinc-400">
            {estado === "grabando"
              ? "Habla ahora… la transcripción aparecerá en tiempo real."
              : estado === "finalizado"
                ? "No se capturó ninguna transcripción."
                : "Aquí se mostrará la transcripción de tu pitch."}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5">
        {estado === "inactivo" && (
          <button
            type="button"
            onClick={iniciarGrabacion}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Comenzar a grabar
          </button>
        )}
        {estado === "grabando" && (
          <button
            type="button"
            onClick={detenerGrabacion}
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Detener grabación
          </button>
        )}
        {estado === "finalizado" && (
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Grabar de nuevo
          </button>
        )}
      </div>
    </section>
  );
}
