"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Idioma } from "@/types/idioma";
import {
  IDIOMA_POR_DEFECTO,
  aplicarIdiomaAlDocumento,
  guardarIdioma,
  resolverIdiomaInicial,
} from "@/lib/idiomas";
import { diccionario, type Diccionario } from "@/lib/diccionarios";

/**
 * Idioma activo + diccionario, para toda la app.
 *
 * CÓMO SE EVITA EL PARPADEO Y LA ADVERTENCIA DE HIDRATACIÓN
 *
 * La home es estática: se prerenderiza en build con `IDIOMA_POR_DEFECTO`, y el
 * servidor no puede leer localStorage ni `navigator`. Por eso el estado arranca
 * en el default en el servidor Y en el primer render del cliente (así ambos
 * árboles coinciden y React no reporta mismatch), y el idioma real se resuelve
 * en un LAYOUT effect: React lo ejecuta en el mismo commit de la hidratación y
 * antes de que el navegador pinte, así que el primer frame visible ya sale en
 * el idioma correcto.
 *
 * El `<html lang>` no lo maneja React (vive en el layout, un Server Component):
 * lo fija el script de `scriptIdiomaInicial()` antes del primer paint y lo
 * mantiene este proveedor cuando cambia el idioma.
 *
 * `useLayoutEffect` no corre en el servidor y React avisa por consola; de ahí el
 * alias: en SSR se usa `useEffect` (que ahí no hace nada, porque el idioma ya es
 * el default) y en el cliente `useLayoutEffect`, que es el que da la garantía.
 */
const useEfectoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface ValorIdioma {
  /** Idioma activo. */
  idioma: Idioma;
  /** Diccionario del idioma activo, ya resuelto. */
  textos: Diccionario;
  /** Cambia el idioma y lo recuerda en este navegador. */
  setIdioma: (idioma: Idioma) => void;
}

const ContextoIdioma = createContext<ValorIdioma | null>(null);

export function ProveedorIdioma({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaEstado] = useState<Idioma>(IDIOMA_POR_DEFECTO);

  // Resolución inicial: localStorage → navegador → default.
  useEfectoDeLayout(() => {
    const inicial = resolverIdiomaInicial();
    setIdiomaEstado(inicial);
    aplicarIdiomaAlDocumento(inicial);
  }, []);

  // Cambios posteriores (el usuario usa el selector).
  useEfectoDeLayout(() => {
    aplicarIdiomaAlDocumento(idioma);
  }, [idioma]);

  const setIdioma = useCallback((nuevo: Idioma) => {
    guardarIdioma(nuevo);
    setIdiomaEstado(nuevo);
  }, []);

  const valor = useMemo<ValorIdioma>(
    () => ({ idioma, textos: diccionario(idioma), setIdioma }),
    [idioma, setIdioma],
  );

  return <ContextoIdioma.Provider value={valor}>{children}</ContextoIdioma.Provider>;
}

function useContextoIdioma(): ValorIdioma {
  const valor = useContext(ContextoIdioma);
  if (!valor) {
    throw new Error("useIdioma/useTextos requieren <ProveedorIdioma> por encima.");
  }
  return valor;
}

/** Idioma activo, su diccionario y el setter. */
export function useIdioma(): ValorIdioma {
  return useContextoIdioma();
}

/** Atajo para el caso más común: solo los textos del idioma activo. */
export function useTextos(): Diccionario {
  return useContextoIdioma().textos;
}

/**
 * Idioma sin depender del contexto. Para los error boundaries.
 *
 * `error.tsx` y `global-error.tsx` son la UI de respaldo: si el error vino de
 * arriba (el propio proveedor, el layout), un hook que lanza al no encontrar el
 * contexto haría fallar justo lo que tiene que mostrar el mensaje. Así que
 * resuelven el idioma por su cuenta, con la misma regla que el proveedor.
 */
export function useIdiomaAutonomo(): ValorIdioma {
  const [idioma, setIdiomaEstado] = useState<Idioma>(IDIOMA_POR_DEFECTO);

  useEfectoDeLayout(() => {
    setIdiomaEstado(resolverIdiomaInicial());
  }, []);

  useEfectoDeLayout(() => {
    aplicarIdiomaAlDocumento(idioma);
  }, [idioma]);

  return useMemo<ValorIdioma>(
    () => ({
      idioma,
      textos: diccionario(idioma),
      setIdioma: guardarIdioma,
    }),
    [idioma],
  );
}
