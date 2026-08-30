"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResultadoAnalisis, EvaluacionRubrica } from "@/types/pitch";
import {
  PATRONES_MULETILLAS,
  resaltarMuletillas,
  type PatronMuletilla,
} from "@/lib/muletillas";
import { ReproductorVeredicto } from "./ReproductorVeredicto";

interface SugerenciaTavily {
  punto: string;
  resumen: string;
  url: string;
}

interface DashboardResultadoProps {
  transcripcion: string;
  resultado: ResultadoAnalisis;
  tipoPitch: string;
  /**
   * Patrones reales de src/lib/muletillas.ts (única fuente de verdad).
   * Incluyen umbralMin para "pues"/"bueno" (≥3).
   */
  muletillasPatterns?: readonly PatronMuletilla[];
  /** Si se permite pedir enriquecimiento con Tavily (opcional, §12). */
  habilitarTavily?: boolean;
}

function colorScore(score: number): string {
  if (score >= 75) return "#2f9e44"; // verde
  if (score >= 50) return "#f08c00"; // ámbar
  return "#e03131"; // rojo
}

function ItemRubrica({ item }: { item: EvaluacionRubrica }) {
  return (
    <li className={`pc-rubrica-item ${item.cumplido ? "cumplido" : "faltante"}`}>
      <span aria-hidden="true">{item.cumplido ? "✅" : "⬜"}</span>
      <div>
        <p className="pc-rubrica-punto">{item.punto}</p>
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
  muletillasPatterns = PATRONES_MULETILLAS,
  habilitarTavily = true,
}: DashboardResultadoProps) {
  const [sugerencias, setSugerencias] = useState<SugerenciaTavily[]>([]);
  const [cargandoTavily, setCargandoTavily] = useState(false);

  const puntosSinCumplir = useMemo(
    () => resultado.rubrica.filter((p) => !p.cumplido),
    [resultado.rubrica]
  );

  const transcripcionResaltada = useMemo(
    () => resaltarMuletillas(transcripcion, muletillasPatterns),
    [transcripcion, muletillasPatterns]
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

    setCargandoTavily(true);
    fetch("/api/enriquecer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tema: tipoPitch,
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
          {resultado.tiempo_real_segundos}s de {resultado.tiempo_maximo_segundos}s
          usados
        </p>
      </section>

      <section className="pc-rubrica">
        <h3>Rúbrica</h3>
        <ul>
          {resultado.rubrica.map((item) => (
            <ItemRubrica key={item.punto} item={item} />
          ))}
        </ul>
      </section>

      <section className="pc-muletillas">
        <h3>Muletillas ({totalMuletillas})</h3>
        {muletillasOrdenadas.length === 0 ? (
          <p>Ninguna detectada — buen control.</p>
        ) : (
          <ul>
            {muletillasOrdenadas.map(([palabra, count]) => (
              <li key={palabra}>
                <span className="pc-muletilla-palabra">"{palabra}"</span>
                <span className="pc-muletilla-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pc-transcripcion">
        <h3>Transcripción</h3>
        <p
          // La transcripción y las muletillas son texto ya generado/derivado
          // por el propio análisis, no input HTML arbitrario de terceros.
          dangerouslySetInnerHTML={{ __html: transcripcionResaltada }}
        />
      </section>

      {habilitarTavily && puntosSinCumplir.length > 0 && (
        <section className="pc-tavily">
          <h3>Datos que podrían reforzar tu pitch</h3>
          {cargandoTavily && <p>Buscando…</p>}
          {!cargandoTavily && sugerencias.length === 0 && (
            <p>Sin sugerencias por ahora.</p>
          )}
          <ul>
            {sugerencias.map((s) => (
              <li key={s.punto}>
                <p className="pc-tavily-punto">{s.punto}</p>
                <p className="pc-tavily-resumen">{s.resumen}</p>
                <a href={s.url} target="_blank" rel="noreferrer">
                  Fuente
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
