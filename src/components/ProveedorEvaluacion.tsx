"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cabecerasIdioma } from "@/lib/idiomas";
import { useIdioma } from "./ProveedorIdioma";

/**
 * Estado de la pausa y del cupo en el cliente.
 *
 * La verdad es el servidor (`GET /api/estado` y las cabeceras X-Eval-*).
 * sessionStorage solo guarda el último par restantes/límite como caché
 * visual: no autoriza a gastar, y no se usa para esconder el grabador
 * hasta que el servidor confirma.
 */

const CLAVE_CACHE = "pitch-coach:eval-restantes";

export interface EstadoEvaluacionCliente {
  listo: boolean;
  liveDemo: boolean;
  limite: number | null;
  restantes: number | null;
  demoVideoUrl: string | null;
  contacto: string | null;
  noConfigurada: boolean;
  /** Número leído de sessionStorage antes de que responda /api/estado. */
  desdeCache: boolean;
}

interface ValorEvaluacion extends EstadoEvaluacionCliente {
  /** true cuando hay cupo, la demo está en vivo y el servidor ya confirmó. */
  cupoActivo: boolean;
  puede(costo: number): boolean;
  notar(response: Response, cuerpo: unknown): void;
}

const INICIAL: EstadoEvaluacionCliente = {
  listo: false,
  liveDemo: true,
  limite: null,
  restantes: null,
  demoVideoUrl: null,
  contacto: null,
  noConfigurada: false,
  desdeCache: false,
};

const Contexto = createContext<ValorEvaluacion | null>(null);

export function codigoEvaluacion(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== "object") return null;
  const error = (cuerpo as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

export function esDemoPausada(cuerpo: unknown): boolean {
  return codigoEvaluacion(cuerpo) === "demo_pausada";
}

export function esCupoAgotado(cuerpo: unknown): boolean {
  return codigoEvaluacion(cuerpo) === "cupo_evaluacion_agotado";
}

/** Email o URL http(s). Cualquier otra cosa no se convierte en enlace. */
export function enlaceContacto(valor: string | null): string | null {
  if (!valor) return null;
  const limpio = valor.trim();
  if (/^https?:\/\//i.test(limpio)) {
    try {
      const url = new URL(limpio);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return `mailto:${limpio}`;
  return null;
}

function enteroNoNegativo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 ? valor : null;
}

function enteroPositivo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 ? valor : null;
}

function urlHttp(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  try {
    const url = new URL(valor.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function textoContacto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (limpio === "" || limpio.length > 500) return null;
  return limpio;
}

function leerCabeceras(response: Response): { restantes: number; limite: number } | null {
  const restantesCrudo = response.headers.get("X-Eval-Restantes");
  const limiteCrudo = response.headers.get("X-Eval-Limite");
  if (restantesCrudo === null || limiteCrudo === null) return null;
  const restantesNum = Number(restantesCrudo);
  const limiteNum = Number(limiteCrudo);
  if (!Number.isInteger(restantesNum) || !Number.isInteger(limiteNum) || limiteNum <= 0) return null;
  return { restantes: Math.max(0, restantesNum), limite: limiteNum };
}

interface CacheCupo {
  restantes: number;
  limite: number;
}

function interpretarCache(crudo: string | null): CacheCupo | null {
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo) as { restantes?: unknown; limite?: unknown };
    const restantesNum = enteroNoNegativo(datos.restantes);
    const limiteNum = enteroPositivo(datos.limite);
    if (restantesNum === null || limiteNum === null) return null;
    return { restantes: restantesNum, limite: limiteNum };
  } catch {
    return null;
  }
}

let cacheCrudo: string | null | undefined;
let cacheSnapshot: CacheCupo | null = null;

function leerCacheSnapshot(): CacheCupo | null {
  const crudo = sessionStorage.getItem(CLAVE_CACHE);
  if (crudo === cacheCrudo) return cacheSnapshot;
  cacheCrudo = crudo;
  cacheSnapshot = interpretarCache(crudo);
  return cacheSnapshot;
}

function suscribirCache(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}

function cacheServidor(): CacheCupo | null {
  return null;
}

function recordar(restantes: number, limite: number): void {
  try {
    sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ restantes, limite }));
  } catch {
    // sessionStorage puede estar bloqueado. El servidor sigue siendo la verdad.
  }
}

