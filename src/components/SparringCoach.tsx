"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type {
  EvaluacionRubrica,
  SparringCompletado,
  TipoPitch,
  TurnoSparring,
} from "@/types/pitch";
import GrabadorVoz from "./GrabadorVoz";
import { ReproductorVeredicto } from "./ReproductorVeredicto";

const MAX_PREGUNTAS_SPARRING = 3;

type Fase = "oferta" | "cargando" | "pregunta" | "evaluando" | "feedback" | "resumen";

interface SparringCoachProps {
  tipoPitch: TipoPitch;
  rubrica: EvaluacionRubrica[];
  vozSesion: "male" | "female" | "random";
  onVozUsada?: (voz: "male" | "female") => void;
  /** Recibe el objeto de sparring completado (solo en memoria de la sesión). */
  onCompletado?: (sparring: SparringCompletado) => void;
}

function obtenerConstructorReconocimiento():
  | (new () => SpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function SparringCoach({
  tipoPitch,
  rubrica,
  vozSesion,
  onVozUsada,
  onCompletado,
}: SparringCoachProps) {
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
  const [textoRespaldo, setTextoRespaldo] = useState("");

  const soporteStt = useSyncExternalStore(
    () => () => {},
    () => Boolean(obtenerConstructorReconocimiento()),
    () => null,
  );

  const cargarPregunta = useCallback(
    async (i: number) => {
      const punto = pendientes[i];
      if (!punto) return;
      setFase("cargando");
      setError(null);
      setPregunta(null);
      setFeedback(null);
      setTextoRespaldo("");
      try {
        const respuesta = await fetch("/api/sparring/pregunta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipoPitch, punto: punto.punto }),
        });
        const cuerpo = (await respuesta.json()) as { pregunta?: string; error?: string };
        if (!respuesta.ok || !cuerpo.pregunta) {
          throw new Error(cuerpo.error ?? "No se pudo generar la pregunta.");
        }
        setPregunta(cuerpo.pregunta);
        setFase("pregunta");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al generar la pregunta.");
        setFase("oferta");
      }
    },
    [pendientes, tipoPitch],
  );

  const evaluar = useCallback(
    async (respuestaUsuario: string) => {
      const punto = pendientes[indice];
      if (!punto || !pregunta) return;
      const texto = respuestaUsuario.trim();
      if (texto === "") {
        setError("La respuesta está vacía. Intenta de nuevo.");
        return;
      }
      setFase("evaluando");
      setError(null);
      try {
        const respuesta = await fetch("/api/sparring/evaluar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoPitch,
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
          throw new Error(cuerpo.error ?? "No se pudo evaluar la respuesta.");
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
        setError(err instanceof Error ? err.message : "Error al evaluar la respuesta.");
        setFase("pregunta");
      }
    },
    [indice, pendientes, pregunta, tipoPitch],
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
      <h2 className="text-lg font-semibold text-zinc-800">Resolver hallazgos</h2>

      {fase === "oferta" && (
        <div className="space-y-3">
          <p className="text-zinc-700">
            Quedaron {pendientes.length}{" "}
            {pendientes.length === 1 ? "hallazgo" : "hallazgos"} (puntos de la
            rúbrica sin cubrir). Puedes resolverlos con preguntas de
            seguimiento (máximo 3, en el orden de la rúbrica).
          </p>
          <button
            type="button"
            onClick={() => void cargarPregunta(0)}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Resolver hallazgos
          </button>
        </div>
      )}

      {fase === "cargando" && (
        <p className="text-zinc-600" role="status">
          Preparando la pregunta {indice + 1} de {pendientes.length}…
        </p>
      )}

      {(fase === "pregunta" || fase === "evaluando") && pregunta && puntoActual && (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Punto: {puntoActual.punto} ({indice + 1}/{pendientes.length})
          </p>
          <p className="text-zinc-800">{pregunta}</p>
          <ReproductorVeredicto
            veredicto={pregunta}
            autoPlay={false}
            voz={vozSesion}
            onVozUsada={onVozUsada}
            etiquetaInactivo="Escuchar pregunta"
          />

          {fase === "evaluando" && (
            <p className="text-zinc-600" role="status">
              Evaluando tu respuesta…
            </p>
          )}

          {fase === "pregunta" && soporteStt === false && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void evaluar(textoRespaldo);
              }}
            >
              <p className="text-sm text-zinc-600">
                Tu navegador no soporta reconocimiento de voz. Escribe la
                respuesta.
              </p>
              <textarea
                value={textoRespaldo}
                onChange={(event) => setTextoRespaldo(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-800"
                placeholder="Escribe tu respuesta…"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Enviar respuesta
              </button>
            </form>
          )}

          {fase === "pregunta" && soporteStt && (
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
            {feedback.cumplido ? "Cubierto" : "Aún pendiente"}
          </p>
          {feedback.comentario && <p className="text-zinc-700">{feedback.comentario}</p>}
          <button
            type="button"
            onClick={irAlSiguiente}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {indice + 1 >= pendientes.length ? "Ver resumen" : "Siguiente pregunta"}
          </button>
        </div>
      )}

      {fase === "resumen" && (
        <p className="text-zinc-800">
          Resolviste {puntosReforzados} de {pendientes.length} hallazgos.
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
