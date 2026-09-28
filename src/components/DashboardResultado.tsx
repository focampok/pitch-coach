"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Idioma } from "@/types/idioma";
import type {
  DuracionMaxima,
  EvaluacionRubrica,
  ResultadoAnalisis,
  SolicitudAnalisis,
  TipoPitch,
} from "@/types/pitch";
import {
  patronesMuletillas,
  resaltarMuletillas,
  type PatronMuletilla,
} from "@/lib/muletillas";
import { cabecerasJson } from "@/lib/idiomas";
import { etiquetaPunto } from "@/lib/rubricas";
import { useIdioma } from "./ProveedorIdioma";
import { ReproductorVeredicto } from "./ReproductorVeredicto";

interface SugerenciaTavily {
  punto: string;
  resumen: string;
  url: string;
}

interface DashboardResultadoProps {
  transcripcion: string;
  resultado: ResultadoAnalisis;
  tipoPitch: TipoPitch;
  /** Voz de ElevenLabs de esta sesión (misma para veredicto y sparring). */
  vozSesion?: "male" | "female" | "random";
  /** Se llama cuando ElevenLabs resuelve la voz de la sesión. */
  onVozUsada?: (voz: "male" | "female") => void;
  /**
   * Patrones de src/lib/muletillas.ts para el idioma de la sesión.
   * En español incluyen umbralMin para "pues"/"bueno" (≥3).
   */
  muletillasPatterns?: readonly PatronMuletilla[];
  /** Si se permite pedir enriquecimiento con Tavily (opcional, §12). */
  habilitarTavily?: boolean;
  /** Se llama una vez, cuando Análisis Ultra termina bien. */
  onUltraCompletado?: () => void;
}

function colorScore(score: number): string {
  if (score >= 75) return "#2f9e44"; // verde
  if (score >= 50) return "#f08c00"; // ámbar
  return "#e03131"; // rojo
}

function ItemRubrica({
  item,
  idioma,
  tipoPitch,
}: {
  item: EvaluacionRubrica;
  idioma: Idioma;
  tipoPitch: TipoPitch;
}) {
  return (
    <li className={`pc-rubrica-item ${item.cumplido ? "cumplido" : "faltante"}`}>
      <span aria-hidden="true">{item.cumplido ? "✅" : "⬜"}</span>
      <div>
        <p className="pc-rubrica-punto">{etiquetaPunto(item.punto, idioma, tipoPitch)}</p>
        {item.comentario && (
          <p className="pc-rubrica-comentario">{item.comentario}</p>
        )}
      </div>
    </li>
  );
}

