import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuración de vitest para las pruebas unitarias de la lógica de negocio
// (src/lib/). Entorno node: son módulos puros, sin DOM. El alias "@" replica el
// de tsconfig.json para importar igual que en el resto del proyecto.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
