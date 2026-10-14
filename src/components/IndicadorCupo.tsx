"use client";

import { enlaceContacto, useEvaluacion } from "./ProveedorEvaluacion";
import { useIdioma } from "./ProveedorIdioma";

/** Contador discreto. Solo aparece cuando el servidor confirmó un cupo. */
export function IndicadorCupo() {
  const { textos } = useIdioma();
  const { listo, desdeCache, liveDemo, limite, restantes, noConfigurada } = useEvaluacion();
  const visible =
    liveDemo &&
    !noConfigurada &&
    limite !== null &&
    restantes !== null &&
    (listo || desdeCache);
  if (!visible || limite === null || restantes === null) return null;

  return (
    <div className="pc-panel w-full space-y-1 px-4 py-3">
      <p aria-live="polite" className="text-sm font-semibold">
        {textos.evaluacion.restantes(restantes, limite)}
      </p>
      <p className="pc-masthead-hint">{textos.evaluacion.nota}</p>
    </div>
  );
}

/**
 * Mensaje al agotar el cupo. Sin culpa y sin venta: el video y el contacto
 * se muestran solo si el servidor los mandó.
 */
export function MensajeCupoAgotado() {
  const { textos } = useIdioma();
  const { limite, demoVideoUrl, contacto } = useEvaluacion();
  const cantidad = limite ?? 0;
  const hrefContacto = enlaceContacto(contacto);
  const video = demoVideoUrl;

  return (
    <section className="pc-panel space-y-3 p-6" role="status">
      <p>
        {textos.evaluacion.agotado(cantidad)}{" "}
        {video && hrefContacto && (
          <>
            <a className="pc-site-footer-link" href={video} target="_blank" rel="noreferrer">
              {textos.evaluacion.miraVideo}
            </a>{" "}
            {textos.evaluacion.oContacto}{" "}
            <EnlaceContacto href={hrefContacto}>{textos.evaluacion.escribidme}</EnlaceContacto>
            {". "}
          </>
        )}
        {video && !hrefContacto && (
          <>
            <a className="pc-site-footer-link" href={video} target="_blank" rel="noreferrer">
              {textos.evaluacion.miraVideo}
            </a>
            {". "}
          </>
        )}
        {!video && hrefContacto && (
          <>
            <EnlaceContacto href={hrefContacto}>{textos.evaluacion.escribidmeInicio}</EnlaceContacto>
            {". "}
          </>
        )}
        {!video && !hrefContacto && contacto && (
          <>
            {textos.evaluacion.escribidmeInicio} {contacto}
            {". "}
          </>
        )}
        {textos.evaluacion.agotadoSiguen}
      </p>
    </section>
  );
}

function EnlaceContacto({ href, children }: { href: string; children: string }) {
  const externo = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      className="pc-site-footer-link"
      href={href}
      {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
