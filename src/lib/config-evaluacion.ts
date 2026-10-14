import { NextResponse } from "next/server";
import type { Idioma } from "@/types/idioma";
import { diccionario } from "./diccionarios";

/**
 * Interruptor y cupo de la evaluación del hackathon.
 *
 * Se leen DENTRO de cada función, en el momento de la petición, y no en
 * constantes de módulo: así cambiar la variable y reiniciar el proceso (sin
 * rebuild) cambia el comportamiento. Ninguna lleva prefijo NEXT_PUBLIC_.
 *
 * Servidor únicamente. No importar este módulo desde componentes cliente.
 */

/** La demo en vivo solo está activa con la cadena exacta "true". */
export function demoEnVivo(): boolean {
  return process.env.LIVE_DEMO === "true";
}

/**
 * Cupo por navegador. Vacío, 0 o cualquier valor que no sea un entero
 * positivo significa ilimitado (sin cookie y sin textos nuevos).
 */
export function limiteEvaluacion(): number | null {
  const crudo = process.env.EVAL_LIMIT?.trim() ?? "";
  if (!/^[0-9]+$/.test(crudo)) return null;
  const valor = Number(crudo);
  if (!Number.isSafeInteger(valor) || valor <= 0) return null;
  return valor;
}

/**
 * Secreto HMAC de la cookie. Obligatorio cuando hay límite. Menos de 32
 * bytes (o ausente) se trata como no configurado: la petición falla cerrada.
 * No registrar el valor.
 */
export function secretoCookieEvaluacion(): string | null {
  const valor = process.env.EVAL_COOKIE_SECRET;
  if (typeof valor !== "string" || valor.length === 0) return null;
  if (Buffer.byteLength(valor, "utf8") < 32) return null;
  return valor;
}

/** URL http(s) del video de demo. Cualquier otra cosa se oculta. */
export function urlVideoDemo(): string | null {
  const valor = process.env.DEMO_VIDEO_URL?.trim() ?? "";
  if (valor === "") return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Email o URL de contacto. Vacío se oculta. No se interpreta ni se inventa. */
export function contactoEvaluacion(): string | null {
  const valor = process.env.CONTACTO?.trim() ?? "";
  if (valor === "" || valor.length > 500) return null;
  return valor;
}

/**
 * Pausa de la demo. `null` si la demo está activa; si no, un 503 JSON
 * `{ error: "demo_pausada", mensaje }` antes de validar un cuerpo caro o
 * llamar a un proveedor.
 */
export function verificarDemoActiva(idioma: Idioma): Response | null {
  if (demoEnVivo()) return null;
  const textos = diccionario(idioma);
  return NextResponse.json(
    { error: "demo_pausada", mensaje: textos.evaluacion.demoPausada },
    { status: 503 },
  );
}
