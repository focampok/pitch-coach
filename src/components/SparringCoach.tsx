"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  EvaluacionRubrica,
  SparringCompletado,
  TipoPitch,
  TurnoSparring,
} from "@/types/pitch";
import { cabecerasJson } from "@/lib/idiomas";
import { etiquetaPunto } from "@/lib/rubricas";
import GrabadorVoz from "./GrabadorVoz";
import { useIdioma } from "./ProveedorIdioma";
import { ReproductorVeredicto } from "./ReproductorVeredicto";

const MAX_PREGUNTAS_SPARRING = 3;

type Fase = "oferta" | "cargando" | "pregunta" | "evaluando" | "feedback" | "resumen";

interface SparringCoachProps {
  tipoPitch: TipoPitch;
  rubrica: EvaluacionRubrica[];
  vozSesion: "male" | "female" | "random";
  onVozUsada?: (voz: "male" | "female") => void;
  /** Avisa que "Resolver hallazgos" terminó. El padre decide qué persistir. */
  onCompletado?: (sparring: SparringCompletado) => void;
}

export function SparringCoach({
  tipoPitch,
  rubrica,
  vozSesion,
  onVozUsada,
  onCompletado,
}: SparringCoachProps) {
  const { idioma, textos } = useIdioma();
  const pendientes = useMemo(
    () => rubrica.filter((item) => !item.cumplido).slice(0, MAX_PREGUNTAS_SPARRING),
    [rubrica],
  );

  const [fase, setFase] = useState<Fase>("oferta");
  const [indice, setIndice] = useState(0);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ cumplido: boolean; comentario: string } | null>(
    null,
  );
  const [turnos, setTurnos] = useState<TurnoSparring[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargarPregunta = useCallback(
    async (i: number) => {
      const punto = pendientes[i];
      if (!punto) return;
      setFase("cargando");
      setError(null);
      setPregunta(null);
      setFeedback(null);
      try {
        const respuesta = await fetch("/api/sparring/pregunta", {
          method: "POST",
          headers: cabecerasJson(idioma),
          body: JSON.stringify({ tipoPitch, idioma, punto: punto.punto }),
        });
        const cuerpo = (await respuesta.json()) as { pregunta?: string; error?: string };
        if (!respuesta.ok || !cuerpo.pregunta) {
          throw new Error(cuerpo.error ?? textos.sparring.errorGenerarPregunta);
        }
        setPregunta(cuerpo.pregunta);
        setFase("pregunta");
      } catch (err) {
        setError(err instanceof Error ? err.message : textos.sparring.errorGenerarPreguntaInesperado);
        setFase("oferta");
      }
    },
    [idioma, pendientes, textos, tipoPitch],
  );

  const evaluar = useCallback(
    async (respuestaUsuario: string) => {
      const punto = pendientes[indice];
      if (!punto || !pregunta) return;
      const texto = respuestaUsuario.trim();
      if (texto === "") {
        setError(textos.sparring.errorRespuestaVacia);
        return;
      }
      setFase("evaluando");
      setError(null);
      try {
        const respuesta = await fetch("/api/sparring/evaluar", {
          method: "POST",
          headers: cabecerasJson(idioma),
          body: JSON.stringify({
            tipoPitch,
            idioma,
            punto: punto.punto,
            pregunta,
            respuesta: texto,
          }),
        });
        const cuerpo = (await respuesta.json()) as {
          cumplido?: boolean;
          comentario?: string;
          error?: string;
        };
        if (!respuesta.ok || typeof cuerpo.cumplido !== "boolean") {
          throw new Error(cuerpo.error ?? textos.sparring.errorEvaluarRespuesta);
        }
        const turno: TurnoSparring = {
          punto: punto.punto,
          pregunta,
          respuesta: texto,
          cumplido: cuerpo.cumplido,
          comentario: cuerpo.comentario ?? "",
        };
        setTurnos((prev) => [...prev, turno]);
        setFeedback({ cumplido: cuerpo.cumplido, comentario: turno.comentario });
        setFase("feedback");
      } catch (err) {
        setError(err instanceof Error ? err.message : textos.sparring.errorEvaluarRespuestaInesperado);
        setFase("pregunta");
      }
    },
    [idioma, indice, pendientes, pregunta, textos, tipoPitch],
  );

  const irAlSiguiente = useCallback(() => {
    const siguiente = indice + 1;
    if (siguiente >= pendientes.length) {
      const completado: SparringCompletado = {
        tipoPitch,
        turnos: [...turnos],
        preguntasHechas: pendientes.length,
        puntosReforzados: turnos.filter((t) => t.cumplido).length,
      };
      onCompletado?.(completado);
      setFase("resumen");
      return;
    }
    setIndice(siguiente);
    void cargarPregunta(siguiente);
  }, [cargarPregunta, indice, onCompletado, pendientes.length, tipoPitch, turnos]);

  if (pendientes.length === 0) return null;

  const puntoActual = pendientes[indice];
  const puntosReforzados = turnos.filter((t) => t.cumplido).length;

  return (
    <section className="w-full space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-800">{textos.sparring.titulo}</h2>

      {fase === "oferta" && (
        <div className="space-y-3">
          <p className="text-zinc-700">{textos.sparring.oferta(pendientes.length)}</p>
          <button
            type="button"
            onClick={() => void cargarPregunta(0)}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {textos.sparring.resolver}
          </button>
        </div>
      )}

      {fase === "cargando" && (
        <p className="text-zinc-600" role="status">
          {textos.sparring.preparando(indice + 1, pendientes.length)}
        </p>
      )}

      {(fase === "pregunta" || fase === "evaluando") && pregunta && puntoActual && (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {textos.sparring.punto(
              etiquetaPunto(puntoActual.punto, idioma, tipoPitch),
              indice + 1,
              pendientes.length,
            )}
          </p>
          <p className="text-zinc-800">{pregunta}</p>
          <ReproductorVeredicto
            veredicto={pregunta}
            autoPlay={false}
            voz={vozSesion}
            onVozUsada={onVozUsada}
            etiquetaInactivo={textos.sparring.escucharPregunta}
          />

          {fase === "evaluando" && (
            <p className="text-zinc-600" role="status">
              {textos.sparring.evaluando}
            </p>
          )}

          {fase === "pregunta" && (
            <GrabadorVoz
              key={`sparring-${indice}`}
              duracionMaxima={1}
              onTranscripcionCompleta={(texto) => {
                void evaluar(texto);
              }}
            />
          )}
        </div>
      )}

      {fase === "feedback" && feedback && (
        <div className="space-y-3">
          <p className="font-semibold text-zinc-900">
            {feedback.cumplido ? textos.sparring.cubierto : textos.sparring.pendiente}
          </p>
          {feedback.comentario && <p className="text-zinc-700">{feedback.comentario}</p>}
          <button
            type="button"
            onClick={irAlSiguiente}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {indice + 1 >= pendientes.length ? textos.sparring.verResumen : textos.sparring.siguiente}
          </button>
        </div>
      )}

      {fase === "resumen" && (
        <p className="text-zinc-800">
          {textos.sparring.resumen(puntosReforzados, pendientes.length)}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
