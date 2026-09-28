"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cabecerasJson, etiquetaIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";

type Estado = "inactivo" | "cargando" | "hablando" | "error";
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
  voz = "random",
  onVozUsada,
  etiquetaInactivo,
  className,
}: ReproductorVeredictoProps) {
  const { idioma, textos } = useIdioma();
  const etiquetaReposo = etiquetaInactivo ?? textos.reproductor.escucharVeredicto;
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [fuente, setFuente] = useState<Fuente>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const yaIntentadoRef = useRef(false);
  const veredictoAnteriorRef = useRef(veredicto);

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
    [idioma, onFinish]
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
    [hablarConSpeechSynthesis, idioma, onFinish, onVozUsada, voz]
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
    error: textos.reproductor.error,
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
