"use client";

/**
 * Anillo geométrico del coach. En reposo usa el paso 600 de la rampa.
 * En vivo la amplitud mueve el arco y la opacidad, nunca un brillo.
 * Asentado, el mismo arco es el score.
 */
export function AnilloSenal({
  modo,
  nivel = 0,
  score = 0,
  etiqueta,
}: {
  modo: "reposo" | "vivo" | "asentado";
  nivel?: number;
  score?: number;
  etiqueta: string;
}) {
  const amplitud =
    modo === "asentado"
      ? Math.min(1, Math.max(0, score / 100))
      : modo === "vivo"
        ? Math.min(1, Math.max(0, nivel))
        : 0;
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const fraccion =
    modo === "asentado" ? amplitud : modo === "vivo" ? 0.14 + amplitud * 0.86 : 0.14;
  const color =
    modo === "asentado"
      ? "var(--signal)"
      : amplitud > 0.72
        ? "var(--signal-peak)"
        : amplitud > 0.12
          ? "var(--signal)"
          : "var(--signal-rest)";
  const opacidad = modo === "vivo" ? 0.5 + amplitud * 0.5 : 1;

  return (
    <svg className="pc-anillo" viewBox="0 0 120 120" role="img" aria-label={etiqueta}>
      <circle
        cx="60"
        cy="60"
        r={radio}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${fraccion * circunferencia} ${circunferencia}`}
        opacity={opacidad}
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
}
