import * as Sentry from "@sentry/nextjs";
import {
  DATA_COLLECTION,
  TRACE_LIFECYCLE,
  TRACE_PROPAGATION_TARGETS,
  sentryEnabled,
  sentryEnvironment,
  sentryTracesSampleRate,
} from "./lib/sentry-options";
import { beforeSend, beforeSendTransaction } from "./lib/sentry-scrub";

/**
 * Runtime Edge: middleware y route handlers que corran en el borde.
 * El runtime Edge tiene APIs de Node limitadas, así que esta config se mantiene
 * deliberadamente escueta.
 *
 * Misma nota de privacidad que src/sentry.server.config.ts: `dataCollection`
 * con `userInfo: false` es lo que impide reportar la IP del cliente, y
 * `traceLifecycle: "static"` es lo que hace que `beforeSendTransaction` corra
 * (ver src/lib/sentry-options.ts).
 */
const environment = sentryEnvironment();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  enabled: sentryEnabled(),
  dataCollection: DATA_COLLECTION,
  traceLifecycle: TRACE_LIFECYCLE,
  tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
  tracesSampleRate: sentryTracesSampleRate(environment),

  // Mismo filtro de privacidad que el runtime Node. Ver src/lib/sentry-scrub.ts.
  beforeSend,
  beforeSendTransaction,
});
