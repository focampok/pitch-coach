"use client";

import { useIdioma } from "@/components/ProveedorIdioma";
import { REPO_GITHUB } from "@/lib/sitio";

export function PiePagina() {
  const { textos } = useIdioma();

  return (
    <footer className="pc-site-footer">
      <p className="pc-site-footer-trust">{textos.pie.confianza}</p>
      <p className="pc-site-footer-meta">
        <span>{textos.pie.desarrolladoPor}</span>
        <span className="pc-site-footer-sep" aria-hidden>
          ·
        </span>
        <span>{textos.pie.licencia}</span>
        <span className="pc-site-footer-sep" aria-hidden>
          ·
        </span>
        <a href={REPO_GITHUB} className="pc-site-footer-link" rel="noopener noreferrer" target="_blank">
          {textos.pie.codigoFuente}
        </a>
      </p>
      <p className="pc-site-footer-hackathon">{textos.pie.hackathon}</p>
    </footer>
  );
}
