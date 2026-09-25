// Utilidades de lectura de configuración compartidas por los adaptadores de
// proveedor. Viven en su propio módulo para que cada adaptador (Gemini, Nebius)
// no duplique el parseo de las variables neutras `MODEL_*`.

/** Lee un entero positivo de la primera variable de entorno con valor válido. */
export function leerEnteroPositivo(nombres: string[], porDefecto: number): number {
  for (const nombre of nombres) {
    const valor = process.env[nombre];
    if (valor === undefined || valor === "") continue;
    const n = Number(valor);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return porDefecto;
}

/** Lee un decimal positivo (0-2) de la primera variable de entorno con valor válido. */
export function leerTemperatura(nombres: string[], porDefecto: number): number {
  for (const nombre of nombres) {
    const valor = process.env[nombre];
    if (valor === undefined || valor === "") continue;
    const n = Number(valor);
    if (Number.isFinite(n) && n >= 0 && n <= 2) return n;
  }
  return porDefecto;
}
