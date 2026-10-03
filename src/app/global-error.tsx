"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useIdiomaAutonomo } from "@/components/ProveedorIdioma";
import { etiquetaIdioma } from "@/lib/idiomas";

/**
 * ESTILOS
 * Como este componente reemplaza al layout raíz, `globals.css` NO está cargado
 * (lo importa el layout que se descarta) y las clases del Acta no existen acá.
 * Por eso los tokens viajan inline en un <style>, incluida su reasignación
 * oscura: antes esto tenía los colores claros fijos y en un sistema en modo
 * oscuro la pantalla de error aparecía en blanco, fuera de la marca. Las dos
 * caras del Acta (Alike y Source Sans 3) tampoco están cargadas acá, así que el
 * stack cae a serif / system-ui.
 */
const ESTILOS = `
  :root {
    color-scheme: light;
    --ground: #f9f8f6;
    --sunken: #f1f0ed;
    --text: #1a1917;
    --text-muted: #6b6862;
    --signal: #285828;
    --signal-peak: #16301a;
    --field: #1e4022;
    --bone: #f4f3f0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --ground: #0f0f0e;
      --sunken: #1a1a18;
      --text: #f4f3f0;
      --text-muted: #a3a099;
      --signal: #a3c48f;
      --signal-peak: #dfebd6;
    }
  }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
    background: var(--ground);
    color: var(--text);
    font-family: "Source Sans 3", system-ui, sans-serif;
  }
  h1 {
    margin: 0;
    font-family: Alike, Georgia, serif;
    font-size: 1.5rem;
    font-weight: 400;
  }
  p {
    max-width: 32rem;
    margin: 0;
    color: var(--text-muted);
  }
  button {
    min-height: 44px;
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--field);
    color: var(--bone);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover {
    background: var(--signal-peak);
  }
  @media (prefers-color-scheme: dark) {
    /* En oscuro el pico es claro: el hover conserva el campo y sólo cambia el
       filete, igual que .pc-btn. */
    button:hover {
      background: var(--field);
      border-color: var(--signal);
    }
  }
  :focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 3px;
  }
`;

/**
 * Last-resort error boundary for errors thrown in the root layout.
 *
 * Next.js catches these before Sentry can see them, so the manual
 * `captureException` below is required — without it these errors never reach
 * Sentry. Must be a client component and must render its own <html>/<body>,
 * since it replaces the root layout when it renders.
 *
 * IDIOMA
 * Al reemplazar el layout raíz queda FUERA de <ProveedorIdioma>, así que el
 * idioma se resuelve acá mismo (`useIdiomaAutonomo`) y se aplica también al
 * <html lang> que este componente renderiza.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { idioma, textos } = useIdiomaAutonomo();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={etiquetaIdioma(idioma)}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: ESTILOS }} />
      </head>
      <body>
        <h1>{textos.errores.titulo}</h1>
        <p>{textos.errores.mensaje}</p>
        <button type="button" onClick={() => reset()}>
          {textos.errores.reintentar}
        </button>
      </body>
    </html>
  );
}
