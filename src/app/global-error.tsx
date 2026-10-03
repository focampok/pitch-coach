"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useIdiomaAutonomo } from "@/components/ProveedorIdioma";
import { etiquetaIdioma } from "@/lib/idiomas";

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
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: '"Source Sans 3", sans-serif',
          background: "#F9F8F6",
          color: "#1A1917",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{textos.errores.titulo}</h1>
        <p style={{ maxWidth: "32rem", opacity: 0.7 }}>{textos.errores.mensaje}</p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid currentColor",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          {textos.errores.reintentar}
        </button>
      </body>
    </html>
  );
}
