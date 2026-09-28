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
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              isSelected
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block font-semibold text-zinc-900">
              {textos.comun.tipoPitch[opcion]}
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              {textos.selectorTipoPitch[opcion]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
