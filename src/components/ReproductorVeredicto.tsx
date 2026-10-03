"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cabecerasJson, etiquetaIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";
import { IconoDetener, IconoPausa, IconoPlay } from "./ui/IconosTransporte";

type Estado = "inactivo" | "cargando" | "hablando" | "pausado" | "error";
type Fuente = "elevenlabs" | "speechSynthesis" | null;

interface ReproductorVeredictoProps {
  /** Texto del veredicto a reproducir (veredicto_corto del análisis). */
  veredicto: string;
  /** Si se reproduce automáticamente al montar. Por defecto no: el usuario elige. */
  autoPlay?: boolean;
  /** Se llama cuando termina de hablar (por cualquier fuente). */
  onFinish?: () => void;
  /**
   * Voz de ElevenLabs. `random` elige al azar; si la sesión ya tiene voz,
   * pásala para reutilizarla (sparring).
   */
  voz?: "male" | "female" | "random";
  /** Se llama con la voz efectivamente usada (header `X-Voice-Gender`). */
  onVozUsada?: (voz: "male" | "female") => void;
  /** Texto del botón en reposo. Default: el del diccionario del idioma activo. */
  etiquetaInactivo?: string;
  className?: string;
}

/**
 * Reproduce el veredicto por voz, con controles de play / pausa / detener.
 *
 * Orden de intento (§13/§14 del alcance):
 * 1. ElevenLabs vía /api/tts (voz de hombre o mujer, elegida al azar).
 * 2. Si falla, tarda, o el navegador no puede reproducir el audio:
 *    SpeechSynthesis nativa — fallback obligatorio, nunca se quita.
 *
 * Mientras habla se muestran dos controles: un toggle pausa/reanudar y un
 * detener. Detener NO dispara `onFinish` (el usuario interrumpió, no terminó):
 * solo se llama cuando la reproducción llega a su fin por sí sola.
 *
 * El usuario nunca debe notar una interrupción del loop: si ElevenLabs
 * falla, el veredicto igual se escucha, solo que con voz nativa.
 */
