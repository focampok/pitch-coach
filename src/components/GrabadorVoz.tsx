"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { DuracionMaxima, PalabraTranscripcion } from "@/types/pitch";
import {
  elegirMensajeAsintiendo,
  textoIndicadorCoach,
  type EstadoGrabador,
} from "@/lib/mensajes-coach";
import { cabecerasIdioma } from "@/lib/idiomas";
import { extraerPalabrasScribe } from "@/lib/guion-transcripcion";
import { useIdioma } from "./ProveedorIdioma";
import { AnilloSenal } from "./AnilloSenal";
import { IconoPausa, IconoPlay } from "./ui/IconosTransporte";

interface GrabadorVozProps {
  /** Duración máxima del pitch en minutos (presets 1–7, docs/alcance.md §7). */
  duracionMaxima: DuracionMaxima;
  /**
   * "incrustado" cuando el grabador vive dentro de otro panel (SparringCoach):
   * se disuelve en ese panel en vez de hundir un panel sobre otro hundido
   * (Regla del Hundido, DESIGN.md).
   */
  variante?: "panel" | "incrustado";
  /**
   * Se dispara al terminar (grabación + transcripción, o envío de texto de
   * respaldo) con el texto completo y el tiempo real en segundos
   * (docs/alcance.md §7: el tiempo usado entra como contexto de la evaluación).
   * `palabras` trae marcas de Scribe cuando el audio se transcribió; vacío si
   * el usuario escribió el texto de respaldo.
   */
  onTranscripcionCompleta: (
    transcripcion: string,
    tiempoRealSegundos: number,
    palabras?: PalabraTranscripcion[],
  ) => void;
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
  variante = "panel",
  onTranscripcionCompleta,
}: GrabadorVozProps) {
  const { idioma, textos } = useIdioma();
  const idAyudaRespaldo = useId();
  const [estado, setEstado] = useState<EstadoGrabador>("inactivo");
  const [transcripcionFinal, setTranscripcionFinal] = useState("");
  const [textoRespaldo, setTextoRespaldo] = useState("");
  const [mostrarRespaldo, setMostrarRespaldo] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [duracionTotal, setDuracionTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensajeCoach, setMensajeCoach] = useState<string | null>(null);
  const [nivel, setNivel] = useState(0);
  const [pausado, setPausado] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("");
  const abortTranscripcionRef = useRef<AbortController | null>(null);
  const tiempoRestanteRef = useRef(0);
  const duracionTotalRef = useRef(0);
  const pausadoRef = useRef(false);

  const soporte = useSyncExternalStore(
    () => () => {},
    () => capturaDisponible(),
    () => null,
  );

  const soltarMicrófono = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio && audio.state !== "closed") void audio.close();
    setNivel(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    pausadoRef.current = false;
    setPausado(false);
  }, []);

  const finalizarConTexto = useCallback(
    (
      texto: string,
      tiempoRealSegundos: number,
      palabras: PalabraTranscripcion[] = [],
    ) => {
      setTranscripcionFinal(texto);
      setEstado("finalizado");
      setMensajeCoach(elegirMensajeAsintiendo(idioma));
      onTranscripcionCompleta(texto, tiempoRealSegundos, palabras);
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
        const cuerpo = (await respuesta.json()) as {
          texto?: string;
          palabras?: unknown;
          error?: string;
        };
        if (!respuesta.ok || typeof cuerpo.texto !== "string") {
          throw new Error(cuerpo.error ?? textos.grabador.errorTranscripcion);
        }
        const texto = cuerpo.texto.trim();
        finalizarConTexto(texto, tiempoRealSegundos, extraerPalabrasScribe(cuerpo));
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

  // MediaRecorder.pause() deja de escribir datos y congela el tiempo restante:
  // lo pausado no cuenta como pitch hablado (docs/alcance.md §7).
  const pausarGrabacion = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    try {
      recorder.pause();
      pausadoRef.current = true;
      setPausado(true);
      setNivel(0);
    } catch {
      // Sin soporte de pausa seguimos grabando en continuo.
    }
  }, []);

  const reanudarGrabacion = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    try {
      recorder.resume();
      pausadoRef.current = false;
      setPausado(false);
    } catch {
      // Sin soporte de pausa no hay nada que reanudar.
    }
  }, []);

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

    try {
      const audio = new AudioContext();
      const fuente = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 1024;
      fuente.connect(analyser);
      audioRef.current = audio;
      const buffer = new Uint8Array(analyser.fftSize);
      const medir = () => {
        analyser.getByteTimeDomainData(buffer);
        let suma = 0;
        for (let i = 0; i < buffer.length; i++) {
          const valor = (buffer[i] - 128) / 128;
          suma += valor * valor;
        }
        setNivel(Math.min(1, Math.sqrt(suma / buffer.length) * 3.2));
        rafRef.current = requestAnimationFrame(medir);
      };
      rafRef.current = requestAnimationFrame(medir);
    } catch {
      // La grabación sigue sin el anillo vivo.
    }

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
    pausadoRef.current = false;
    setPausado(false);
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
    pausadoRef.current = false;
    setPausado(false);
  }, [soltarMicrófono]);

  useEffect(() => {
    if (estado !== "grabando") return;
    const id = window.setInterval(() => {
      if (pausadoRef.current) return;
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
  const indicadorCoach =
    estado === "grabando" && pausado
      ? textos.grabador.grabacionPausada
      : textoIndicadorCoach(estado, mensajeCoach, textos);

  const modoAnillo = estado === "grabando" && !pausado ? "vivo" : "reposo";

  return (
    <section
      className={variante === "incrustado" ? "w-full" : "pc-panel w-full p-6"}
    >
      <div className="flex items-center gap-4">
        <div className="pc-score" style={{ width: 72, height: 72 }}>
          <AnilloSenal
            modo={modoAnillo}
            nivel={nivel}
            etiqueta={
              estado === "grabando"
                ? pausado
                  ? textos.grabador.grabacionPausada
                  : textos.grabador.grabando
                : estado === "transcribiendo"
                  ? textos.grabador.transcribiendo
                  : textos.grabador.titulo
            }
          />
        </div>
        <div>
          <h2 className="pc-display text-2xl">{textos.grabador.titulo}</h2>
          {estado === "grabando" && (
            <p
              className="text-sm"
              style={{ color: pausado ? "var(--text-muted)" : "var(--signal)" }}
            >
              {pausado ? textos.grabador.grabacionPausada : textos.grabador.grabando}
            </p>
          )}
          {estado === "transcribiendo" && (
            <p className="text-sm" role="status" style={{ color: "var(--text-muted)" }}>
              {textos.grabador.transcribiendo}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {estado === "inactivo" && soporte && (
          <button type="button" onClick={() => void iniciarGrabacion()} className="pc-btn">
            {textos.grabador.comenzar}
          </button>
        )}
        {estado === "grabando" && (
          <div
            className="pc-transporte"
            role="group"
            aria-label={textos.grabador.controlesGrabacion}
          >
            <button
              type="button"
              onClick={pausado ? reanudarGrabacion : pausarGrabacion}
              className="pc-btn pc-btn-quiet pc-transporte-btn"
              aria-pressed={pausado}
            >
              {pausado ? <IconoPlay /> : <IconoPausa />}
              {pausado ? textos.grabador.reanudar : textos.grabador.pausar}
            </button>
            <button type="button" onClick={detenerGrabacion} className="pc-btn">
              {textos.grabador.detener}
            </button>
          </div>
        )}
        {estado === "finalizado" && (
          <button type="button" onClick={reiniciar} className="pc-btn pc-btn-quiet">
            {textos.grabador.grabarDeNuevo}
          </button>
        )}
      </div>

      {indicadorCoach !== null && (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          {indicadorCoach}
        </p>
      )}
      {estado === "finalizado" && mensajeCoach !== null && (
        <p className="sr-only" aria-live="polite">
          {mensajeCoach}
        </p>
      )}

      {estado === "grabando" && (
        <div className="pc-tiempo mt-4">
          <div className="flex items-baseline justify-between text-sm" style={{ color: "var(--text-muted)" }}>
            <span>{textos.grabador.tiempoRestante}</span>
            <span className="pc-display text-2xl tabular-nums" style={{ color: "var(--text)" }}>
              {formatoTiempo(tiempoRestante)}
            </span>
          </div>
          <div className="pc-tiempo-barra mt-2">
            <div className="pc-tiempo-barra-fill" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 min-h-32 rounded-xl p-4" style={{ background: "var(--ground)" }}>
        <p className="mb-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          {estado === "finalizado" ? textos.grabador.transcripcionFinal : textos.grabador.transcripcion}
        </p>
        {transcripcionFinal ? (
          <p className="whitespace-pre-wrap">{transcripcionFinal}</p>
        ) : (
          <p style={{ color: "var(--text-muted)" }}>
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
          <p id={idAyudaRespaldo} className="text-sm" style={{ color: "var(--text-muted)" }}>
            {soporte
              ? textos.grabador.ayudaRespaldo
              : textos.grabador.ayudaSinSoporte}
          </p>
          <textarea
            value={textoRespaldo}
            onChange={(event) => setTextoRespaldo(event.target.value)}
            rows={4}
            aria-label={textos.grabador.etiquetaRespaldo}
            aria-describedby={idAyudaRespaldo}
            className="w-full rounded-xl p-3"
            style={{ background: "var(--ground)", color: "var(--text)", border: "1px solid var(--border)" }}
            placeholder={textos.grabador.placeholderRespaldo}
          />
          <button type="submit" className="pc-btn">
            {textos.grabador.enviarTexto}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="pc-error mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
