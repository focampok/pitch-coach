"use client";

import { useState } from "react";
import GrabadorVoz from "./GrabadorVoz";
import { useIdioma } from "./ProveedorIdioma";
import { cabecerasJson } from "@/lib/idiomas";
import type { DuracionMaxima, TipoPitch } from "@/types/pitch";

interface SegundaTomaProps {
  tipoPitch: TipoPitch;
  duracionMaxima: DuracionMaxima;
  puntoId: string;
  puntoNombre: string;
  /** Cifra ya validada, si la hay. No decide si el punto se cierra. */
  cifra?: string;
  onCerrado: (puntoId: string) => void;
}

interface JuicioToma {
  cumplido: boolean;
  comentario: string;
  cifraCitada: boolean;
}

/** Una réplica de 45 segundos sobre un solo punto no cumplido. */
export function SegundaToma({
  tipoPitch,
  duracionMaxima,
  puntoId,
  puntoNombre,
  cifra,
  onCerrado,
}: SegundaTomaProps) {
  const { idioma, textos } = useIdioma();
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [juicio, setJuicio] = useState<JuicioToma | null>(null);

  const evaluar = async (respuesta: string) => {
    setEvaluando(true);
    setError(null);
    try {
      const respuestaHttp = await fetch("/api/segunda-toma", {
        method: "POST",
        headers: cabecerasJson(idioma),
        body: JSON.stringify({
          tipoPitch,
          idioma,
          punto: puntoId,
          respuesta,
          ...(cifra ? { cifra } : {}),
        }),
      });
      const cuerpo = (await respuestaHttp.json()) as JuicioToma | { error: string };
      if (!respuestaHttp.ok || "error" in cuerpo) {
        throw new Error("error" in cuerpo ? cuerpo.error : textos.sparring.errorEvaluarRespuesta);
      }
      setJuicio(cuerpo);
      if (cuerpo.cumplido) onCerrado(puntoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : textos.sparring.errorEvaluarRespuestaInesperado);
    } finally {
      setEvaluando(false);
    }
  };

  return (
    <section className="pc-panel w-full space-y-3 p-6">
      <h3 className="pc-display text-2xl">{textos.segundaToma.titulo}</h3>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {textos.segundaToma.oferta(puntoNombre)}
      </p>
      {juicio === null || !juicio.cumplido ? (
        <GrabadorVoz
          key={juicio ? "reintento" : "primera"}
          duracionMaxima={duracionMaxima}
          topeSegundos={45}
          titulo={textos.segundaToma.titulo}
          variante="incrustado"
          onTranscripcionCompleta={(texto) => {
            void evaluar(texto);
          }}
        />
      ) : null}
      {evaluando && (
        <p role="status" className="text-sm" style={{ color: "var(--text-muted)" }}>
          {textos.segundaToma.evaluando}
        </p>
      )}
      {error && (
        <p role="alert" className="pc-error text-sm">
          {error}
        </p>
      )}
      {juicio && (
        <div className="space-y-2 text-sm">
          <p>{juicio.cumplido ? textos.segundaToma.cubierto : textos.segundaToma.pendiente}</p>
          {juicio.comentario && <p>{juicio.comentario}</p>}
          {cifra && (
            <p style={{ color: "var(--text-muted)" }}>
              {juicio.cifraCitada ? textos.segundaToma.cifraCitada : textos.segundaToma.cifraAusente}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
