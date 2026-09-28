"use client";

import { useSyncExternalStore } from "react";
import {
  borrarHistorial,
  instantaneaServidorHistorial,
  leerInstantaneaHistorial,
  suscribirHistorial,
} from "@/lib/historial-sesiones";
import { etiquetaIdioma } from "@/lib/idiomas";
import type { SesionGuardada } from "@/types/historial";
import { useIdioma } from "./ProveedorIdioma";

function formatearFecha(iso: string, etiqueta: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString(etiqueta, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Cobertura de la rúbrica de esa sesión: puntos cumplidos sobre el total. */
function cobertura(sesion: SesionGuardada): { cumplidos: number; total: number } {
  return {
    cumplidos: sesion.rubrica.filter((punto) => punto.cumplido).length,
    total: sesion.rubrica.length,
  };
}

/** Lista simple de sesiones guardadas en este navegador. */
export function PanelProgreso() {
  const { idioma, textos } = useIdioma();
  const sesiones = useSyncExternalStore(
    suscribirHistorial,
    leerInstantaneaHistorial,
    instantaneaServidorHistorial,
  );

  const borrar = () => {
    const confirmar = window.confirm(textos.progreso.confirmarBorrado);
    if (!confirmar) return;
    borrarHistorial();
  };

  return (
    <section className="w-full space-y-3 rounded-lg border border-zinc-200 bg-white px-4 py-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-800">{textos.progreso.titulo}</h2>
        {sesiones.length > 0 && (
          <button type="button" onClick={borrar} className="text-sm text-zinc-600 underline">
            {textos.progreso.borrar}
          </button>
        )}
      </div>
      {sesiones.length === 0 ? (
        <p className="text-sm text-zinc-600">{textos.progreso.vacio}</p>
      ) : (
        <ul className="space-y-2">
          {sesiones.map((sesion, indice) => {
            const { cumplidos, total } = cobertura(sesion);

            return (
              <li
                key={`${sesion.fecha}-${indice}`}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
              >
                <p>
                  {formatearFecha(sesion.fecha, etiquetaIdioma(idioma))} ·{" "}
                  {textos.comun.tipoPitch[sesion.tipoPitch]}
                </p>
                <p>
                  {textos.progreso.score(sesion.score)} ·{" "}
                  {textos.progreso.rubrica(cumplidos, total)}
                  {sesion.ultraUsado ? ` · ${textos.progreso.ultra}` : ""}
                  {sesion.hallazgos
                    ? ` · ${textos.progreso.hallazgos(
                        sesion.hallazgos.puntosReforzados,
                        sesion.hallazgos.preguntasHechas,
                      )}`
                    : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