export function DashboardResultado({
  transcripcion,
  resultado,
  tipoPitch,
  muletillasPatterns,
  habilitarTavily = true,
  vozSesion = "random",
  onVozUsada,
  onUltraCompletado,
}: DashboardResultadoProps) {
  const { idioma, textos } = useIdioma();
  const patrones = muletillasPatterns ?? patronesMuletillas(idioma);
  const [sugerencias, setSugerencias] = useState<SugerenciaTavily[]>([]);
  const [analisisUltra, setAnalisisUltra] = useState<ResultadoAnalisis | null>(null);
  const [analizandoUltra, setAnalizandoUltra] = useState(false);
  const [errorUltra, setErrorUltra] = useState<string | null>(null);

  const puntosSinCumplir = useMemo(
    () => resultado.rubrica.filter((p) => !p.cumplido),
    [resultado.rubrica]
  );

  // El estado inicial de carga ya conoce si se va a consultar Tavily, así el
  // efecto no necesita disparar un setState síncrono en su cuerpo.
  const [cargandoTavily, setCargandoTavily] = useState(
    habilitarTavily && puntosSinCumplir.length > 0
  );

  const transcripcionResaltada = useMemo(
    () => resaltarMuletillas(transcripcion, patrones),
    [transcripcion, patrones]
  );

  const totalMuletillas = useMemo(
    () => Object.values(resultado.muletillas).reduce((a, b) => a + b, 0),
    [resultado.muletillas]
  );

  const muletillasOrdenadas = useMemo(
    () =>
      Object.entries(resultado.muletillas)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a),
    [resultado.muletillas]
  );

  // Enriquecimiento con Tavily: se pide una sola vez, no bloquea el resto
  // del dashboard, y si falla o no está habilitada simplemente no muestra nada.
  useEffect(() => {
    if (!habilitarTavily || puntosSinCumplir.length === 0) return;
    let cancelado = false;

    fetch("/api/enriquecer", {
      method: "POST",
      headers: cabecerasJson(idioma),
      body: JSON.stringify({
        tema: tipoPitch,
        idioma,
        puntosSinCumplir: puntosSinCumplir.map((p) => ({
          punto: p.punto,
          comentario: p.comentario,
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : { sugerencias: [] }))
      .then((data) => {
        if (!cancelado) setSugerencias(data.sugerencias ?? []);
      })
      .catch(() => {
        if (!cancelado) setSugerencias([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoTavily(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitarTavily, tipoPitch]);

  const abortUltra = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortUltra.current?.abort();
    };
  }, []);

  const pedirAnalisisUltra = useCallback(async () => {
    abortUltra.current?.abort();
    const controlador = new AbortController();
    abortUltra.current = controlador;
    setAnalizandoUltra(true);
    setErrorUltra(null);
    try {
      const duracionMaxima = (resultado.tiempo_maximo_segundos / 60) as DuracionMaxima;
      const respuesta = await fetch("/api/analizar-pitch", {
        method: "POST",
        headers: cabecerasJson(idioma),
        body: JSON.stringify({
          transcripcion,
          tipoPitch,
          idioma,
          duracionMaxima,
          tiempoRealSegundos: resultado.tiempo_real_segundos,
          nivel: "ultra",
        } satisfies SolicitudAnalisis),
        signal: controlador.signal,
      });
      const cuerpo = (await respuesta.json()) as ResultadoAnalisis | { error: string };
      if (controlador.signal.aborted) return;
      if (!respuesta.ok || "error" in cuerpo) {
        throw new Error("error" in cuerpo ? cuerpo.error : textos.dashboard.errorReanalisis);
      }
      setAnalisisUltra(cuerpo);
      onUltraCompletado?.();
    } catch (error) {
      if (controlador.signal.aborted) return;
      setErrorUltra(
        error instanceof Error ? error.message : textos.dashboard.errorReanalisisInesperado,
      );
    } finally {
      if (!controlador.signal.aborted) setAnalizandoUltra(false);
    }
  }, [
    idioma,
    onUltraCompletado,
    resultado.tiempo_maximo_segundos,
    resultado.tiempo_real_segundos,
    tipoPitch,
    textos,
    transcripcion,
  ]);

  const porcentajeTiempo = Math.min(
    100,
    Math.round(
      (resultado.tiempo_real_segundos / resultado.tiempo_maximo_segundos) * 100
    )
  );

  return (
    <div className="pc-dashboard">
      <header className="pc-dashboard-header">
        <div
          className="pc-score"
          style={{ borderColor: colorScore(resultado.score) }}
        >
          <span className="pc-score-num">{resultado.score}</span>
          <span className="pc-score-max">/100</span>
        </div>
        <div className="pc-veredicto">
          <p>{resultado.veredicto_corto}</p>
          <ReproductorVeredicto
            veredicto={resultado.veredicto_corto}
            autoPlay={false}
            voz={vozSesion}
            onVozUsada={onVozUsada}
          />
        </div>
      </header>

      <section className="pc-tiempo">
        <div className="pc-tiempo-barra">
          <div
            className="pc-tiempo-barra-fill"
            style={{ width: `${porcentajeTiempo}%` }}
          />
        </div>
        <p>
          {textos.dashboard.tiempoUsado(
            resultado.tiempo_real_segundos,
            resultado.tiempo_maximo_segundos,
          )}
        </p>
      </section>

      <section className="pc-rubrica">
        <h3>{textos.dashboard.rubrica}</h3>
        <ul>
          {resultado.rubrica.map((item) => (
            <ItemRubrica
              key={item.punto}
              item={item}
              idioma={idioma}
              tipoPitch={tipoPitch}
            />
          ))}
        </ul>
      </section>

      <section className="pc-muletillas">
        <h3>{textos.dashboard.muletillas(totalMuletillas)}</h3>
        {muletillasOrdenadas.length === 0 ? (
          <p>{textos.dashboard.sinMuletillas}</p>
        ) : (
          <ul>
            {muletillasOrdenadas.map(([palabra, count]) => (
              <li key={palabra}>
                <span className="pc-muletilla-palabra">
                  {'"'}
                  {palabra}
                  {'"'}
                </span>
                <span className="pc-muletilla-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pc-transcripcion">
        <h3>{textos.dashboard.transcripcion}</h3>
        <p
          // `resaltarMuletillas` escapa HTML de la transcripción (viene de STT,
          // no es confiable) antes de insertar los <mark>; el único markup de
          // este string es el que genera el propio resaltado.
          dangerouslySetInnerHTML={{ __html: transcripcionResaltada }}
        />
      </section>

      {habilitarTavily && puntosSinCumplir.length > 0 && (
        <section className="pc-tavily">
          <h3>{textos.dashboard.datosSugeridos}</h3>
          {cargandoTavily && <p>{textos.dashboard.buscando}</p>}
          {!cargandoTavily && sugerencias.length === 0 && (
            <p>{textos.dashboard.sinSugerencias}</p>
          )}
          <ul>
            {sugerencias.map((s) => (
              <li key={s.punto}>
                <p className="pc-tavily-punto">{s.punto}</p>
                <p className="pc-tavily-resumen">{s.resumen}</p>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {textos.dashboard.fuente}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <button
          type="button"
          onClick={pedirAnalisisUltra}
          disabled={analizandoUltra}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60"
        >
          {analizandoUltra ? textos.dashboard.reanalizando : textos.dashboard.analisisUltra}
        </button>
        {errorUltra && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorUltra}
          </p>
        )}
        {analisisUltra !== null && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-base font-semibold text-zinc-900">
              {textos.dashboard.tituloUltra}
            </h3>
            <header className="pc-dashboard-header">
              <div
                className="pc-score"
                style={{ borderColor: colorScore(analisisUltra.score) }}
              >
                <span className="pc-score-num">{analisisUltra.score}</span>
                <span className="pc-score-max">/100</span>
              </div>
              <div className="pc-veredicto">
                <p>{analisisUltra.veredicto_corto}</p>
                <ReproductorVeredicto
                  veredicto={analisisUltra.veredicto_corto}
                  autoPlay={false}
                  voz={vozSesion}
                  onVozUsada={onVozUsada}
                />
              </div>
            </header>
            {analisisUltra.traza && analisisUltra.traza.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-800">
                  {textos.dashboard.traza}
                </h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-700">
                  {analisisUltra.traza.map((paso, indice) => (
                    <li key={`${indice}-${paso.slice(0, 24)}`}>{paso}</li>
                  ))}
                </ol>
              </section>
            )}
            <section className="pc-rubrica">
              <h3>{textos.dashboard.rubricaUltra}</h3>
              <ul>
                {analisisUltra.rubrica.map((item) => (
                  <ItemRubrica
              key={item.punto}
              item={item}
              idioma={idioma}
              tipoPitch={tipoPitch}
            />
                ))}
              </ul>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
