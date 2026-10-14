import { beforeEach } from "vitest";

// LIVE_DEMO distinto de "true" responde 503 en las rutas de proveedor antes de
// llamar a Nebius, ElevenLabs o Tavily. Los tests existentes cubren el producto
// con la demo encendida y sin cupo (EVAL_LIMIT vacío), igual que main.
beforeEach(() => {
  process.env.LIVE_DEMO = "true";
  delete process.env.EVAL_LIMIT;
  delete process.env.EVAL_COOKIE_SECRET;
  delete process.env.DEMO_VIDEO_URL;
  delete process.env.CONTACTO;
});
