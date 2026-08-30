"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Estado = "inactivo" | "cargando" | "hablando" | "error";
type Fuente = "elevenlabs" | "speechSynthesis" | null;

interface ReproductorVeredictoProps {
  /** Texto del veredicto a reproducir (veredicto_corto del análisis). */
  veredicto: string;
  /** Si se reproduce automáticamente al montar. Por defecto no: el usuario elige. */
  autoPlay?: boolean;
  /** Se llama cuando termina de hablar (por cualquier fuente). */
  onFinish?: () => void;
  className?: string;
}

/**
 * Reproduce el veredicto por voz.
 *
 * Orden de intento (§13/§14 del alcance):
 * 1. ElevenLabs vía /api/tts (voz de hombre o mujer, elegida al azar).
 * 2. Si falla, tarda, o el navegador no puede reproducir el audio:
 *    SpeechSynthesis nativa — fallback obligatorio, nunca se quita.
 *
 * El usuario nunca debe notar una interrupción del loop: si ElevenLabs
 * falla, el veredicto igual se escucha, solo que con voz nativa.
 */
export function ReproductorVeredicto({
  veredicto,
  autoPlay = false,
  onFinish,
  className,
}: ReproductorVeredictoProps) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [fuente, setFuente] = useState<Fuente>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const yaIntentadoRef = useRef(false);

  const hablarConSpeechSynthesis = useCallback(
    (texto: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setEstado("error");
        return;
      }
      window.speechSynthesis.cancel(); // por si quedó algo pendiente
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-419";
      utterance.rate = 1;
      utterance.onstart = () => {
        setFuente("speechSynthesis");
        setEstado("hablando");
      };
      utterance.onend = () => {
        setEstado("inactivo");
        onFinish?.();
      };
      utterance.onerror = () => {
        setEstado("error");
        onFinish?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [onFinish]
  );

  const reproducir = useCallback(
    async (texto: string) => {
      setEstado("cargando");
      setFuente(null);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto, voz: "random" }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`TTS respondió ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          setFuente("elevenlabs");
          setEstado("hablando");
        };
        audio.onended = () => {
          setEstado("inactivo");
          URL.revokeObjectURL(url);
          onFinish?.();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          throw new Error("El navegador no pudo reproducir el audio");
        };

        await audio.play();
      } catch (err) {
        // Cualquier falla en ElevenLabs (red, rate limit, timeout,
        // reproducción) cae aquí — nunca se deja al usuario sin veredicto.
        console.warn("[ReproductorVeredicto] ElevenLabs falló, usando fallback:", err);
        hablarConSpeechSynthesis(texto);
      }
    },
    [hablarConSpeechSynthesis, onFinish]
  );

  useEffect(() => {
    if (!veredicto || !autoPlay) return;
    // Evita doble disparo en StrictMode / re-renders con el mismo texto.
    if (yaIntentadoRef.current) return;
    yaIntentadoRef.current = true;
    reproducir(veredicto);

    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [veredicto, autoPlay, reproducir]);

  // Si cambia el veredicto (nuevo intento en la misma sesión), permite reintentar.
  useEffect(() => {
    yaIntentadoRef.current = false;
  }, [veredicto]);

  const etiquetaEstado: Record<Estado, string> = {
    inactivo: "Escuchar veredicto",
    cargando: "Conectando con el coach…",
    hablando: fuente === "elevenlabs" ? "Hablando (ElevenLabs)" : "Hablando",
    error: "No se pudo reproducir — reintentar",
  };

  return (
    <button
      type="button"
      className={className}
      disabled={estado === "cargando" || estado === "hablando"}
      onClick={() => reproducir(veredicto)}
      aria-live="polite"
    >
      {etiquetaEstado[estado]}
    </button>
  );
}