function olvidar(): void {
  try {
    sessionStorage.removeItem(CLAVE_CACHE);
  } catch {
    // igual que arriba
  }
}

export function ProveedorEvaluacion({ children }: { children: ReactNode }) {
  const { idioma } = useIdioma();
  const [estado, setEstado] = useState<EstadoEvaluacionCliente>(INICIAL);
  const cache = useSyncExternalStore(suscribirCache, leerCacheSnapshot, cacheServidor);
  const visible = useMemo<EstadoEvaluacionCliente>(() => {
    if (estado.listo || !cache) return estado;
    return {
      ...estado,
      limite: cache.limite,
      restantes: cache.restantes,
      desdeCache: true,
    };
  }, [estado, cache]);

  const notar = useCallback((response: Response, cuerpo: unknown) => {
    if (esDemoPausada(cuerpo)) {
      setEstado((prev) => ({ ...prev, listo: true, liveDemo: false }));
      return;
    }
    const cabeceras = leerCabeceras(response);
    setEstado((prev) => {
      if (esCupoAgotado(cuerpo)) {
        const limite = cabeceras?.limite ?? prev.limite;
        const restantes = cabeceras?.restantes ?? 0;
        return {
          ...prev,
          listo: true,
          limite,
          restantes,
          desdeCache: false,
          noConfigurada: false,
        };
      }
      if (!cabeceras) return prev;
      return {
        ...prev,
        listo: true,
        limite: cabeceras.limite,
        restantes: cabeceras.restantes,
        desdeCache: false,
        noConfigurada: false,
      };
    });
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;

    (async () => {
      try {
        const respuesta = await fetch("/api/estado", {
          headers: cabecerasIdioma(idioma),
          cache: "no-store",
          signal: controlador.signal,
        });
        const cuerpo = (await respuesta.json()) as Record<string, unknown>;
        if (cancelado) return;
        const cabeceras = leerCabeceras(respuesta);
        const limite = cabeceras?.limite ?? enteroPositivo(cuerpo.limite);
        const restantesValor =
          cabeceras?.restantes ?? (limite === null ? null : enteroNoNegativo(cuerpo.restantes));
        setEstado({
          listo: true,
          liveDemo: cuerpo.liveDemo !== false,
          limite,
          restantes: restantesValor,
          demoVideoUrl: urlHttp(cuerpo.demoVideoUrl),
          contacto: textoContacto(cuerpo.contacto),
          noConfigurada: cuerpo.error === "evaluacion_no_configurada",
          desdeCache: false,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (cancelado) return;
        // Si /api/estado no responde y todavía no había un cupo confirmado,
        // la pantalla sigue como hoy. Un cupo ya confirmado se conserva.
        setEstado((prev) => {
          if (prev.listo && (prev.limite !== null || !prev.liveDemo || prev.noConfigurada)) {
            return prev;
          }
          return { ...prev, listo: true, desdeCache: false, limite: null, restantes: null };
        });
      }
    })();

    return () => {
      cancelado = true;
      controlador.abort();
    };
  }, [idioma]);

  useEffect(() => {
    if (!estado.listo) return;
    if (estado.limite === null || estado.restantes === null) {
      olvidar();
      return;
    }
    recordar(estado.restantes, estado.limite);
  }, [estado.listo, estado.limite, estado.restantes]);

  const valor = useMemo<ValorEvaluacion>(() => {
    const cupoActivo =
      estado.listo &&
      estado.liveDemo &&
      !estado.noConfigurada &&
      estado.limite !== null &&
      estado.restantes !== null;
    return {
      ...visible,
      cupoActivo,
      puede(costo: number) {
        if (!estado.listo) return true;
        if (!estado.liveDemo || estado.noConfigurada) return false;
        if (estado.limite === null || estado.restantes === null) return true;
        return estado.restantes >= costo;
      },
      notar,
    };
  }, [estado, visible, notar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

const INACTIVO: ValorEvaluacion = {
  ...INICIAL,
  listo: true,
  cupoActivo: false,
  puede: () => true,
  notar: () => {},
};

/** Fuera del proveedor se comporta como la demo sin cupo. */
export function useEvaluacion(): ValorEvaluacion {
  return useContext(Contexto) ?? INACTIVO;
}
