/**
 * Iconos del transporte de audio (play / pausa / detener).
 *
 * SVG inline, no una librería externa — heredan `currentColor` y el tamaño
 * del contenedor. No se usan emojis como iconos (regla de DESIGN.md).
 */
interface IconoProps {
  className?: string;
}

export function IconoPlay({ className = "pc-transporte-icono" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 3.4v9.2l7.4-4.6z" fill="currentColor" />
    </svg>
  );
}

export function IconoPausa({ className = "pc-transporte-icono" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="3.4" width="3" height="9.2" rx="1" fill="currentColor" />
      <rect x="9" y="3.4" width="3" height="9.2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function IconoDetener({ className = "pc-transporte-icono" }: IconoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="8" height="8" rx="1.6" fill="currentColor" />
    </svg>
  );
}
