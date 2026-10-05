"use client";

import type { KeyboardEvent } from "react";
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

  // Patrón radiogroup (WAI-ARIA APG): un solo tab stop (roving tabindex); las
  // flechas mueven la selección y el foco, Home/End van a los extremos.
  const manejarTeclado = (
    event: KeyboardEvent<HTMLButtonElement>,
    indice: number,
  ) => {
    const total = DURACIONES_MAXIMAS.length;
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
    onChange(DURACIONES_MAXIMAS[siguiente]);
    const botones =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      );
    botones?.[siguiente]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={textos.inicio.duracionMaxima}
      className="flex flex-wrap gap-2"
    >
      {DURACIONES_MAXIMAS.map((duracion, indice) => {
        const isSelected = duracion === value;

        return (
          <button
            key={duracion}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(duracion)}
            onKeyDown={(event) => manejarTeclado(event, indice)}
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
