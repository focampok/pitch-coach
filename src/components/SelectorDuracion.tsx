"use client";

import type { DuracionMaxima } from "@/types/pitch";
import { DURACIONES_MAXIMAS } from "@/types/pitch";
import { useTextos } from "./ProveedorIdioma";

interface SelectorDuracionProps {
  value: DuracionMaxima;
  onChange: (value: DuracionMaxima) => void;
}

export default function SelectorDuracion({
  value,
  onChange,
}: SelectorDuracionProps) {
  const textos = useTextos();

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
            className="rounded-lg border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: isSelected ? "transparent" : "var(--border)",
              background: isSelected ? "var(--field)" : "var(--sunken)",
              color: isSelected ? "var(--bone)" : "var(--text)",
            }}
          >
            {textos.comun.minutos(duracion)}
          </button>
        );
      })}
    </div>
  );
}
