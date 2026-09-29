"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DuracionMaxima } from "@/types/pitch";
import {
  elegirMensajeAsintiendo,
  textoIndicadorCoach,
  type EstadoGrabador,
} from "@/lib/mensajes-coach";
import { cabecerasIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";

interface GrabadorVozProps {
  /** Duración máxima del pitch en minutos (presets 1–7, docs/alcance.md §7). */
  duracionMaxima: DuracionMaxima;
  /**
   * Se dispara al terminar (grabación + transcripción, o envío de texto de
   * respaldo) con el texto completo y el tiempo real en segundos
   * (docs/alcance.md §7: el tiempo usado entra como contexto de la evaluación).
   */
  onTranscripcionCompleta: (transcripcion: string, tiempoRealSegundos: number) => void;
}

const MIME_CANDIDATOS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

function formatoTiempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function capturaDisponible(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Elige el MIME que este navegador puede grabar. Scribe acepta webm y mp4. */
function mimeGrabacion(): string {
  for (const mime of MIME_CANDIDATOS) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function nombreArchivo(mime: string): string {
  if (mime.includes("mp4")) return "grabacion.mp4";
  if (mime.includes("ogg")) return "grabacion.ogg";
  return "grabacion.webm";
}

export default function GrabadorVoz({
  duracionMaxima,
  onTranscripcionCompleta,
}: GrabadorVozProps) {
  const { idioma, textos } = useIdioma();
  const [estado, setEstado] = useState<EstadoGrabador>("inactivo");
  const [transcripcionFinal, setTranscripcionFinal] = useState("");
  const [textoRespaldo, setTextoRespaldo] = useState("");
  const [mostrarRespaldo, setMostrarRespaldo] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [duracionTotal, setDuracionTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensajeCoach, setMensajeCoach] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("");
  const abortTranscripcionRef = useRef<AbortController | null>(null);
  const tiempoRestanteRef = useRef(0);
  const duracionTotalRef = useRef(0);

  const soporte = useSyncExternalStore(
    () => () => {},
    () => capturaDisponible(),
    () => null,
  );

  const soltarMicrófono = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const finalizarConTexto = useCallback(
    (texto: string, tiempoRealSegundos: number) => {
      setTranscripcionFinal(texto);
      setEstado("finalizado");
      setMensajeCoach(elegirMensajeAsintiendo(idioma));
      onTranscripcionCompleta(texto, tiempoRealSegundos);
    },
    [idioma, onTranscripcionCompleta],
  );

  const transcribirBlob = useCallback(
    async (blob: Blob, tiempoRealSegundos: number) => {
      setEstado("transcribiendo");
      setError(null);
      abortTranscripcionRef.current?.abort();
      const controller = new AbortController();
      abortTranscripcionRef.current = controller;

      try {
        const form = new FormData();
        form.append("audio", blob, nombreArchivo(blob.type || mimeRef.current));
        form.append("idioma", idioma);
        const respuesta = await fetch("/api/transcribir", {
          method: "POST",
          headers: cabecerasIdioma(idioma),
          body: form,
          signal: controller.signal,
        });
        const cuerpo = (await respuesta.json()) as { texto?: string; error?: string };
        if (!respuesta.ok || typeof cuerpo.texto !== "string") {
          throw new Error(cuerpo.error ?? textos.grabador.errorTranscripcion);
        }
        const texto = cuerpo.texto.trim();
        finalizarConTexto(texto, tiempoRealSegundos);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : textos.grabador.errorTranscripcionInesperado,
        );
        setEstado("inactivo");
        setMostrarRespaldo(true);
        setMensajeCoach(null);
      }
    },
    [finalizarConTexto, idioma, textos],
  );

  const detenerGrabacion = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      soltarMicrófono();
      return;
    }
    try {
      recorder.stop();
    } catch {
      soltarMicrófono();
      setEstado("inactivo");
    }
  }, [soltarMicrófono]);

  const iniciarGrabacion = useCallback(async () => {
    if (!capturaDisponible()) {
      setMostrarRespaldo(true);
      setError(textos.grabador.errorMicrofonoSinSoporte);
      return;
    }

    setError(null);
    setTranscripcionFinal("");
    setTextoRespaldo("");
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMostrarRespaldo(true);
      setError(textos.grabador.errorMicrofonoSinPermiso);
      return;
    }

    const mime = mimeGrabacion();
    mimeRef.current = mime;
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);

    streamRef.current = stream;
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      soltarMicrófono();
      setError(textos.grabador.errorGrabacion);
      setEstado("inactivo");
      setMostrarRespaldo(true);
    };

    recorder.onstop = () => {
      const tiempoRealSegundos = Math.max(
        0,
        duracionTotalRef.current - tiempoRestanteRef.current,
      );
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeRef.current || "audio/webm",
      });
      soltarMicrófono();
      if (blob.size === 0) {
        setError(textos.grabador.errorSinAudio);
        setEstado("inactivo");
        setMostrarRespaldo(true);
        return;
      }
      void transcribirBlob(blob, tiempoRealSegundos);
    };

    try {
      recorder.start();
    } catch {
      soltarMicrófono();
      setError(textos.grabador.errorInicioGrabacion);
      setMostrarRespaldo(true);
      return;
    }

    setDuracionTotal(duracionMaxima * 60);
    duracionTotalRef.current = duracionMaxima * 60;
    setTiempoRestante(duracionMaxima * 60);
    tiempoRestanteRef.current = duracionMaxima * 60;
    setEstado("grabando");
    setMensajeCoach(null);
    setMostrarRespaldo(false);
  }, [duracionMaxima, soltarMicrófono, textos, transcribirBlob]);

  const enviarTextoRespaldo = useCallback(() => {
    const texto = textoRespaldo.trim();
    if (texto === "") {
      setError(textos.grabador.errorTextoVacio);
      return;
    }
    setError(null);
    finalizarConTexto(texto, 0);
  }, [finalizarConTexto, textos, textoRespaldo]);

  const reiniciar = useCallback(() => {
    abortTranscripcionRef.current?.abort();
    abortTranscripcionRef.current = null;
    soltarMicrófono();
    setEstado("inactivo");
    setTranscripcionFinal("");
    setTextoRespaldo("");
    setTiempoRestante(0);
    setDuracionTotal(0);
    duracionTotalRef.current = 0;
    tiempoRestanteRef.current = 0;
    setError(null);
    setMostrarRespaldo(false);
    setMensajeCoach(null);
  }, [soltarMicrófono]);

  useEffect(() => {
    if (estado !== "grabando") return;
    const id = window.setInterval(() => {
      const siguiente = Math.max(0, tiempoRestanteRef.current - 1);
      tiempoRestanteRef.current = siguiente;
      setTiempoRestante(siguiente);
      if (siguiente <= 0) detenerGrabacion();
    }, 1000);
    return () => window.clearInterval(id);
  }, [detenerGrabacion, estado]);

  useEffect(() => {
    return () => {
      abortTranscripcionRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (soporte === null) {
    return null;
  }

  const totalSegundos = duracionTotal;
  const progreso =
    totalSegundos > 0
      ? Math.min(100, ((totalSegundos - tiempoRestante) / totalSegundos) * 100)
      : 0;
  const indicadorCoach = textoIndicadorCoach(estado, mensajeCoach, textos);

  return (
    <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800">{textos.grabador.titulo}</h2>
        {estado === "grabando" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {textos.grabador.grabando}
          </span>
        )}
        {estado === "transcribiendo" && (
          <span
            role="status"
            className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {textos.grabador.transcribiendo}
          </span>
        )}
      </div>

      {/* Indicador del coach: temporal, solo texto. El reemplazo visual
          (animación tipo esfera) llega en la fase de UX/UI. */}
      {indicadorCoach !== null && (
        <p className="mt-4 text-center text-sm font-medium text-zinc-600">
          {indicadorCoach}
        </p>
      )}
      {/* El texto visible ya no es región viva; se anuncia solo la frase final. */}
      {estado === "finalizado" && mensajeCoach !== null && (
        <p className="sr-only" aria-live="polite">
          {mensajeCoach}
        </p>
      )}

      {estado === "grabando" && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm text-zinc-500">
            <span>{textos.grabador.tiempoRestante}</span>
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
          {estado === "finalizado" ? textos.grabador.transcripcionFinal : textos.grabador.transcripcion}
        </p>
        {transcripcionFinal ? (
          <p className="whitespace-pre-wrap text-zinc-800">{transcripcionFinal}</p>
        ) : (
          <p className="text-zinc-400">
            {estado === "grabando"
              ? textos.grabador.esperandoGrabacion
              : estado === "transcribiendo"
                ? textos.grabador.transcribiendoAudio
                : estado === "finalizado"
                  ? textos.grabador.sinTranscripcion
                  : textos.grabador.transcripcionVacia}
          </p>
        )}
      </div>

      {(soporte === false || mostrarRespaldo) &&
        estado !== "grabando" &&
        estado !== "transcribiendo" &&
        estado !== "finalizado" && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            enviarTextoRespaldo();
          }}
        >
          <p className="text-sm text-zinc-600">
            {soporte
              ? textos.grabador.ayudaRespaldo
              : textos.grabador.ayudaSinSoporte}
          </p>
          <textarea
            value={textoRespaldo}
            onChange={(event) => setTextoRespaldo(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-800"
            placeholder={textos.grabador.placeholderRespaldo}
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {textos.grabador.enviarTexto}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5">
        {estado === "inactivo" && soporte && (
          <button
            type="button"
            onClick={() => void iniciarGrabacion()}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {textos.grabador.comenzar}
          </button>
        )}
        {estado === "grabando" && (
          <button
            type="button"
            onClick={detenerGrabacion}
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            {textos.grabador.detener}
          </button>
        )}
        {estado === "transcribiendo" && (
          <p className="text-sm text-zinc-500" role="status">
            {textos.grabador.transcribiendoEspera}
          </p>
        )}
        {estado === "finalizado" && (
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            {textos.grabador.grabarDeNuevo}
          </button>
        )}
      </div>
    </section>
  );
}
