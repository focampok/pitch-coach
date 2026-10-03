"use client";

import type { TipoPitch } from "@/types/pitch";
import { useTextos } from "./ProveedorIdioma";

// Opciones fijas de tipo de pitch (docs/alcance.md, sección 6). Acá solo vive
// el orden y la lista de valores; las etiquetas y descripciones salen del
// diccionario del idioma activo.
const OPCIONES: readonly TipoPitch[] = [
  "capital",
  "educacion",
  "innovacion",
  "tecnologia",
];

interface SelectorTipoPitchProps {
  value: TipoPitch;
  onChange: (value: TipoPitch) => void;
}

export default function SelectorTipoPitch({
  value,
  onChange,
}: SelectorTipoPitchProps) {
  const textos = useTextos();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPCIONES.map((opcion) => {
        const isSelected = opcion === value;

        return (
          <button
            key={opcion}
            type="button"
            onClick={() => onChange(opcion)}
            aria-pressed={isSelected}
            className="rounded-xl border p-4 text-left"
            style={{
              borderColor: isSelected ? "var(--signal)" : "var(--border)",
              background: isSelected ? "var(--signal-tint)" : "var(--sunken)",
              color: isSelected ? "var(--signal)" : "var(--text)",
            }}
          >
            <span className="block font-semibold">
              {textos.comun.tipoPitch[opcion]}
            </span>
            <span className="mt-1 block text-sm" style={{ color: isSelected ? "var(--signal)" : "var(--text-muted)" }}>
              {textos.selectorTipoPitch[opcion]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
