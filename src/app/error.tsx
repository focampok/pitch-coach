"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useIdiomaAutonomo } from "@/components/ProveedorIdioma";

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
 *
 * IDIOMA
 * Resuelve el idioma por su cuenta (`useIdiomaAutonomo`) en vez de leer el
 * contexto: si el error vino del propio proveedor, un hook que lanza al no
 * encontrar el contexto tumbaría justo la UI que tiene que mostrar el mensaje.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { textos } = useIdiomaAutonomo();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // Este boundary vive DENTRO del layout raíz, así que globals.css sí está
  // cargado: se usan los tokens y las clases del Acta, no estilos sueltos.
  return (
    <div className="mx-auto flex w-full max-w-[32rem] flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="pc-display text-2xl">{textos.errores.titulo}</h1>
      <p style={{ color: "var(--text-muted)" }}>{textos.errores.mensaje}</p>
      <button type="button" onClick={() => reset()} className="pc-btn">
        {textos.errores.reintentar}
      </button>
    </div>
  );
}
