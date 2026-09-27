"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Error boundary de la ruta raíz.
 *
 * POR QUÉ HACE FALTA
 * Los archivos `error.tsx` de Next.js atrapan los errores de render para poder
 * mostrar una UI de respaldo — y al hacerlo, el error NUNCA llega al handler
 * global de Sentry. Sin este archivo, un fallo de render en GrabadorVoz,
 * DashboardResultado o PanelProgreso no se registra en ningún lado.
 *
 * `global-error.tsx` no cubre este caso: solo dispara si falla el layout raíz,
 * que es mucho más raro.
 *
 * PRIVACIDAD
 * Se reporta únicamente el error. NO se adjuntan props, estado ni el contenido
 * de la transcripción, aunque estén en el árbol de componentes. Si en el futuro
 * se quisiera adjuntar algo de eso, tiene que pasar primero por el filtro de
 * src/lib/sentry-scrub.ts (que igual se aplica a todo evento, vía beforeSend).
 */
export default function Error({
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
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo salió mal</h1>
      <p style={{ maxWidth: "32rem", opacity: 0.7 }}>
        Ocurrió un error inesperado y no pudimos mostrar esta pantalla. El equipo
        ya fue notificado.
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
    </div>
  );
}
