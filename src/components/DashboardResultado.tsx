"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Idioma } from "@/types/idioma";
import type {
  DuracionMaxima,
  EvaluacionRubrica,
  PalabraTranscripcion,
  ResultadoAnalisis,
  SolicitudAnalisis,
  TipoPitch,
} from "@/types/pitch";
import {
  patronesMuletillas,
  resaltarMuletillas,
  type PatronMuletilla,
} from "@/lib/muletillas";
import { cabecerasJson } from "@/lib/idiomas";
import { etiquetaPunto } from "@/lib/rubricas";
import { construirGuion, tieneMarcasDeTiempo } from "@/lib/guion-transcripcion";
import { useIdioma } from "./ProveedorIdioma";
import { AnilloSenal } from "./AnilloSenal";
import { ReproductorVeredicto } from "./ReproductorVeredicto";
import { SegundaToma } from "./SegundaToma";
import type { SalaId } from "@/lib/salas";

interface SugerenciaTavily {
  punto: string;
  /** Cifra concreta validada. */
  cifra: string;
  /** Cita textual que la respalda. */
  cita: string;
  /** Fecha del dato (ej. "2024"). Puede ser "". */
  fecha: string;
  /** Título del resultado, para nombrar la fuente. */
  titulo: string;
  url: string;
  /** Frase de 8–12 s lista para decir en voz alta. */
  frase: string;
}

interface ObjecionSalaVista {
  punto: string;
  sala: SalaId;
  objecion: string;
  cita: string;
  titulo: string;
  url: string;
}

interface CifraVista {
  cifra: string;
  estado: "con_fuente" | "sin_fuente";
  cifraFuente?: string;
  titulo?: string;
  url?: string;
  cita?: string;
}

interface TramoVista {
  punto: string;
  inicio: number;
  fin: number;
}

interface DashboardResultadoProps {
  transcripcion: string;
  /** Tokens Scribe con tiempo; vacíos si el pitch se escribió a mano. */
  palabras?: PalabraTranscripcion[];
  resultado: ResultadoAnalisis;
  tipoPitch: TipoPitch;
  duracionMaxima?: DuracionMaxima;
  /** Voz de ElevenLabs de esta sesión (misma para veredicto y sparring). */
  vozSesion?: "male" | "female" | "random";
  /** Se llama cuando ElevenLabs resuelve la voz de la sesión. */
  onVozUsada?: (voz: "male" | "female") => void;
  /**
   * Patrones de src/lib/muletillas.ts para el idioma de la sesión.
   * En español incluyen umbralMin para "pues"/"bueno" (≥3).
   */
  muletillasPatterns?: readonly PatronMuletilla[];
  /** Si se permite pedir enriquecimiento con Tavily (opcional, §12). */
  habilitarTavily?: boolean;
  /** Se llama una vez, cuando Análisis Ultra termina bien. */
  onUltraCompletado?: () => void;
  /** Se llama cuando la segunda toma deja cubierto un punto. */
  onPuntoCerrado?: (puntoId: string) => void;
}

