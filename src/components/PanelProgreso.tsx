"use client";

import { useSyncExternalStore } from "react";
import {
  borrarHistorial,
  instantaneaServidorHistorial,
  leerInstantaneaHistorial,
  suscribirHistorial,
} from "@/lib/historial-sesiones";
import type { SesionGuardada } from "@/types/historial";
import type { TipoPitch } from "@/types/pitch";

const LABEL_TIPO: Record<TipoPitch, string> = {
  capital: "Capital",
  educacion: "Educación",
  innovacion: "Innovación",
  tecnologia: "Tecnología",
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-419", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function cobertura(sesion: SesionGuardada): string {
  const cumplidos = sesion.rubrica.filter((punto) => punto.cumplido).length;
  return `${cumplidos}/${sesion.rubrica.length}`;
}

/** Lista simple de sesiones guardadas en este navegador. */
export function PanelProgreso() {
  const sesiones = useSyncExternalStore(
    suscribirHistorial,
    leerInstantaneaHistorial,
    instantaneaServidorHistorial,
  );

  const borrar = () => {
    const confirmar = window.confirm("¿Borrar el historial de este navegador?");
    if (!confirmar) return;
    borrarHistorial();
  };

  return (
    <section className="w-full space-y-3 rounded-lg border border-zinc-200 bg-white px-4 py-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-800">Tu progreso</h2>
        {sesiones.length > 0 && (
          <button type="button" onClick={borrar} className="text-sm text-zinc-600 underline">
            Borrar historial
          </button>
        )}
      </div>
      {sesiones.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Todavía no hay sesiones guardadas en este navegador.
        </p>
      ) : (
        <ul className="space-y-2">
          {sesiones.map((sesion, indice) => (
            <li
              key={`${sesion.fecha}-${indice}`}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            >
              <p>
                {formatearFecha(sesion.fecha)} · {LABEL_TIPO[sesion.tipoPitch]}
              </p>
              <p>
                Score {sesion.score} · Rúbrica {cobertura(sesion)}
                {sesion.ultraUsado ? " · Ultra" : ""}
                {sesion.hallazgos
                  ? ` · Hallazgos ${sesion.hallazgos.puntosReforzados}/${sesion.hallazgos.preguntasHechas}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
