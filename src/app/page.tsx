"use client";

import { useState } from "react";
import SelectorTipoPitch from "@/components/SelectorTipoPitch";
import SelectorDuracion from "@/components/SelectorDuracion";
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

      {/* Resumen temporal: solo para validar visualmente que el estado se actualiza. */}
      <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-700">
        Pitch de{" "}
        <span className="font-semibold text-zinc-900">
          {LABEL_TIPO_PITCH[tipoPitch]}
        </span>{" "}
        —{" "}
        <span className="font-semibold text-zinc-900">{duracionMaxima}</span>{" "}
        {duracionMaxima === 1 ? "minuto" : "minutos"}
      </p>
    </main>
  );
}
