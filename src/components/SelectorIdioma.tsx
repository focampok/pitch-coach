"use client";

import { IDIOMAS } from "@/types/idioma";
import { registroIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";

/**
 * Toggle de idioma (ES | EN).
 *
 * Las opciones salen de IDIOMAS (el registro), no de una lista escrita acá: un
 * idioma nuevo aparece solo. El nombre accesible de cada botón es el nombre del
 * idioma en su propio idioma ("Español" / "English"), no la sigla visible.
 *
 * Presentacional a propósito: el diseño visual definitivo es de una fase
 * posterior; acá solo tiene que ser usable y accesible.
 */
export default function SelectorIdioma() {
  const { idioma, setIdioma, textos } = useIdioma();

  return (
    <div
      role="group"
      aria-label={textos.selectorIdioma.etiqueta}
      className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white"
    >
      {IDIOMAS.map((codigo) => {
        const activo = codigo === idioma;
        const nombre = registroIdioma(codigo).nombre;

        return (
          <button
            key={codigo}
            type="button"
            aria-pressed={activo}
            aria-label={nombre}
            lang={codigo}
            onClick={() => setIdioma(codigo)}
            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
              activo
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {codigo.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
