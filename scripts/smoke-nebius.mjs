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
//
// IMPORTANTE: el esquema NO se duplica aquí. Se importa la MISMA función que
// usa el adaptador de producción (`construirEsquemaAnalisisRestringido`) y la
// MISMA validación server-side (`validarAnalisis`), de modo que la prueba de
// humo falla si producción y script se desalinean. Node ≥ 22.6 ejecuta los
// `.ts` de `src/lib` directamente (type stripping nativo), así que no hace
// falta ningún runner ni build previo.
// =============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Módulos de PRODUCCIÓN (sin duplicar lógica). Rutas relativas con extensión
// `.ts`: es lo que exige el resolver de Node al importar TypeScript.
import {
  construirEsquemaAnalisisRestringido,
  validarAnalisis,
} from "../src/lib/validar-analisis.ts";
import { RUBRICAS } from "../src/lib/rubricas.ts";
import { construirPrompt } from "../src/lib/prompts.ts";

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

// --- Contexto de la prueba: la rúbrica REAL de producción (5 puntos) ---------
const tipoPitch = "capital";
const rubrica = RUBRICAS[tipoPitch];
const puntos = rubrica.map(({ punto }) => punto);

const transcripcion =
  "Hola, somos Talently. El problema es claro: las pymes de LATAM pierden meses " +
  "buscando talento técnico y no lo encuentran. Nuestro mercado es el reclutamiento " +
  "técnico de la región, unos 3 mil millones de dólares al año. La solución es una " +
  "plataforma que valida habilidades con retos reales y no con CVs; nos diferencia " +
  "que el candidato se evalúa trabajando. Ya tenemos 120 empresas pagando y crecimos " +
  "20 por ciento mes a mes. Buscamos 500 mil dólares para duplicar el equipo de ventas.";

const prompt = construirPrompt({
  transcripcion,
  tipoPitch,
  rubrica,
  tiempoMaximoSegundos: 60,
  tiempoRealSegundos: 48,
});

// --- Esquema EXACTO de producción (misma función que usa el adaptador) -------
const esquema = construirEsquemaAnalisisRestringido(puntos);
const itemsRubrica = esquema.properties.rubrica.items;

console.log("=== Esquema de producción (construirEsquemaAnalisisRestringido) ===");
console.log(`puntos de la rúbrica (${puntos.length}): ${puntos.join(" | ")}`);
console.log(`rubrica.minItems === maxItems: ${esquema.properties.rubrica.minItems} === ${esquema.properties.rubrica.maxItems}`);
console.log(`items.required: ${JSON.stringify(itemsRubrica.required)}`);
console.log(`items.additionalProperties: ${itemsRubrica.additionalProperties}`);
console.log(`items.properties: ${JSON.stringify(Object.keys(itemsRubrica.properties))}`);
console.log(`items tiene "punto": ${Object.prototype.hasOwnProperty.call(itemsRubrica.properties, "punto")}`);

const body = {
  model: modelo,
  messages: [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
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
console.log(`\nPOST ${url}`);
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

// --- JSON COMPLETO del content, sin recortar ---------------------------------
console.log("\n=== content completo (sin recortar) ===");
console.log(contenido);
console.log("=== fin del content ===");

// --- Paso 1: parsea como JSON ------------------------------------------------
let parseado = null;
try {
  parseado = JSON.parse(contenido);
} catch (error) {
  console.error(`\ncontent parsea como JSON: NO — ${error.message}`);
  process.exit(1);
}
console.log(`\ncontent parsea como JSON: sí`);

// --- Paso 2: validación REAL de producción (validarAnalisis) ----------------
let valido = false;
try {
  const analisis = validarAnalisis(parseado, rubrica);
  valido = true;
  console.log("\nvalidarAnalisis(): OK");
  console.log(`  score: ${analisis.score}`);
  console.log(`  veredicto_corto: ${analisis.veredicto_corto}`);
  console.log(`  rubrica: ${analisis.rubrica.length} ítem(s)`);
} catch (error) {
  console.error(`\nvalidarAnalisis(): LANZÓ ${error.name}: ${error.message}`);
}

// --- Paso 3: forma cruda del JSON devuelto (independiente de la validación) --
const rubricaCruda = parseado?.rubrica;
console.log("\n=== forma del JSON devuelto por el modelo ===");
console.log(`rubrica es array: ${Array.isArray(rubricaCruda)}`);
if (Array.isArray(rubricaCruda)) {
  console.log(`rubrica.length: ${rubricaCruda.length} (esperado: ${puntos.length})`);
  console.log(`exactamente ${puntos.length} ítems: ${rubricaCruda.length === puntos.length}`);
  rubricaCruda.forEach((item, i) => {
    const claves = item && typeof item === "object" ? Object.keys(item) : [];
    console.log(`  [${i}] punto asignado por el servidor: "${rubrica[i]?.punto ?? "(sin rúbrica)"}" | claves del modelo: ${JSON.stringify(claves)}`);
  });
}

const ok = valido && finishReason !== "length" && Array.isArray(rubricaCruda) && rubricaCruda.length === puntos.length;
console.log(`\nRESULTADO: ${ok ? "OK" : "FALLÓ"}`);
process.exit(ok ? 0 : 1);
