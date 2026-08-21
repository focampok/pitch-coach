import type { ConteoMuletillas } from "@/types/pitch";

interface ResumenMuletillasProps {
  conteos: ConteoMuletillas;
}

// Resumen visual de las muletillas detectadas en la transcripción
// (docs/alcance.md §8): pill por muletilla con su conteo, o empty state
// positivo cuando el usuario no usó ninguna.
export default function ResumenMuletillas({ conteos }: ResumenMuletillasProps) {
  const entradas = Object.entries(conteos);
  const total = entradas.reduce((suma, [, cantidad]) => suma + cantidad, 0);

  if (entradas.length === 0) {
    return (
      <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        ¡Sin muletillas detectadas! 🎉
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Muletillas · {total} {total === 1 ? "vez" : "veces"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {entradas.map(([etiqueta, cantidad]) => (
          <li
            key={etiqueta}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-900"
          >
            <span>“{etiqueta}”</span>
            <span className="font-semibold">×{cantidad}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
