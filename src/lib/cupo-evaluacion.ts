import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Idioma } from "@/types/idioma";
import {
  limiteEvaluacion,
  secretoCookieEvaluacion,
  verificarDemoActiva,
} from "./config-evaluacion";
import { diccionario } from "./diccionarios";
import { idiomaDeCabecera } from "./idiomas";

/**
 * Cupo de evaluación por navegador, en una cookie firmada. No hay base de
 * datos: la cookie ES el contador.
 *
 * Carrera conocida y aceptada: dos peticiones a la vez con la misma cookie
 * leen el mismo `usadas`, las dos pasan el chequeo y las dos llaman al
 * proveedor. El segundo `Set-Cookie` pisa al primero, así que el contador
 * sube 1 y el proveedor se usó 2 veces. No hay almacén compartido para
 * cerrarla.
 *
 * Limitación: borrar la cookie (incógnito, otro navegador, borrar datos)
 * abre un cupo nuevo. Frena a un juez normal, no a un abusador decidido.
 *
 * Servidor únicamente. No importar este módulo desde componentes cliente.
 * Nunca registrar EVAL_COOKIE_SECRET ni el valor de la cookie.
 */

export const NOMBRE_COOKIE = "pc_eval";

/** ~30 días. El navegador deja de enviarla; un cupo nuevo empieza en 0. */
const MAX_AGE_SEGUNDOS = 30 * 24 * 60 * 60;

export interface Cupo {
  v: 1;
  sid: string;
  usadas: number;
  iat: number;
}

export interface ContextoEvaluacion {
  /** null cuando el cupo está apagado (ilimitado). */
  cupo: Cupo | null;
  limite: number | null;
}

export type InicioEvaluacion =
  | { continuar: false; respuesta: Response }
  | { continuar: true; ctx: ContextoEvaluacion };

function cupoNuevo(): Cupo {
  return {
    v: 1,
    sid: randomBytes(16).toString("base64url"),
    usadas: 0,
    iat: Math.floor(Date.now() / 1000),
  };
}

function esCupo(valor: unknown): valor is Cupo {
  if (valor === null || typeof valor !== "object") return false;
  const bruto = valor as Record<string, unknown>;
  return (
    bruto.v === 1 &&
    typeof bruto.sid === "string" &&
    bruto.sid.length > 0 &&
    bruto.sid.length <= 128 &&
    typeof bruto.usadas === "number" &&
    Number.isInteger(bruto.usadas) &&
    typeof bruto.iat === "number" &&
    Number.isInteger(bruto.iat)
  );
}

/** Negativo → 0. Por encima del límite → el límite. Nunca un cupo infinito. */
function normalizar(cupo: Cupo): Cupo {
  const limite = limiteEvaluacion();
  let usadas = cupo.usadas;
  if (usadas < 0) usadas = 0;
  if (limite !== null && usadas > limite) usadas = limite;
  return { ...cupo, usadas };
}

function valorCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const parte of header.split(";")) {
    const corte = parte.indexOf("=");
    if (corte === -1) continue;
    const nombre = parte.slice(0, corte).trim();
    if (nombre !== NOMBRE_COOKIE) continue;
    const valor = parte.slice(corte + 1).trim();
    return valor === "" ? null : valor;
  }
  return null;
}

function firmar(payloadB64: string, secreto: string): Buffer {
  return createHmac("sha256", secreto).update(payloadB64).digest();
}

function verificar(valor: string): Cupo | null {
  const secreto = secretoCookieEvaluacion();
  if (!secreto) return null;
  const punto = valor.indexOf(".");
  if (punto <= 0 || punto !== valor.lastIndexOf(".")) return null;
  const payloadB64 = valor.slice(0, punto);
  const firmaB64 = valor.slice(punto + 1);
  let firma: Buffer;
  let esperada: Buffer;
  try {
    firma = Buffer.from(firmaB64, "base64url");
    esperada = firmar(payloadB64, secreto);
  } catch {
    return null;
  }
  if (firma.length !== esperada.length || !timingSafeEqual(firma, esperada)) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!esCupo(json)) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * Cookie ausente, malformada o con firma inválida → cupo nuevo con
 * `usadas = 0`. Nunca infinito y nunca un throw.
 */
export function leerCupo(request: Request): Cupo {
  const entrante = valorCookie(request);
  if (!entrante) return cupoNuevo();
  const verificado = verificar(entrante);
  if (!verificado) return cupoNuevo();
  return normalizar(verificado);
}

/** Prácticas que faltan. `null` si el cupo está apagado. Nunca negativo. */
export function restantes(cupo: Cupo): number | null {
  const limite = limiteEvaluacion();
  if (limite === null) return null;
  return Math.max(0, limite - cupo.usadas);
}

/** Con el cupo apagado, o con costo 0, siempre se puede. */
export function puedeGastar(cupo: Cupo, costo: number): boolean {
  if (!Number.isFinite(costo) || costo <= 0) return true;
  const limite = limiteEvaluacion();
  if (limite === null) return true;
  return cupo.usadas + costo <= limite;
}

