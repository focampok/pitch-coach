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
    <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col items-stretch gap-8 px-6 py-10">
      <header className="pc-masthead">
        <div>
          <h1 className="pc-display text-4xl">
            Pitch Coach
          </h1>
          <p>{textos.inicio.subtitulo}</p>
        </div>
        <div className="pc-masthead-tools">
          <button
            type="button"
            onClick={() => setMostrarProgreso((visible) => !visible)}
            aria-expanded={mostrarProgreso}
            className="pc-btn-texto"
          >
            {mostrarProgreso ? textos.inicio.ocultarProgreso : textos.inicio.verProgreso}
          </button>
          <SelectorIdioma />
        </div>
      </header>

      {mostrarProgreso && <PanelProgreso />}

      <div className="pc-practica">
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="pc-display text-2xl">{textos.inicio.tipoPitch}</h2>
            <SelectorTipoPitch value={tipoPitch} onChange={setTipoPitch} />
          </div>

          <div className="space-y-3">
            <h2 className="pc-display text-2xl">
              {textos.inicio.duracionMaxima}
            </h2>
            <SelectorDuracion value={duracionMaxima} onChange={setDuracionMaxima} />
          </div>

          <p className="pc-panel px-4 py-3" style={{ color: "var(--signal)" }}>
            {textos.inicio.resumenPitch(
              textos.comun.tipoPitch[tipoPitch],
              textos.comun.minutos(duracionMaxima),
            )}
          </p>
        </section>

        <div className="pc-practica-grabar">
          <GrabadorVoz
            duracionMaxima={duracionMaxima}
            onTranscripcionCompleta={handleTranscripcionCompleta}
          />
        </div>
      </div>

      {analizando && (
        <p role="status" style={{ color: "var(--text-muted)" }}>
          {textos.inicio.analizando}
        </p>
      )}
      {errorAnalisis && (
        <p role="alert" className="pc-alerta w-full">
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
          duracionMaxima={duracionMaxima}
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
