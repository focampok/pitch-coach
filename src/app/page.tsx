"use client";

import { useCallback, useMemo, useState } from "react";
import SelectorTipoPitch from "@/components/SelectorTipoPitch";
import SelectorDuracion from "@/components/SelectorDuracion";
import GrabadorVoz from "@/components/GrabadorVoz";
import ResumenMuletillas from "@/components/ResumenMuletillas";
import { detectarMuletillas } from "@/lib/muletillas";
import type { TipoPitch, DuracionMaxima } from "@/types/pitch";

const LABEL_TIPO_PITCH: Record<TipoPitch, string> = {
  capital: "Capital",
  educacion: "Educación",
  innovacion: "Innovación",
  tecnologia: "Tecnología",
};

export default function Home() {
  const [tipoPitch, setTipoPitch] = useState<TipoPitch>("capital");
  const [duracionMaxima, setDuracionMaxima] = useState<DuracionMaxima>(3);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);

  const handleTranscripcionCompleta = useCallback((texto: string) => {
    setTranscripcion(texto);
  }, []);

  // Muletillas se derivan del lado del cliente (docs/alcance.md §8: no requiere
  // IA, es regex/keyword matching). Solo se calculan con transcripción presente.
  const muletillas = useMemo(
    () => (transcripcion !== null ? detectarMuletillas(transcripcion) : {}),
    [transcripcion],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-10 p-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Pitch Coach
        </h1>
        <p className="mx-auto mt-2 max-w-md text-zinc-600">
          Elige el tipo de pitch y la duración máxima antes de practicar.
        </p>
      </header>

      <section className="w-full space-y-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-800">Tipo de pitch</h2>
          <SelectorTipoPitch value={tipoPitch} onChange={setTipoPitch} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-800">
            Duración máxima
          </h2>
          <SelectorDuracion value={duracionMaxima} onChange={setDuracionMaxima} />
        </div>
      </section>

      {/* Resumen de la configuración activa antes de grabar. */}
      <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-700">
        Pitch de{" "}
        <span className="font-semibold text-zinc-900">
          {LABEL_TIPO_PITCH[tipoPitch]}
        </span>{" "}
        —{" "}
        <span className="font-semibold text-zinc-900">{duracionMaxima}</span>{" "}
        {duracionMaxima === 1 ? "minuto" : "minutos"}
      </p>

      {/* Grabador: siempre visible porque tipo y duración ya tienen valor por
          defecto. Maneja sus propios estados (inactivo / grabando / finalizado). */}
      <GrabadorVoz
        duracionMaxima={duracionMaxima}
        onTranscripcionCompleta={handleTranscripcionCompleta}
      />

      {/* Confirmación de la transcripción completa. El dashboard visual con
          muletillas/rúbrica/score es de una etapa posterior. */}
      {transcripcion !== null && (
        <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-800">
            Transcripción capturada
          </h2>
          {transcripcion ? (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700">
              {transcripcion}
            </p>
          ) : (
            <p className="mt-2 text-zinc-400">
              No se capturó ninguna transcripción.
            </p>
          )}
          {transcripcion && <ResumenMuletillas conteos={muletillas} />}
        </section>
      )}
    </main>
  );
}