function IconoAccion({ children }: { children: ReactNode }) {
  return (
    <svg className="pc-btn-icono" viewBox="0 0 16 16" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * Marca del punto de rúbrica. Cumplido = marca rellena con check (olivo);
 * pendiente = punto sobre hundido. El estado se lee por forma, no sólo color.
 */
function MarcaRubrica({ cumplido }: { cumplido: boolean }) {
  return (
    <svg className="pc-rubrica-marca" viewBox="0 0 28 28" aria-hidden="true">
      {cumplido ? (
        <path
          d="M8.4 14.6l3.7 3.7 7.5-8.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <circle cx="14" cy="14" r="4" fill="currentColor" />
      )}
    </svg>
  );
}

function formatoReloj(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

function LineaTiempo({
  tramos,
  idioma,
  tipoPitch,
}: {
  tramos: TramoVista[];
  idioma: Idioma;
  tipoPitch: TipoPitch;
}) {
  const fin = Math.max(...tramos.map((tramo) => tramo.fin), 1);
  return (
    <>
      <div className="pc-linea-pista" role="list">
        {tramos.map((tramo) => {
          const izquierda = (tramo.inicio / fin) * 100;
          const ancho = Math.max(4, ((tramo.fin - tramo.inicio) / fin) * 100);
          return (
            <div
              key={`${tramo.punto}-${tramo.inicio}`}
              className="pc-linea-tramo"
              style={{ left: `${izquierda}%`, width: `${ancho}%` }}
              role="listitem"
            >
              {etiquetaPunto(tramo.punto, idioma, tipoPitch)}
            </div>
          );
        })}
      </div>
      <ul className="pc-linea-leyenda">
        {tramos.map((tramo) => (
          <li key={`${tramo.punto}-${tramo.inicio}-leyenda`}>
            {`${formatoReloj(tramo.inicio)}–${formatoReloj(tramo.fin)} ${etiquetaPunto(tramo.punto, idioma, tipoPitch)}`}
          </li>
        ))}
      </ul>
    </>
  );
}

function ItemRubrica({
  item,
  idioma,
  tipoPitch,
  cerradoEnToma,
}: {
  item: EvaluacionRubrica;
  idioma: Idioma;
  tipoPitch: TipoPitch;
  cerradoEnToma?: boolean;
}) {
  const { textos } = useIdioma();
  const cubierto = item.cumplido || cerradoEnToma === true;
  return (
    <li className={`pc-rubrica-item ${cubierto ? "cumplido" : ""}`}>
      <MarcaRubrica cumplido={cubierto} />
      <div>
        <p className="pc-rubrica-punto">
          {etiquetaPunto(item.punto, idioma, tipoPitch)}
          <span className="sr-only">
            {` — ${
              cubierto ? textos.dashboard.puntoCumplido : textos.dashboard.puntoPendiente
            }`}
          </span>
        </p>
        {cerradoEnToma && !item.cumplido && (
          <p className="pc-rubrica-comentario">{textos.dashboard.puntoCerradoToma}</p>
        )}
        {item.comentario && (
          <p className="pc-rubrica-comentario">{item.comentario}</p>
        )}
      </div>
    </li>
  );
}

/**
 * Título de rúbrica con el contador de puntos cumplidos ("3 de 5"): de un
 * vistazo se ve cuántos van marcados sin contar las filas una por una.
 */
function TituloRubrica({
  titulo,
  rubrica,
}: {
  titulo: string;
  rubrica: readonly EvaluacionRubrica[];
}) {
  const { textos } = useIdioma();
  const cumplidos = rubrica.filter((punto) => punto.cumplido).length;
  const total = rubrica.length;
  return (
    <h3>
      {titulo}
      <span className="pc-rubrica-contador" data-completa={cumplidos === total}>
        {textos.dashboard.rubricaCumplidos(cumplidos, total)}
      </span>
    </h3>
  );
}

function CabeceraScore({
  score,
  veredicto,
  sesion,
  vozSesion,
  onVozUsada,
  etiquetaScore,
}: {
  score: number;
  veredicto: string;
  sesion?: string;
  vozSesion: "male" | "female" | "random";
  onVozUsada?: (voz: "male" | "female") => void;
  etiquetaScore: string;
}) {
  return (
    <header className="pc-dashboard-header">
      <div className="pc-score">
        <AnilloSenal modo="asentado" score={score} etiqueta={etiquetaScore} />
        {/* Cifra visible duplicada: el nombre accesible del anillo ya anuncia
            el score completo ("Score 64 de 100"), así que la leyenda se oculta
            al lector para no repetirlo. */}
        <span className="pc-score-leyenda" aria-hidden="true">
          <span className="pc-score-num">{score}</span>
          <span className="pc-score-max">/100</span>
        </span>
      </div>
      <div className="pc-veredicto">
        <p>{veredicto}</p>
        {sesion && <p className="pc-sesion">{sesion}</p>}
        <ReproductorVeredicto
          veredicto={veredicto}
          autoPlay={false}
          voz={vozSesion}
          onVozUsada={onVozUsada}
          className="pc-btn pc-btn-quiet pc-btn-pill"
        />
      </div>
    </header>
  );
}

export function DashboardResultado({
  transcripcion,
  palabras = [],
  resultado,
  tipoPitch,
  duracionMaxima,
  muletillasPatterns,
  habilitarTavily = true,
  vozSesion = "random",
  onVozUsada,
  onUltraCompletado,
  onPuntoCerrado,
}: DashboardResultadoProps) {
  const { idioma, textos } = useIdioma();
  const transcripcionTituloId = useId();
  const raizRef = useRef<HTMLDivElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const patrones = muletillasPatterns ?? patronesMuletillas(idioma);
  const [sugerencias, setSugerencias] = useState<SugerenciaTavily[]>([]);
  const [sala, setSala] = useState<ObjecionSalaVista | null>(null);
  const [cifras, setCifras] = useState<CifraVista[]>([]);
  const [tramos, setTramos] = useState<TramoVista[]>([]);
  const [cargandoLinea, setCargandoLinea] = useState(
    () => tieneMarcasDeTiempo(palabras) && resultado.rubrica.some((punto) => punto.cumplido),
  );
  const [cerrados, setCerrados] = useState<string[]>([]);
  const [analisisUltra, setAnalisisUltra] = useState<ResultadoAnalisis | null>(null);
  const [analizandoUltra, setAnalizandoUltra] = useState(false);
  const [errorUltra, setErrorUltra] = useState<string | null>(null);

  const puntosSinCumplir = useMemo(
    () => resultado.rubrica.filter((p) => !p.cumplido),
    [resultado.rubrica]
  );

  // El estado inicial de carga ya conoce si se va a consultar Tavily, así el
  // efecto no necesita disparar un setState síncrono en su cuerpo.
  const [cargandoTavily, setCargandoTavily] = useState(
    habilitarTavily && transcripcion.trim() !== ""
  );

  const transcripcionResaltada = useMemo(
    () => resaltarMuletillas(transcripcion, patrones),
    [transcripcion, patrones]
  );

  const guion = useMemo(() => construirGuion(palabras), [palabras]);

  const descargarGuion = useCallback(() => {
    if (guion === "") return;
    const blob = new Blob([guion], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = textos.dashboard.archivoGuion;
    enlace.rel = "noopener";
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }, [guion, textos.dashboard.archivoGuion]);

  const totalMuletillas = useMemo(
    () => Object.values(resultado.muletillas).reduce((a, b) => a + b, 0),
    [resultado.muletillas]
  );

  const muletillasOrdenadas = useMemo(
    () =>
      Object.entries(resultado.muletillas)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a),
    [resultado.muletillas]
  );

  // Enriquecimiento con Tavily: se pide una sola vez, no bloquea el resto
  // del dashboard, y si falla o no está habilitada simplemente no muestra nada.
  useEffect(() => {
    if (!habilitarTavily || transcripcion.trim() === "") return;
    let cancelado = false;

    fetch("/api/enriquecer", {
      method: "POST",
      headers: cabecerasJson(idioma),
      body: JSON.stringify({
        tema: tipoPitch,
        idioma,
        // La transcripción viaja al servidor (nunca sale hacia Tavily) para que
        // el enriquecimiento extraiga entidades cortas del pitch.
        transcripcion,
        puntosSinCumplir: puntosSinCumplir.map((p) => ({
          punto: p.punto,
          comentario: p.comentario,
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : { sugerencias: [], sala: null, cifras: [] }))
      .then((data: { sugerencias?: SugerenciaTavily[]; sala?: ObjecionSalaVista | null; cifras?: CifraVista[] }) => {
        if (cancelado) return;
        setSugerencias(data.sugerencias ?? []);
        setSala(data.sala ?? null);
        setCifras(data.cifras ?? []);
      })
      .catch(() => {
        if (cancelado) return;
        setSugerencias([]);
        setSala(null);
        setCifras([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoTavily(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitarTavily, tipoPitch]);

  const puntosCumplidos = useMemo(
    () => resultado.rubrica.filter((punto) => punto.cumplido).map((punto) => punto.punto),
    [resultado.rubrica],
  );

  useEffect(() => {
    if (!tieneMarcasDeTiempo(palabras) || puntosCumplidos.length === 0) return;
    let cancelado = false;
    setCargandoLinea(true);
    fetch("/api/linea-tiempo", {
      method: "POST",
      headers: cabecerasJson(idioma),
      body: JSON.stringify({
        tipoPitch,
        idioma,
        transcripcion,
        palabras,
        puntosCumplidos,
      }),
    })
      .then((res) => (res.ok ? res.json() : { tramos: [] }))
      .then((data: { tramos?: TramoVista[] }) => {
        if (!cancelado) setTramos(data.tramos ?? []);
      })
      .catch(() => {
        if (!cancelado) setTramos([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoLinea(false);
      });
    return () => {
      cancelado = true;
    };
    // Una vez por resultado: el dashboard se remonta con la transcripción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPitch]);

  const abortUltra = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortUltra.current?.abort();
    };
  }, []);

  const pedirAnalisisUltra = useCallback(async () => {
    abortUltra.current?.abort();
    const controlador = new AbortController();
    abortUltra.current = controlador;
    setAnalizandoUltra(true);
    setErrorUltra(null);
    try {
      const duracionMaxima = (resultado.tiempo_maximo_segundos / 60) as DuracionMaxima;
      const respuesta = await fetch("/api/analizar-pitch", {
        method: "POST",
        headers: cabecerasJson(idioma),
        body: JSON.stringify({
          transcripcion,
          tipoPitch,
          idioma,
          duracionMaxima,
          tiempoRealSegundos: resultado.tiempo_real_segundos,
          nivel: "ultra",
        } satisfies SolicitudAnalisis),
        signal: controlador.signal,
      });
      const cuerpo = (await respuesta.json()) as ResultadoAnalisis | { error: string };
      if (controlador.signal.aborted) return;
      if (!respuesta.ok || "error" in cuerpo) {
        throw new Error("error" in cuerpo ? cuerpo.error : textos.dashboard.errorReanalisis);
      }
      setAnalisisUltra(cuerpo);
      onUltraCompletado?.();
    } catch (error) {
      if (controlador.signal.aborted) return;
      setErrorUltra(
        error instanceof Error ? error.message : textos.dashboard.errorReanalisisInesperado,
      );
    } finally {
      if (!controlador.signal.aborted) setAnalizandoUltra(false);
    }
  }, [
    idioma,
    onUltraCompletado,
    resultado.tiempo_maximo_segundos,
    resultado.tiempo_real_segundos,
    tipoPitch,
    textos,
    transcripcion,
  ]);

  // Al llegar el resultado lo anunciamos y llevamos la vista ahí: en móvil el
  // panel aparece debajo del grabador, fuera de pantalla, y el usuario no
  // debería tener que buscarlo. Mismo criterio que el bloque de Ultra.
  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true });
    const nodo = raizRef.current;
    if (nodo === null) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nodo.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  }, []);

  const ultraRef = useRef<HTMLElement | null>(null);

  // Al terminar el Análisis Ultra llevamos al usuario a la sección recién
  // generada: no debería tener que buscarla desplazándose a mano. Con
  // movimiento reducido saltamos sin animación; en éxito o error, siempre.
  useEffect(() => {
    if (analizandoUltra) return;
    if (analisisUltra === null && errorUltra === null) return;
    const nodo = ultraRef.current;
    if (nodo === null) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nodo.focus({ preventScroll: true });
    nodo.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
  }, [analisisUltra, analizandoUltra, errorUltra]);

  const porcentajeTiempo = Math.min(
    100,
    Math.round(
      (resultado.tiempo_real_segundos / resultado.tiempo_maximo_segundos) * 100
    )
  );

  const sesion =
    duracionMaxima !== undefined
      ? `${textos.comun.tipoPitch[tipoPitch]} · ${textos.comun.minutos(duracionMaxima)}`
      : undefined;

  return (
    <div className="pc-dashboard" ref={raizRef}>
      <h2
        className="sr-only pc-dashboard-titulo"
        ref={tituloRef}
        tabIndex={-1}
      >
        {textos.dashboard.titulo}
      </h2>
      <CabeceraScore
        score={resultado.score}
        veredicto={resultado.veredicto_corto}
        sesion={sesion}
        vozSesion={vozSesion}
        onVozUsada={onVozUsada}
        etiquetaScore={textos.dashboard.score(resultado.score)}
      />

      <section className="pc-tiempo">
        <div className="pc-tiempo-barra">
          <div
            className="pc-tiempo-barra-fill"
            style={{ width: `${porcentajeTiempo}%` }}
          />
        </div>
        <p>
          {textos.dashboard.tiempoUsado(
            resultado.tiempo_real_segundos,
            resultado.tiempo_maximo_segundos,
          )}
        </p>
      </section>

      <section className="pc-linea">
        <h3>{textos.dashboard.lineaTiempo}</h3>
        {cargandoLinea && (
          <p role="status">{textos.dashboard.lineaCargando}</p>
        )}
        {!cargandoLinea && tramos.length === 0 && (
          <p>
            {tieneMarcasDeTiempo(palabras)
              ? textos.dashboard.lineaSinUbicacion
              : textos.dashboard.lineaVacia}
          </p>
        )}
        {tramos.length > 0 && (
          <LineaTiempo tramos={tramos} idioma={idioma} tipoPitch={tipoPitch} />
        )}
      </section>

      <div className="pc-resultado-cuerpo">
      <section className="pc-rubrica">
        <TituloRubrica titulo={textos.dashboard.rubrica} rubrica={resultado.rubrica} />
        <ul>
          {resultado.rubrica.map((item) => (
            <ItemRubrica
              key={item.punto}
              item={item}
              idioma={idioma}
              tipoPitch={tipoPitch}
              cerradoEnToma={cerrados.includes(item.punto)}
            />
          ))}
        </ul>
      </section>

      <div className="pc-columna-evidencia">
      <div className="pc-acciones">
        {guion !== "" && (
          <button type="button" onClick={descargarGuion} className="pc-btn pc-btn-quiet pc-btn-accion">
            <IconoAccion>
              <path d="M8 2v7M5 6.5 8 9.5 11 6.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </IconoAccion>
            {textos.dashboard.descargarGuion}
          </button>
        )}
        <button
          type="button"
          onClick={pedirAnalisisUltra}
          disabled={analizandoUltra}
          className="pc-btn pc-btn-accion"
        >
          <IconoAccion>
            <circle
              cx="8"
              cy="8"
              r="5.25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="18 15"
              transform="rotate(-90 8 8)"
            />
          </IconoAccion>
          {analizandoUltra ? textos.dashboard.reanalizando : textos.dashboard.analisisUltra}
        </button>
      </div>

      {habilitarTavily && sala && (
        <section className="pc-tavily">
          <h3>{textos.dashboard.salaTitulo}</h3>
          <p className="pc-tavily-punto">{textos.comun.sala[sala.sala]}</p>
          <p className="pc-rubrica-comentario">{textos.dashboard.salaTexto[sala.sala]}</p>
          <p className="pc-tavily-punto">
            {etiquetaPunto(sala.punto, idioma, tipoPitch)}
          </p>
          <p>{sala.objecion}</p>
          <p className="pc-tavily-cita">{`“${sala.cita}”`}</p>
          <p className="pc-tavily-fuente">
            <a href={sala.url} target="_blank" rel="noreferrer">
              {sala.titulo || textos.dashboard.fuente}
            </a>
          </p>
        </section>
      )}

      {habilitarTavily && puntosSinCumplir.length > 0 && (
        <section className="pc-tavily">
          <h3>{textos.dashboard.datosSugeridos}</h3>
          {cargandoTavily && (
            <p className="pc-tavily-busqueda" role="status">
              <svg className="pc-tavily-arco" viewBox="0 0 16 16" aria-hidden="true">
                <circle
                  cx="8"
                  cy="8"
                  r="5.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="12 21"
                />
              </svg>
              {textos.dashboard.buscando}
            </p>
          )}
          {!cargandoTavily && sugerencias.length === 0 && (
            <p>{textos.dashboard.sinSugerencias}</p>
          )}
          <ul>
            {sugerencias.map((s) => (
              <li key={s.punto}>
                <p className="pc-tavily-punto">
                  {etiquetaPunto(s.punto, idioma, tipoPitch)}
                </p>
                <p className="pc-tavily-cifra">{s.cifra}</p>
                {s.fecha && <p className="pc-tavily-fecha">{s.fecha}</p>}
                <p className="pc-tavily-cita">{`“${s.cita}”`}</p>
                <p className="pc-tavily-fuente">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.titulo || textos.dashboard.fuente}
                  </a>
                </p>
                <ReproductorVeredicto
                  veredicto={s.frase}
                  voz={vozSesion}
                  onVozUsada={onVozUsada}
                  etiquetaInactivo={textos.dashboard.escucharDato}
                  className="pc-btn pc-btn-pill pc-btn-pill-lienzo"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {habilitarTavily && (cargandoTavily || cifras.length > 0) && (
        <section className="pc-tavily">
          <h3>{textos.dashboard.cifrasTitulo}</h3>
          {cargandoTavily && cifras.length === 0 && (
            <p className="pc-tavily-busqueda" role="status">
              {textos.dashboard.buscando}
            </p>
          )}
          <ul>
            {cifras.map((cifra) => (
              <li key={cifra.cifra}>
                <p className="pc-tavily-cifra">{cifra.cifra}</p>
                <p>
                  {cifra.estado === "con_fuente"
                    ? textos.dashboard.cifraConFuente(cifra.cifra)
                    : textos.dashboard.cifraSinFuente(cifra.cifra)}
                </p>
                {cifra.estado === "con_fuente" && cifra.url && (
                  <>
                    {cifra.cita && <p className="pc-tavily-cita">{`“${cifra.cita}”`}</p>}
                    <p className="pc-tavily-fuente">
                      <a href={cifra.url} target="_blank" rel="noreferrer">
                        {cifra.titulo || textos.dashboard.fuente}
                      </a>
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pc-muletillas">
        <h3>{textos.dashboard.muletillas(totalMuletillas)}</h3>
        {muletillasOrdenadas.length === 0 ? (
          <p>{textos.dashboard.sinMuletillas}</p>
        ) : (
          <ul>
            {muletillasOrdenadas.map(([palabra, count]) => (
              <li key={palabra}>
                <span className="pc-muletilla-palabra">
                  {'"'}
                  {palabra}
                  {'"'}
                </span>
                <span className="pc-muletilla-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pc-transcripcion">
        <h3 id={transcripcionTituloId}>{textos.dashboard.transcripcion}</h3>
        <div
          className="pc-transcripcion-cuerpo"
          // Caja con scroll propio: necesita ser enfocable con el teclado y
          // llevar un nombre. `role="region"` es lo que hace efectivo el
          // `aria-labelledby` acá (sobre un div genérico se ignora).
          role="region"
          tabIndex={0}
          aria-labelledby={transcripcionTituloId}
          // `resaltarMuletillas` escapa HTML de la transcripción (viene de STT,
          // no es confiable) antes de insertar los <mark>; el único markup de
          // este string es el que genera el propio resaltado.
          dangerouslySetInnerHTML={{ __html: transcripcionResaltada }}
        />
      </section>
      </div>
      </div>

      {(() => {
        // Una sola segunda toma por práctica: el primer punto no cumplido.
        const pendiente = puntosSinCumplir[0];
        if (!pendiente || !duracionMaxima || cerrados.includes(pendiente.punto)) return null;
        const cifra = sugerencias.find((sugerencia) => sugerencia.punto === pendiente.punto)?.cifra;
        return (
          <SegundaToma
            tipoPitch={tipoPitch}
            duracionMaxima={duracionMaxima}
            puntoId={pendiente.punto}
            puntoNombre={etiquetaPunto(pendiente.punto, idioma, tipoPitch)}
            cifra={cifra}
            onCerrado={(puntoId) => {
              setCerrados((previos) =>
                previos.includes(puntoId) ? previos : [...previos, puntoId],
              );
              onPuntoCerrado?.(puntoId);
            }}
          />
        );
      })()}

      {(errorUltra || analisisUltra !== null) && (
      <section className="pc-ultra-bloque" ref={ultraRef} tabIndex={-1}>
        {errorUltra && (
          <p role="alert" className="pc-alerta">
            {errorUltra}
          </p>
        )}
        {analisisUltra !== null && (
          <div className="pc-ultra">
            <h3 className="pc-display text-xl">
              {textos.dashboard.tituloUltra}
            </h3>
            <CabeceraScore
              score={analisisUltra.score}
              veredicto={analisisUltra.veredicto_corto}
              vozSesion={vozSesion}
              onVozUsada={onVozUsada}
              etiquetaScore={textos.dashboard.score(analisisUltra.score)}
            />
            {analisisUltra.traza && analisisUltra.traza.length > 0 && (
              <section className="space-y-2">
                <h3 className="pc-display text-xl">
                  {textos.dashboard.traza}
                </h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  {analisisUltra.traza.map((paso, indice) => (
                    <li key={`${indice}-${paso.slice(0, 24)}`}>{paso}</li>
                  ))}
                </ol>
              </section>
            )}
            <section className="pc-rubrica">
              <TituloRubrica titulo={textos.dashboard.rubricaUltra} rubrica={analisisUltra.rubrica} />
              <ul>
                {analisisUltra.rubrica.map((item) => (
                  <ItemRubrica
                    key={item.punto}
                    item={item}
                    idioma={idioma}
                    tipoPitch={tipoPitch}
                  />
                ))}
              </ul>
            </section>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
