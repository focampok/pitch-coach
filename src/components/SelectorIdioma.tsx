"use client";

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

  return (
    <div
      role="group"
      aria-label={textos.selectorIdioma.etiqueta}
      className="inline-flex overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--sunken)" }}
    >
      {IDIOMAS.map((codigo) => {
        const activo = codigo === idioma;
        const nombre = registroIdioma(codigo).nombre;
        const sigla = codigo.toUpperCase();

        return (
          <button
            key={codigo}
            type="button"
            aria-pressed={activo}
            aria-label={`${sigla} — ${nombre}`}
            lang={codigo}
            onClick={() => setIdioma(codigo)}
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
