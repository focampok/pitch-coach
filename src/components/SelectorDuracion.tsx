"use client";

import type { DuracionMaxima } from "@/types/pitch";
import { DURACIONES_MAXIMAS } from "@/types/pitch";

interface SelectorDuracionProps {
  value: DuracionMaxima;
  onChange: (value: DuracionMaxima) => void;
}

export default function SelectorDuracion({
  value,
  onChange,
}: SelectorDuracionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DURACIONES_MAXIMAS.map((duracion) => {
        const isSelected = duracion === value;

        return (
          <button
            key={duracion}
            type="button"
            onClick={() => onChange(duracion)}
            aria-pressed={isSelected}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
              isSelected
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {duracion} {duracion === 1 ? "minuto" : "minutos"}
          </button>
        );
      })}
    </div>
  );
}
