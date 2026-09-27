import * as Sentry from "@sentry/nextjs";
import {
  DATA_COLLECTION,
  TRACE_LIFECYCLE,
  TRACE_PROPAGATION_TARGETS,
} from "./lib/sentry-options";
import { beforeSend, beforeSendTransaction } from "./lib/sentry-scrub";

/**
 * Runtime del navegador. Next.js carga este archivo directamente para el bundle
 * del cliente, así que no hace falta la indirección de `register()`.
 *
 * El DSN se lee de NEXT_PUBLIC_SENTRY_DSN porque el navegador lo necesita en
 * build-time. Un DSN de Sentry es una clave de ingesta PUBLICA por diseño (está
 * pensada para vivir en el navegador), no un secreto — la excepción consciente
 * a la regla de NEXT_PUBLIC_ está documentada en .env.example. Todo lo demás
 * (SENTRY_AUTH_TOKEN de source maps) sigue siendo server-only.
 *
 * PRIVACIDAD — ver src/lib/sentry-scrub.ts y docs/status.md.
 *
 * Por qué las referencias a process.env son literales y no un helper de
 * src/lib/: Next.js solo reemplaza en el bundle del cliente las referencias
 * ESTÁTICAS a `process.env.NEXT_PUBLIC_*`. Una lectura dinámica del estilo
 * `source[nombre]` no se puede inlinear y llegaría `undefined` al navegador.
 */
const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.NODE_ENV ||
  "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false",

  // Igual que en el servidor: es el interruptor que impide reportar la IP del
  // cliente. Ver src/lib/sentry-options.ts.
  dataCollection: DATA_COLLECTION,

  // Igual que en el servidor: sin esto `beforeSendTransaction` no corre. En el
  // navegador el SDK agrega la integración de streaming al arrancar el primer
  // span (`_INTERNAL_ensureBrowserSpanStreaming`), y esa integración no se
  // instala si el ciclo es "static" — no hace falta sacarla a mano.
  traceLifecycle: TRACE_LIFECYCLE,

  tracePropagationTargets: TRACE_PROPAGATION_TARGETS,

  // 100% en desarrollo, 10% en producción.
  tracesSampleRate: environment === "development" ? 1.0 : 0.1,

  // Mismo filtro de privacidad que el servidor. Ver src/lib/sentry-scrub.ts.
  beforeSend,
  beforeSendTransaction,
});

/**
 * Instrumenta las navegaciones del App Router para que las transiciones de ruta
 * aparezcan como spans en Sentry. Solo App Router.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