/**
 * Suma `costo` sin bajar de 0 y sin pasar del límite. Un costo que no sea
 * un entero positivo deja el cupo igual.
 */
export function consumir(cupo: Cupo, costo: number): Cupo {
  if (!Number.isFinite(costo) || costo <= 0) return cupo;
  const suma = cupo.usadas + Math.floor(costo);
  const limite = limiteEvaluacion();
  const usadas = limite === null ? suma : Math.min(limite, suma);
  return { ...cupo, usadas: Math.max(0, usadas) };
}

/** Valor de la cookie: base64url(JSON) + "." + base64url(HMAC). */
export function serializarCookie(cupo: Cupo): string {
  const secreto = secretoCookieEvaluacion();
  if (!secreto) {
    throw new Error(
      "[evaluacion] No se puede firmar pc_eval sin EVAL_COOKIE_SECRET de al menos 32 bytes.",
    );
  }
  const payloadB64 = Buffer.from(
    JSON.stringify({ v: cupo.v, sid: cupo.sid, usadas: cupo.usadas, iat: cupo.iat }),
    "utf8",
  ).toString("base64url");
  const firma = firmar(payloadB64, secreto).toString("base64url");
  return `${payloadB64}.${firma}`;
}

/** Cabecera Set-Cookie completa. Secure solo en producción. */
export function encabezadoCookie(cupo: Cupo): string {
  const partes = [
    `${NOMBRE_COOKIE}=${serializarCookie(cupo)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEGUNDOS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") partes.push("Secure");
  return partes.join("; ");
}

function cupoDistinto(request: Request, cupo: Cupo): boolean {
  return valorCookie(request) !== serializarCookie(cupo);
}

/**
 * Arranque de una ruta de proveedor.
 * 1. Demo pausada → 503, sin proveedor.
 * 2. Límite activo sin secreto → 503, sin proveedor.
 * 3. Si no, el contexto para cerrar cada respuesta.
 */
export function iniciarEvaluacion(request: Request): InicioEvaluacion {
  const idioma = idiomaDeCabecera(request);
  const pausa = verificarDemoActiva(idioma);
  if (pausa) return { continuar: false, respuesta: pausa };

  const limite = limiteEvaluacion();
  if (limite === null) {
    return { continuar: true, ctx: { cupo: null, limite: null } };
  }
  if (!secretoCookieEvaluacion()) {
    // Nombres de variable, nunca sus valores ni la cookie.
    console.error(
      "[evaluacion] EVAL_LIMIT está definido pero EVAL_COOKIE_SECRET falta o no llega a 32 bytes. Se rechaza la petición.",
    );
    const textos = diccionario(idioma);
    return {
      continuar: false,
      respuesta: NextResponse.json(
        { error: "evaluacion_no_configurada", mensaje: textos.evaluacion.noConfigurada },
        { status: 503 },
      ),
    };
  }
  return { continuar: true, ctx: { cupo: leerCupo(request), limite } };
}

/**
 * Añade X-Eval-Restantes, X-Eval-Limite y, si el cupo se creó o cambió,
 * Set-Cookie. Con el cupo apagado no toca la respuesta. `costo` solo se
 * descuenta en el 200 de un proveedor válido.
 */
export function responderEvaluacion(
  request: Request,
  ctx: ContextoEvaluacion,
  response: Response,
  costo = 0,
): Response {
  if (ctx.cupo === null || ctx.limite === null) return response;
  if (costo > 0) ctx.cupo = consumir(ctx.cupo, costo);
  const quedan = restantes(ctx.cupo);
  response.headers.set("X-Eval-Restantes", String(quedan ?? 0));
  response.headers.set("X-Eval-Limite", String(ctx.limite));
  if (cupoDistinto(request, ctx.cupo)) {
    response.headers.append("Set-Cookie", encabezadoCookie(ctx.cupo));
  }
  return response;
}

/**
 * 429 `{ error: "cupo_evaluacion_agotado" }` si no alcanza, sin llamar al
 * proveedor. `null` si se puede gastar (o el cupo está apagado).
 * No es el 429 de rate-limit.ts: ese sigue siendo el texto de
 * `demasiadasSolicitudes` y lleva Retry-After.
 */
export function rechazarSinCupo(
  request: Request,
  ctx: ContextoEvaluacion,
  costo: number,
  idioma: Idioma,
): Response | null {
  if (ctx.cupo === null || ctx.limite === null) return null;
  if (puedeGastar(ctx.cupo, costo)) return null;
  const textos = diccionario(idioma);
  const respuesta = NextResponse.json(
    {
      error: "cupo_evaluacion_agotado",
      mensaje: textos.evaluacion.cupoAgotado(ctx.limite),
    },
    { status: 429 },
  );
  return responderEvaluacion(request, ctx, respuesta, 0);
}
