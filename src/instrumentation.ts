import * as Sentry from "@sentry/nextjs";

/**
 * Server-side registration hook.
 *
 * Next.js runs the app in three runtimes (browser, Node.js, Edge) and calls
 * `register()` once per server runtime at startup, so we load the matching
 * Sentry config based on NEXT_RUNTIME. The browser bundle never goes through
 * here — Next.js loads `instrumentation-client.ts` directly.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Captures unhandled errors from Server Components, route handlers and
 * middleware without needing a manual `captureException` in each one.
 * Requires @sentry/nextjs >= 8.28.0 (we're on v11).
 */
export const onRequestError = Sentry.captureRequestError;
