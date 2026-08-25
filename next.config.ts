import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 genera/modifica CLAUDE.md al arrancar. Lo desactivamos porque
  // CLAUDE.md en la raíz es la guía de trabajo del proyecto (fuente de verdad).
  agentRules: false,
  // Build standalone para el Dockerfile de Railway: empaqueta el servidor y
  // sus dependencias mínimas en .next/standalone (imagen final más liviana).
  output: "standalone",
};

export default nextConfig;
