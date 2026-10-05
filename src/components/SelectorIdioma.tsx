"use client";

import type { KeyboardEvent } from "react";
import { IDIOMAS } from "@/types/idioma";
import { registroIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";

/**
 * Toggle de idioma (ES | EN).
 *
 * Las opciones salen de IDIOMAS (el registro), no de una lista escrita acá: un
 * idioma nuevo aparece solo.
 *
 * ACCESIBILIDAD (WCAG 2.5.3, "Label in Name", nivel A)
 * El nombre accesible de cada botón EMPIEZA por la sigla visible ("ES") y
 * sigue con el nombre del idioma en su propio idioma ("Español"). No puede ser
 * sólo "Español": quien usa control por voz dice lo que ve, y si el nombre
 * accesible no contiene el texto visible, el comando no coincide.
 */
export default function SelectorIdioma() {
  const { idioma, setIdioma, textos } = useIdioma();

  // Patrón radiogroup (WAI-ARIA APG): un solo tab stop (roving tabindex); las
  // flechas mueven la selección y el foco, Home/End van a los extremos.
  const manejarTeclado = (
    event: KeyboardEvent<HTMLButtonElement>,
    indice: number,
  ) => {
    const total = IDIOMAS.length;
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
    setIdioma(IDIOMAS[siguiente]);
    const botones =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      );
    botones?.[siguiente]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={textos.selectorIdioma.etiqueta}
      className="inline-flex overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--sunken)" }}
    >
      {IDIOMAS.map((codigo, indice) => {
        const activo = codigo === idioma;
        const nombre = registroIdioma(codigo).nombre;
        const sigla = codigo.toUpperCase();

        return (
          <button
            key={codigo}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            aria-label={`${sigla} — ${nombre}`}
            lang={codigo}
            onClick={() => setIdioma(codigo)}
            onKeyDown={(event) => manejarTeclado(event, indice)}
            // Objetivo táctil de 44px (WCAG 2.2 AA / Apple HIG), igual que el
            // resto de los controles.
            className="inline-flex min-h-11 items-center px-4 py-1.5 text-sm font-semibold"
            style={{
              background: activo ? "var(--field)" : "transparent",
              color: activo ? "var(--bone)" : "var(--text-muted)",
            }}
          >
            {sigla}
          </button>
        );
      })}
    </div>
  );
}
