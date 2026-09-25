#!/usr/bin/env node
// =============================================================================
// Prueba de humo MANUAL contra Nebius Token Factory (API real).
// =============================================================================
// NO forma parte del suite de vitest y NO se ejecuta en CI: pega a la red real
// y consume cuota. La ejecuta el mantenedor a mano con su propia clave.
//
// Uso:
//   NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs
//   NEBIUS_API_KEY=... node scripts/smoke-nebius.mjs --ultra
//
// Verifica el contrato exacto del adaptador (src/lib/proveedor-nebius.ts):
// envoltorio response_format.json_schema {name, strict, schema} y
// chat_template_kwargs {enable_thinking:false} en modo estándar.
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE_URL_POR_DEFECTO = "https://api.tokenfactory.nebius.com/v1";
const MODELO_POR_DEFECTO = "nvidia/nemotron-3-super-120b-a12b";
const MODELO_ULTRA_POR_DEFECTO = "nvidia/Nemotron-3-Ultra-550b-a55b";

const esUltra = process.argv.includes("--ultra");

/** Carga .env.local sin dependencias (solo si la variable no existe ya). */
function cargarEnvLocal() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let contenido;
  try {
    contenido = readFileSync(resolve(raiz, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual === -1) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

cargarEnvLocal();

const apiKey = process.env.NEBIUS_API_KEY;
if (!apiKey) {
  console.error(
    "Falta NEBIUS_API_KEY. Defínela en el entorno o en .env.local antes de correr la prueba de humo.",
  );
  process.exit(1);
}

const baseUrl = (process.env.NEBIUS_BASE_URL?.trim() || BASE_URL_POR_DEFECTO).replace(/\/+$/, "");
const modelo = esUltra
  ? process.env.NEBIUS_MODEL_ULTRA?.trim() || MODELO_ULTRA_POR_DEFECTO
  : process.env.MODEL?.trim() || MODELO_POR_DEFECTO;
const maxTokens = Number(process.env.MODEL_MAX_TOKENS) || 1024;
const temperature = Number(process.env.MODEL_TEMPERATURE) || 0.7;

// Esquema mínimo con la MISMA forma restringida que envía el adaptador.
const PUNTOS = ["Problema claro"];
const esquema = {
  type: "object",
  additionalProperties: false,
  required: ["veredicto_corto", "claridad", "rubrica"],
  properties: {
    veredicto_corto: { type: "string" },
    claridad: { type: "integer" },
    rubrica: {
      type: "array",
      minItems: PUNTOS.length,
      maxItems: PUNTOS.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["punto", "cumplido", "comentario"],
        properties: {
          punto: { type: "string", enum: PUNTOS },
          cumplido: { type: "boolean" },
          comentario: { type: "string" },
        },
      },
    },
  },
};

const body = {
  model: modelo,
  messages: [
    {
      role: "system",
      content:
        "Eres un coach de pitches. Devuelve SOLO el JSON estructurado, en español, sin texto adicional.",
    },
    {
      role: "user",
      content:
        "Pitch de prueba: 'Tenemos un problema claro: las pymes no encuentran talento técnico'. Evalúa el único punto de la rúbrica.",
    },
  ],
  temperature,
  max_tokens: maxTokens,
  response_format: {
    type: "json_schema",
    json_schema: { name: "analisis_pitch", strict: true, schema: esquema },
  },
};

if (!esUltra) {
  body.chat_template_kwargs = { enable_thinking: false };
}

const url = `${baseUrl}/chat/completions`;
console.log(`POST ${url}`);
console.log(`modelo: ${modelo} | nivel: ${esUltra ? "ultra" : "estandar"} | max_tokens: ${maxTokens}`);

let respuesta;
try {
  respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
} catch (error) {
  console.error(`Error de red/timeout: ${error.message}`);
  process.exit(1);
}

const texto = await respuesta.text();
console.log(`\nHTTP ${respuesta.status}`);

if (!respuesta.ok) {
  console.error(`Respuesta de error:\n${texto}`);
  process.exit(1);
}

let cuerpo;
try {
  cuerpo = JSON.parse(texto);
} catch {
  console.error(`La respuesta no es JSON:\n${texto}`);
  process.exit(1);
}

const eleccion = cuerpo.choices?.[0];
const contenido = eleccion?.message?.content ?? "";
const finishReason = eleccion?.finish_reason ?? "(sin finish_reason)";
const uso = cuerpo.usage ?? {};

console.log(`finish_reason: ${finishReason}`);
console.log(`usage: prompt=${uso.prompt_tokens ?? "?"} completion=${uso.completion_tokens ?? "?"} reasoning=${uso.completion_tokens_details?.reasoning_tokens ?? "?"}`);

if (!esUltra && (uso.completion_tokens_details?.reasoning_tokens ?? 0) !== 0) {
  console.warn("AVISO: se esperaban 0 tokens de razonamiento con enable_thinking:false.");
}

if (finishReason === "length") {
  console.warn("AVISO: respuesta truncada (length). El adaptador reintentaría con max_tokens duplicado.");
}

let parseado = false;
try {
  JSON.parse(contenido);
  parseado = true;
} catch {
  /* se reporta abajo */
}

console.log(`\ncontent parsea como JSON: ${parseado ? "sí" : "NO"}`);
console.log(`content (recortado):\n${contenido.slice(0, 800)}`);

process.exit(parseado && finishReason !== "length" ? 0 : 1);
