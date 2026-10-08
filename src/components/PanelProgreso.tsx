"use client";

import { useSyncExternalStore } from "react";
import {
  borrarHistorial,
  cambiosDeCobertura,
  instantaneaServidorHistorial,
  leerInstantaneaHistorial,
  suscribirHistorial,
} from "@/lib/historial-sesiones";
import { etiquetaIdioma } from "@/lib/idiomas";
import { etiquetaPunto } from "@/lib/rubricas";
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
  const cerrados = new Set(sesion.puntosCerrados ?? []);
  return {
    cumplidos: sesion.rubrica.filter(
      (punto) => punto.cumplido || cerrados.has(punto.punto),
    ).length,
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
    <section className="pc-panel w-full space-y-3 px-4 py-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="pc-display text-2xl">{textos.progreso.titulo}</h2>
        {sesiones.length > 0 && (
          <button type="button" onClick={borrar} className="pc-btn-texto">
            {textos.progreso.borrar}
          </button>
        )}
      </div>
      {sesiones.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{textos.progreso.vacio}</p>
      ) : (
        <ul className="space-y-2">
          {sesiones.map((sesion, indice) => {
            const { cumplidos, total } = cobertura(sesion);
            const previa = sesiones.slice(indice + 1).find(
              (candidata) =>
                candidata.tipoPitch === sesion.tipoPitch && candidata.idioma === sesion.idioma,
            );
            const cambios = previa ? cambiosDeCobertura(sesion, previa) : [];

            return (
              <li
                key={`${sesion.fecha}-${indice}`}
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--ground)" }}
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
                {cambios.length > 0 && (
                  <p>
                    {cambios
                      .map((cambio) => {
                        const nombre = etiquetaPunto(cambio.punto, idioma, sesion.tipoPitch);
                        return cambio.cambio === "cerrado"
                          ? textos.progreso.cerrado(nombre)
                          : textos.progreso.abierto(nombre);
                      })
                      .join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
