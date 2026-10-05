// Verifica el contraste no textual (WCAG 2.x, criterio 1.4.11: 3:1) del token
// --border contra las superficies donde se dibuja (lienzo y hundido), en claro
// y en oscuro. El filete es lo único que delimita paneles, campos y botones
// quietos, así que debe alcanzar 3:1.
//
// Uso: node scripts/contraste-filete.mjs
//
// Salida: una línea por par con el ratio calculado. Termina con código 1 si
// alguna de las combinaciones "final" no llega a 3:1.

function hexARgb(hex) {
  const limpio = hex.replace("#", "");
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

function canalLineal(valor) {
  const c = valor / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia({ r, g, b }) {
  return (
    0.2126 * canalLineal(r) +
    0.7152 * canalLineal(g) +
    0.0722 * canalLineal(b)
  );
}

function contraste(hexA, hexB) {
  const la = luminancia(hexARgb(hexA));
  const lb = luminancia(hexARgb(hexB));
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

// Inventario: primero el baseline (lo que había, y por qué se cambia), después
// los valores finales. Solo los "final" son un compromiso: deben pasar 3:1.
const casos = [
  {
    tipo: "baseline",
    nombre: "claro  (antes)",
    filete: "#d6d2c9",
    fondos: { lienzo: "#f9f8f6", hundido: "#f1f0ed" },
  },
  {
    tipo: "baseline",
    nombre: "oscuro (antes)",
    filete: "#35352f",
    fondos: { lienzo: "#0f0f0e", hundido: "#1a1a18" },
  },
  {
    tipo: "final",
    nombre: "claro  (nuevo)",
    filete: "#8d8880",
    fondos: { lienzo: "#f9f8f6", hundido: "#f1f0ed" },
  },
  {
    tipo: "final",
    nombre: "oscuro (nuevo)",
    filete: "#6b6a62",
    fondos: { lienzo: "#0f0f0e", hundido: "#1a1a18" },
  },
];

let fallos = 0;
for (const caso of casos) {
  for (const [fondo, hex] of Object.entries(caso.fondos)) {
    const ratio = contraste(caso.filete, hex);
    const ok = ratio >= 3;
    const veredicto = ok ? "OK" : "BAJO";
    const exigible = caso.tipo === "final";
    if (exigible && !ok) fallos++;
    console.log(
      `${caso.tipo.padEnd(8)} ${caso.nombre}  ${caso.filete} sobre ${fondo} (${hex}) = ` +
        `${ratio.toFixed(2)}:1  ${veredicto}${exigible && !ok ? "  <-- incumple 1.4.11" : ""}`,
    );
  }
}

console.log(
  fallos === 0
    ? "\nFilete final: 3:1 o más en los cuatro pares."
    : `\n${fallos} par(es) del filete final por debajo de 3:1.`,
);
process.exit(fallos === 0 ? 0 : 1);
