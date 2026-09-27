import type { NextConfig } from "next";
// En @sentry/nextjs v11 `withSentryConfig` vive en el subpath /config, no en la
// raíz del paquete (la raíz es el runtime del SDK, que no debe cargarse en el
// build de Next).
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Next.js 16 genera/modifica CLAUDE.md al arrancar. Lo desactivamos porque
  // CLAUDE.md en la raíz es la guía de trabajo del proyecto (fuente de verdad).
  agentRules: false,
  // Build standalone para el Dockerfile de Railway: empaqueta el servidor y
  // sus dependencias mínimas en .next/standalone (imagen final más liviana).
  output: "standalone",
};

export default withSentryConfig(nextConfig, {
  // Org y proyecto de Sentry. Se leen de entorno para no hardcodear
  // identificadores del proyecto en el repo (mismo criterio que las API keys).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Token de subida de source maps. Es un secreto de build-time (distinto del
  // DSN): en local va en .env.sentry-build-plugin (gitignoreado) y en Railway
  // en las variables del proyecto. Sin él, el build no sube los mapas y los
  // stack traces de producción aparecen minificados.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Sube un conjunto más amplio de archivos del cliente, para que los stack
  // traces del navegador resuelvan mejor.
  widenClientFileUpload: true,

  // Ruta proxy para esquivar bloqueadores de anuncios.
  tunnelRoute: "/monitoring",

  // Sin output verboso fuera de CI.
  silent: !process.env.CI,
});