export function ReproductorVeredicto({
  veredicto,
  autoPlay = false,
  onFinish,
  voz = "random",
  onVozUsada,
  etiquetaInactivo,
  className = "pc-btn pc-btn-quiet",
}: ReproductorVeredictoProps) {
  const { idioma, textos } = useIdioma();
  const etiquetaReposo = etiquetaInactivo ?? textos.reproductor.escucharVeredicto;
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [fuente, setFuente] = useState<Fuente>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fuenteRef = useRef<Fuente>(null);
  const detenidoRef = useRef(false);
  const yaIntentadoRef = useRef(false);
  const veredictoAnteriorRef = useRef(veredicto);

  const fijarFuente = useCallback((valor: Fuente) => {
    fuenteRef.current = valor;
    setFuente(valor);
  }, []);

  /** Suelta el audio de ElevenLabs y revoca su blob URL. Idempotente. */
  const limpiarAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const hablarConSpeechSynthesis = useCallback(
    (texto: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setEstado("error");
        return;
      }
      window.speechSynthesis.cancel(); // por si quedó algo pendiente
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = etiquetaIdioma(idioma);
      utterance.rate = 1;
      utterance.onstart = () => {
        fijarFuente("speechSynthesis");
        setEstado("hablando");
      };
      utterance.onend = () => {
        // `cancel()` dispara `onend` en algunos navegadores: si el usuario
        // detuvo, no lo tratamos como final natural.
        if (detenidoRef.current) {
          detenidoRef.current = false;
          return;
        }
        setEstado("inactivo");
        onFinish?.();
      };
      utterance.onerror = () => {
        if (detenidoRef.current) {
          detenidoRef.current = false;
          return;
        }
        setEstado("error");
        onFinish?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [fijarFuente, idioma, onFinish]
  );

  const reproducir = useCallback(
    async (texto: string) => {
      detenidoRef.current = false;
      limpiarAudio();
      setEstado("cargando");
      fijarFuente(null);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: cabecerasJson(idioma),
          body: JSON.stringify({ texto, voz, idioma }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`TTS respondió ${res.status}`);

        const vozHeader = res.headers.get("X-Voice-Gender");
        if (vozHeader === "male" || vozHeader === "female") {
          onVozUsada?.(vozHeader);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          fijarFuente("elevenlabs");
          setEstado("hablando");
        };
        audio.onended = () => {
          limpiarAudio();
          setEstado("inactivo");
          onFinish?.();
        };
        audio.onerror = () => {
          // Falla al decodificar/reproducir: nunca dejamos al usuario sin voz.
          limpiarAudio();
          hablarConSpeechSynthesis(texto);
        };

        await audio.play();
      } catch (err) {
        // Cualquier falla en ElevenLabs (red, rate limit, timeout,
        // reproducción) cae aquí — nunca se deja al usuario sin veredicto.
        console.warn("[ReproductorVeredicto] ElevenLabs falló, usando fallback:", err);
        limpiarAudio();
        hablarConSpeechSynthesis(texto);
      }
    },
    [fijarFuente, hablarConSpeechSynthesis, idioma, limpiarAudio, onFinish, onVozUsada, voz]
  );

  const pausar = useCallback(() => {
    if (fuenteRef.current === "elevenlabs") {
      audioRef.current?.pause();
      setEstado("pausado");
    } else if (fuenteRef.current === "speechSynthesis") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setEstado("pausado");
    }
  }, []);

  const reanudar = useCallback(() => {
    detenidoRef.current = false;
    if (fuenteRef.current === "elevenlabs") {
      void audioRef.current?.play();
      setEstado("hablando");
    } else if (fuenteRef.current === "speechSynthesis") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
      setEstado("hablando");
    }
  }, []);

  const detener = useCallback(() => {
    detenidoRef.current = true;
    limpiarAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    fijarFuente(null);
    setEstado("inactivo");
  }, [fijarFuente, limpiarAudio]);

  useEffect(() => {
    if (!veredicto || !autoPlay) return;
    // Evita doble disparo en StrictMode / re-renders con el mismo texto.
    if (yaIntentadoRef.current) return;
    yaIntentadoRef.current = true;
    void reproducir(veredicto);

    return () => {
      detenidoRef.current = true;
      limpiarAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [veredicto, autoPlay, reproducir, limpiarAudio]);

  // Si cambia el veredicto (nuevo intento), permite un autoplay nuevo.
  // No resetear en el mismo montaje: eso reabría el guard y disparaba un eco.
  useEffect(() => {
    if (veredictoAnteriorRef.current === veredicto) return;
    veredictoAnteriorRef.current = veredicto;
    yaIntentadoRef.current = false;
  }, [veredicto]);

  const etiquetaEstado: Record<Estado, string> = {
    inactivo: etiquetaReposo,
    cargando: textos.reproductor.conectando,
    hablando:
      fuente === "elevenlabs"
        ? textos.reproductor.hablandoElevenlabs
        : textos.reproductor.hablando,
    pausado: textos.reproductor.pausado,
    error: textos.reproductor.error,
  };

  const activo = estado === "hablando" || estado === "pausado";

  if (!activo) {
    return (
      <button
        type="button"
        className={className}
        disabled={estado === "cargando"}
        aria-busy={estado === "cargando"}
        onClick={() => void reproducir(veredicto)}
      >
        {etiquetaEstado[estado]}
      </button>
    );
  }

  const pausado = estado === "pausado";

  return (
    <div
      className="pc-transporte"
      role="group"
      aria-label={textos.reproductor.controles}
    >
      <button
        type="button"
        className="pc-btn pc-btn-quiet pc-transporte-btn"
        onClick={pausado ? reanudar : pausar}
        aria-label={pausado ? textos.reproductor.reanudar : textos.reproductor.pausar}
        title={pausado ? textos.reproductor.reanudar : textos.reproductor.pausar}
      >
        {pausado ? <IconoPlay /> : <IconoPausa />}
      </button>
      <button
        type="button"
        className="pc-btn pc-btn-quiet pc-transporte-btn"
        onClick={detener}
        aria-label={textos.reproductor.detener}
        title={textos.reproductor.detener}
      >
        <IconoDetener />
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {etiquetaEstado[estado]}
      </span>
    </div>
  );
}
