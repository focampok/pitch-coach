/**
 * Error de la capa de modelo. `codigoHttp` permite que la capa neutra
 * (`src/lib/modelo.ts`) distinga errores transitorios (reintentables) de
 * permanentes sin conocer el proveedor. Sin `codigoHttp` (red/timeout) se
 * asume reintentable.
 *
 * Vive en su propio módulo para evitar un ciclo de importación entre
 * `modelo.ts` y `proveedor-modelo.ts`.
 */
export class ErrorModelo extends Error {
  codigoHttp?: number;

  constructor(mensaje: string, codigoHttp?: number) {
    super(mensaje);
    this.name = "ErrorModelo";
    this.codigoHttp = codigoHttp;
  }
}
