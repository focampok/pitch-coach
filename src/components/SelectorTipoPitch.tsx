"use client";

import type { KeyboardEvent } from "react";
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

  // Patrón radiogroup (WAI-ARIA APG): un solo tab stop (roving tabindex); las
  // flechas mueven la selección y el foco, Home/End van a los extremos.
  const manejarTeclado = (
    event: KeyboardEvent<HTMLButtonElement>,
    indice: number,
  ) => {
    const total = OPCIONES.length;
    let siguiente: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        siguiente = (indice + 1) % total;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        siguiente = (indice - 1 + total) % total;
        break;
      case "Home":
        siguiente = 0;
        break;
      case "End":
        siguiente = total - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(OPCIONES[siguiente]);
    const botones =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      );
    botones?.[siguiente]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={textos.inicio.tipoPitch}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {OPCIONES.map((opcion, indice) => {
        const isSelected = opcion === value;

        return (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opcion)}
            onKeyDown={(event) => manejarTeclado(event, indice)}
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
