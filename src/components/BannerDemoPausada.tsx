"use client";

import { useIdioma } from "./ProveedorIdioma";
import { useEvaluacion } from "./ProveedorEvaluacion";

/** Pantalla de la demo pausada. Reemplaza al grabador, no al historial. */
export function BannerDemoPausada() {
  const { textos } = useIdioma();
  const { demoVideoUrl } = useEvaluacion();

  return (
    <section className="pc-panel space-y-4 p-6" role="status">
      <p>{textos.evaluacion.demoPausada}</p>
      {demoVideoUrl && (
        <a className="pc-btn inline-flex items-center" href={demoVideoUrl} target="_blank" rel="noreferrer">
          {textos.evaluacion.verVideo}
        </a>
      )}
    </section>
  );
}
