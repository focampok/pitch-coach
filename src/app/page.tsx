"use client";

import { useCallback, useState } from "react";
import SelectorTipoPitch from "@/components/SelectorTipoPitch";
import SelectorDuracion from "@/components/SelectorDuracion";
import GrabadorVoz from "@/components/GrabadorVoz";
import { DashboardResultado } from "@/components/DashboardResultado";
import { PATRONES_MULETILLAS } from "@/lib/muletillas";
import type {
  TipoPitch,
  DuracionMaxima,
  SolicitudAnalisis,
  ResultadoAnalisis,
} from "@/types/pitch";

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
  // Estado del análisis: null = no iniciado; analizando = petición en curso;
  // resultado = DashboardResultado; error = fallo de /api/analizar-pitch.
  const [analisis, setAnalisis] = useState<ResultadoAnalisis | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);

  const handleTranscripcionCompleta = useCallback(
    async (texto: string, tiempoReal: number) => {
      setTranscripcion(texto);
      setAnalisis(null);
      setErrorAnalisis(null);
      setAnalizando(true);
      try {
        const respuesta = await fetch("/api/analizar-pitch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcripcion: texto,
            tipoPitch,
            duracionMaxima,
            tiempoRealSegundos: tiempoReal,
          } satisfies SolicitudAnalisis),
        });
        const cuerpo = (await respuesta.json()) as ResultadoAnalisis | { error: string };
        if (!respuesta.ok || "error" in cuerpo) {
          throw new Error("error" in cuerpo ? cuerpo.error : "Error al analizar el pitch.");
        }
        setAnalisis(cuerpo);
      } catch (error) {
        setErrorAnalisis(
          error instanceof Error ? error.message : "Error inesperado al analizar el pitch.",
        );
      } finally {
        setAnalizando(false);
      }
    },
    [tipoPitch, duracionMaxima],
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

      {analizando && (
        <p className="text-zinc-600" role="status">
          Analizando tu pitch…
        </p>
      )}
      {errorAnalisis && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorAnalisis}
        </p>
      )}
      {analisis !== null && transcripcion !== null && (
        <DashboardResultado
          transcripcion={transcripcion}
          resultado={analisis}
          tipoPitch={tipoPitch}
          muletillasPatterns={PATRONES_MULETILLAS}
        />
      )}
    </main>
  );
}
