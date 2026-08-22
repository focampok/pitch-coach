import type { ReactNode } from "react";
import type { EstadoCoach } from "@/types/coach";

// Coach visual (docs/alcance.md §5.1): componente presentacional. El estado
// (reacciones transitorias y mensajes) lo maneja el padre (GrabadorVoz); aquí
// solo se renderiza el personaje SVG con la expresión y animación correspondiente
// (las animaciones viven en globals.css, CSS transforms GPU-friendly).
// Cada reacción se dispara por un dato real verificable en el dashboard.

const CLASE_POR_ESTADO: Record<EstadoCoach, string> = {
  escuchando: "coach-escuchando",
  estremecido: "coach-estremecido",
  sorprendido: "coach-sorprendido",
  asintiendo: "coach-asintiendo",
  mirandoReloj: "coach-mirandoReloj",
};

interface CoachAvatarProps {
  /** Estado del coach (lo maneja el padre). */
  estado: EstadoCoach;
  /** Mensaje breve del coach (el humor va en el copy, no en el dibujo). */
  mensaje: string | null;
}

export default function CoachAvatar({ estado, mensaje }: CoachAvatarProps) {
  const esSorprendido = estado === "sorprendido";
  const esEstremecido = estado === "estremecido";
  const esMirandoReloj = estado === "mirandoReloj";

  // Boca por estado: cambio de expresión (funciona también con reduced motion).
  let boca: ReactNode;
  if (esSorprendido) {
    boca = <ellipse cx="100" cy="120" rx="9" ry="13" fill="#9a3412" />;
  } else if (esEstremecido) {
    boca = <ellipse cx="100" cy="119" rx="6" ry="8" fill="#9a3412" />;
  } else if (esMirandoReloj) {
    boca = (
      <path
        d="M88 120 L112 120"
        stroke="#9a3412"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    );
  } else {
    // escuchando / asintiendo: sonrisa relajada.
    boca = (
      <path
        d="M88 119 Q100 125 112 119"
        stroke="#9a3412"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`${CLASE_POR_ESTADO[estado]} relative w-fit`}>
        <svg
          viewBox="0 0 200 210"
          className="h-40 w-40 overflow-visible"
          aria-hidden="true"
        >
          {/* Torso y hombros */}
          <g className="coach-body">
            <path
              d="M38 210 Q100 168 162 210 L162 216 L38 216 Z"
              fill="#d4d4d8"
            />
            <path
              d="M84 210 Q100 174 116 210 L116 216 L84 216 Z"
              fill="#a1a1aa"
            />
          </g>

          {/* Cabeza: todas las expresiones se animan sobre este grupo. */}
          <g className="coach-head">
            <rect x="90" y="134" width="20" height="20" fill="#eab480" />
            <ellipse cx="100" cy="92" rx="48" ry="54" fill="#f3cfa0" />
            <ellipse cx="52" cy="92" rx="6" ry="10" fill="#eab480" />
            <ellipse cx="148" cy="92" rx="6" ry="10" fill="#eab480" />
            {/* Cabello corto (look de coach) */}
            <path
              d="M52 84 Q52 40 100 38 Q148 40 148 84 Q138 72 124 66 Q112 76 100 64 Q88 76 76 66 Q62 72 52 84 Z"
              fill="#3f3f46"
            />
            {/* Lentes */}
            <circle
              cx="77"
              cy="90"
              r="14"
              fill="none"
              stroke="#52525b"
              strokeWidth="3"
            />
            <circle
              cx="123"
              cy="90"
              r="14"
              fill="none"
              stroke="#52525b"
              strokeWidth="3"
            />
            <line
              x1="91"
              y1="90"
              x2="109"
              y2="90"
              stroke="#52525b"
              strokeWidth="3"
            />
            {/* Ojos (parpadean en idle) */}
            <circle className="coach-eye-l" cx="77" cy="90" r="3.5" fill="#18181b" />
            <circle className="coach-eye-r" cx="123" cy="90" r="3.5" fill="#18181b" />
            {/* Cejas (se elevan en sorpresa / se fruncen al mirar el reloj) */}
            <path
              className="coach-brow-l"
              d="M64 72 Q77 66 90 72"
              stroke="#3f3f46"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              className="coach-brow-r"
              d="M110 72 Q123 66 136 72"
              stroke="#3f3f46"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Nariz */}
            <path
              d="M100 94 Q104 102 100 107"
              stroke="#d99e6b"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            {boca}
          </g>
        </svg>

        {/* Reloj de pulsera (aparece al mirar el reloj por silencio). */}
        <span
          className={`coach-watch ${esMirandoReloj ? "is-visible" : ""}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="#fff"
              stroke="#52525b"
              strokeWidth="2"
            />
            <path
              d="M12 7 V12 L15 14"
              stroke="#52525b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>

      {/* Mensaje del coach: el humor va en el copy, no en el dibujo. */}
      {mensaje !== null && (
        <p className="mt-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-sm">
          {mensaje}
        </p>
      )}

      {/* Anuncio accesible de la reacción (lectores de pantalla). */}
      <p className="sr-only" aria-live="polite">
        {mensaje ?? ""}
      </p>
    </div>
  );
}
