"use client";

import type { TipoPitch } from "@/types/pitch";

type OpcionTipoPitch = {
  value: TipoPitch;
  label: string;
  description: string;
};

// Opciones fijas de tipo de pitch (docs/alcance.md, sección 6).
const OPCIONES: readonly OpcionTipoPitch[] = [
  {
    value: "capital",
    label: "Capital",
    description: "Problema, mercado, tracción y ask",
  },
  {
    value: "educacion",
    label: "Educación",
    description: "Objetivo de aprendizaje y estructura pedagógica",
  },
  {
    value: "innovacion",
    label: "Innovación",
    description: "Propuesta diferenciada, validación e impacto",
  },
  {
    value: "tecnologia",
    label: "Tecnología",
    description: "Problema técnico, stack y diferenciador",
  },
];

interface SelectorTipoPitchProps {
  value: TipoPitch;
  onChange: (value: TipoPitch) => void;
}

export default function SelectorTipoPitch({
  value,
  onChange,
}: SelectorTipoPitchProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPCIONES.map((opcion) => {
        const isSelected = opcion.value === value;

        return (
          <button
            key={opcion.value}
            type="button"
            onClick={() => onChange(opcion.value)}
            aria-pressed={isSelected}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              isSelected
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block font-semibold text-zinc-900">
              {opcion.label}
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              {opcion.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
