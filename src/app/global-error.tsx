"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort error boundary for errors thrown in the root layout.
 *
 * Next.js catches these before Sentry can see them, so the manual
 * `captureException` below is required — without it these errors never reach
 * Sentry. Must be a client component and must render its own <html>/<body>,
 * since it replaces the root layout when it renders.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "Arial, Helvetica, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Algo salió mal
        </h1>
        <p style={{ maxWidth: "32rem", opacity: 0.7 }}>
          Ocurrió un error inesperado y no pudimos mostrar esta pantalla. El
          equipo ya fue notificado.
        </p>
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
          Reintentar
        </button>
      </body>
    </html>
  );
}
