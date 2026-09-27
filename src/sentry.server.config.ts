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
 * Runtime Node.js: rutas de API bajo src/app/api/*, Server Components y
 * Server Actions.
 *
 * PRIVACIDAD — ver src/lib/sentry-scrub.ts y docs/status.md.
 *
 * `dataCollection` se define con `userInfo: false` a propósito (ver el porqué
 * completo en src/lib/sentry-options.ts): es lo que impide que la IP del
 * cliente salga hacia Sentry. No alcanza con omitir la opción, porque en v11 su
 * default es permisivo.
 *
 * `includeLocalVariables` tampoco se activa: las variables locales de los stack
 * frames del pipeline de análisis contienen el texto del pitch.
 *
 * `traceLifecycle: "static"` es necesario para que `beforeSendTransaction` no
 * sea código muerto: con el default (`"stream"`) el SDK lo ignora. El porqué
 * completo, en src/lib/sentry-options.ts.
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

  // Última barrera antes de que algo salga hacia un tercero. Ver
  // src/lib/sentry-scrub.ts y docs/status.md.
  beforeSend,
  beforeSendTransaction,
});
