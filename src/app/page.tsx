"use client";

import { useCallback, useState } from "react";
import SelectorTipoPitch from "@/components/SelectorTipoPitch";
import SelectorDuracion from "@/components/SelectorDuracion";
import SelectorIdioma from "@/components/SelectorIdioma";
import GrabadorVoz from "@/components/GrabadorVoz";
import { DashboardResultado } from "@/components/DashboardResultado";
import { PanelProgreso } from "@/components/PanelProgreso";
import { SparringCoach } from "@/components/SparringCoach";
import { useIdioma } from "@/components/ProveedorIdioma";
import { cabecerasJson } from "@/lib/idiomas";
import {
  actualizarSesion,
  agregarSesion,
  construirSesionGuardada,
  puntosNoCumplidosPrevios,
} from "@/lib/historial-sesiones";
import { patronesMuletillas } from "@/lib/muletillas";
import type {
  TipoPitch,
  DuracionMaxima,
  SolicitudAnalisis,
  ResultadoAnalisis,
  SparringCompletado,
  PalabraTranscripcion,
} from "@/types/pitch";

export default function Home() {
  const { idioma, textos } = useIdioma();
  const [tipoPitch, setTipoPitch] = useState<TipoPitch>("capital");
  const [duracionMaxima, setDuracionMaxima] = useState<DuracionMaxima>(3);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);
  const [palabras, setPalabras] = useState<PalabraTranscripcion[]>([]);
  // Estado del análisis: null = no iniciado; analizando = petición en curso;
  // resultado = DashboardResultado; error = fallo de /api/analizar-pitch.
  const [analisis, setAnalisis] = useState<ResultadoAnalisis | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [vozSesion, setVozSesion] = useState<"male" | "female" | "random">("random");
  // Fecha de la entrada guardada para ESTE intento. Ultra y hallazgos
  // actualizan esa fila, no la sesión más reciente del historial.
  const [fechaSesion, setFechaSesion] = useState<string | null>(null);
  const [mostrarProgreso, setMostrarProgreso] = useState(false);

  const handleTranscripcionCompleta = useCallback(
    async (texto: string, tiempoReal: number, tokens: PalabraTranscripcion[] = []) => {
      setTranscripcion(texto);
      setPalabras(tokens);
      setAnalisis(null);
      setFechaSesion(null);
      setErrorAnalisis(null);
      setVozSesion("random");
      setAnalizando(true);
      const puntosPrevios = puntosNoCumplidosPrevios(tipoPitch, idioma);
      try {
        const respuesta = await fetch("/api/analizar-pitch", {
          method: "POST",
          headers: cabecerasJson(idioma),
          body: JSON.stringify({
            transcripcion: texto,
            tipoPitch,
            idioma,
            duracionMaxima,
            tiempoRealSegundos: tiempoReal,
            ...(puntosPrevios.length > 0 ? { puntosNoCumplidosPrevios: puntosPrevios } : {}),
          } satisfies SolicitudAnalisis),
        });
        const cuerpo = (await respuesta.json()) as ResultadoAnalisis | { error: string };
        if (!respuesta.ok || "error" in cuerpo) {
          throw new Error("error" in cuerpo ? cuerpo.error : textos.inicio.errorAnalisis);
        }
        setAnalisis(cuerpo);
        const fecha = new Date().toISOString();
        const sesion = construirSesionGuardada({
          fecha,
          tipoPitch,
          idioma,
          duracionMaxima,
          resultado: cuerpo,
        });
        if (sesion) {
          agregarSesion(sesion);
          setFechaSesion(fecha);
        }
      } catch (error) {
        setErrorAnalisis(
          error instanceof Error ? error.message : textos.inicio.errorAnalisisInesperado,
        );
      } finally {
        setAnalizando(false);
      }
    },
    [tipoPitch, duracionMaxima, idioma, textos],
  );

  const marcarUltraUsado = useCallback(() => {
    if (!fechaSesion) return;
    actualizarSesion(fechaSesion, { ultraUsado: true });
  }, [fechaSesion]);

  const guardarHallazgos = useCallback(
    (sparring: SparringCompletado) => {
      if (!fechaSesion) return;
      actualizarSesion(fechaSesion, {
        hallazgos: {
          preguntasHechas: sparring.preguntasHechas,
          puntosReforzados: sparring.puntosReforzados,
          puntos: sparring.turnos.map(({ punto, cumplido }) => ({ punto, cumplido })),
        },
      });
    },
    [fechaSesion],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-10 p-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Pitch Coach
        </h1>
        <p className="mx-auto mt-2 max-w-md text-zinc-600">
          {textos.inicio.subtitulo}
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setMostrarProgreso((visible) => !visible)}
            className="text-sm font-medium text-zinc-700 underline"
          >
            {mostrarProgreso ? textos.inicio.ocultarProgreso : textos.inicio.verProgreso}
          </button>
          <SelectorIdioma />
        </div>
      </header>

      {mostrarProgreso && <PanelProgreso />}

      <section className="w-full space-y-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-800">{textos.inicio.tipoPitch}</h2>
          <SelectorTipoPitch value={tipoPitch} onChange={setTipoPitch} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-800">
            {textos.inicio.duracionMaxima}
          </h2>
          <SelectorDuracion value={duracionMaxima} onChange={setDuracionMaxima} />
        </div>
      </section>

      {/* Resumen de la configuración activa antes de grabar. */}
      <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-700">
        {textos.inicio.resumenPitch(
          textos.comun.tipoPitch[tipoPitch],
          textos.comun.minutos(duracionMaxima),
        )}
      </p>

      {/* Grabador: siempre visible porque tipo y duración ya tienen valor por
          defecto. Maneja sus propios estados (inactivo / grabando / finalizado). */}
      <GrabadorVoz
        duracionMaxima={duracionMaxima}
        onTranscripcionCompleta={handleTranscripcionCompleta}
      />

      {analizando && (
        <p className="text-zinc-600" role="status">
          {textos.inicio.analizando}
        </p>
      )}
      {errorAnalisis && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorAnalisis}
        </p>
      )}
      {analisis !== null && transcripcion !== null && (
        <DashboardResultado
          key={transcripcion}
          transcripcion={transcripcion}
          palabras={palabras}
          resultado={analisis}
          tipoPitch={tipoPitch}
          muletillasPatterns={patronesMuletillas(idioma)}
          vozSesion={vozSesion}
          onVozUsada={setVozSesion}
          onUltraCompletado={marcarUltraUsado}
        />
      )}
      {analisis !== null && (
        <SparringCoach
          key={`sparring-${transcripcion}`}
          tipoPitch={tipoPitch}
          rubrica={analisis.rubrica}
          vozSesion={vozSesion}
          onVozUsada={setVozSesion}
          onCompletado={guardarHallazgos}
        />
      )}
    </main>
  );
}
