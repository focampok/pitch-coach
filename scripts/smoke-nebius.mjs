#!/usr/bin/env node
// =============================================================================
// Prueba de humo MANUAL contra Nebius Token Factory (API real).
// =============================================================================
// NO forma parte del suite de vitest y NO se ejecuta en CI: pega a la red real
// y consume cuota. La ejecuta el mantenedor a mano con su propia clave.
//
// Uso:
//   node scripts/smoke-nebius.mjs                      # español, 3 fixtures
//   node scripts/smoke-nebius.mjs --lang en            # inglés, 3 fixtures
//   node scripts/smoke-nebius.mjs --lang en --ultra
//   node scripts/smoke-nebius.mjs --fixture debil      # un solo fixture
//
// QUÉ MIDE
// Además de verificar el contrato del adaptador, corre el MISMO pitch en tres
// niveles de calidad (fuerte / medio / débil) y comprueba que el evaluador los
// ORDENE. Con `--lang en` eso mismo se corre sobre transcripciones en inglés:
// la pregunta es si el evaluador distingue calidad en inglés igual que en
// español, o si el score se aplana. Imprime la tabla de puntos cumplidos por
// fixture, que es donde se ve POR QUÉ un score salió como salió.
//
// COSTO: una petición por fixture (3 por corrida, salvo --fixture).
//
// Verifica el contrato exacto del adaptador (src/lib/proveedor-nebius.ts):
// envoltorio response_format.json_schema {name, strict, schema} y
// chat_template_kwargs {enable_thinking:false} en modo estándar.
// Con --ultra usa el mismo esquema restringido de producción CON `traza`
// (incluirTraza: true), el prompt de nivel ultra, nombre analisis_pitch_ultra
// y validarAnalisis(..., { exigirTraza: true }).
//
// IMPORTANTE: el esquema, el prompt y la validación NO se duplican aquí. Se
// importan las MISMAS funciones que usa producción
// (`construirEsquemaAnalisisRestringido`, `construirPrompt`, `validarAnalisis`),
// de modo que la prueba de humo falla si producción y script se desalinean.
// Node ≥ 22.6 ejecuta los `.ts` de `src/lib` directamente (type stripping
// nativo), así que no hace falta ningún runner ni build previo.
//
// OJO AL IMPORTAR: Node solo resuelve imports de PROYECTO si son `import type`
// (se borran) o si llevan la extensión `.ts` explícita. Un import de valor sin
// extensión —por ejemplo el diccionario— rompe este script.
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

/** Nombre del pitch type en el idioma del prompt (lo pone el llamador, no el prompt). */
const NOMBRE_TIPO = { es: "Capital", en: "Capital" };

/** Orden esperado de peor a mejor. La prueba de discriminación usa este orden. */
const CALIDADES = ["debil", "medio", "fuerte"];

// --- Fixtures: el MISMO pitch en tres niveles de calidad, por idioma --------
// "fuerte" cubre los 5 puntos de la rúbrica de capital; "medio" cubre el
// problema, la solución y el ask; "débil" no aterriza ninguno con evidencia.
const FIXTURES = {
  es: {
    fuerte:
      "Hola, somos Talently. El problema es claro: las pymes de LATAM pierden meses " +
      "buscando talento técnico y no lo encuentran; 7 de cada 10 vacantes siguen " +
      "abiertas a los 90 días. Nuestro mercado es el reclutamiento técnico de la " +
      "región, unos 3 mil millones de dólares al año, creciendo 15 por ciento anual. " +
      "La solución es una plataforma que valida habilidades con retos reales pagados " +
      "y no con CVs; nos diferencia que el candidato se evalúa trabajando, no " +
      "conversando. Ya tenemos 120 empresas pagando, 40 mil dólares de ingreso " +
      "recurrente mensual y crecimos 20 por ciento mes a mes durante seis meses. " +
      "Buscamos 500 mil dólares para duplicar el equipo de ventas y abrir México y Colombia.",
    medio:
      "Hola, soy Maya y estoy al frente de Talently. El problema que atacamos es que " +
      "contratar gente técnica es lento y caro para las empresas que están creciendo. " +
      "Nuestro producto es una plataforma que ayuda a los equipos a encontrar y validar " +
      "ingenieros más rápido, y creo que es bastante distinta de un portal de empleo " +
      "normal. Llevamos un año trabajando en esto y aprendimos mucho de los primeros " +
      "usuarios. Buscamos una inversión para hacer crecer al equipo y llegar a más " +
      "clientes, y nos encantaría conversar sobre cómo podría ser eso para ustedes.",
    debil:
      "Hola. Bueno, les voy a contar sobre mi proyecto. Es una plataforma. Es para " +
      "empresas. Queremos ayudar a la gente a encontrar trabajo y a las empresas a " +
      "encontrar gente. Creo que es una buena idea porque contratar es difícil. " +
      "Tenemos un equipo y la estamos construyendo. Gracias por escuchar, espero que " +
      "les guste.",
  },
  en: {
    fuerte:
      "Hi, I'm Maya from Talently. The problem is sharp: small companies across Latin " +
      "America lose months hunting for technical talent they never find, and 7 out of " +
      "10 roles stay open past 90 days. The market is technical recruiting in the " +
      "region, roughly 3 billion dollars a year, growing 15 percent annually. We solve " +
      "it with a platform that validates skills through real paid challenges instead of " +
      "CVs, so what sets us apart is that candidates are evaluated while doing the work, " +
      "not while talking about it. We already have 120 companies paying, 40 thousand " +
      "dollars in monthly recurring revenue, and we grew 20 percent month over month for " +
      "six months. We are raising 500 thousand dollars to double the sales team and open " +
      "operations in Mexico and Colombia.",
    medio:
      "Hi, I'm Maya and I run Talently. The problem we tackle is that hiring technical " +
      "people is slow and expensive for companies that are growing. Our product is a " +
      "platform that helps teams find and validate engineers faster, and I think it is " +
      "quite different from a normal job board. We have been working on this for a year " +
      "and we learned a lot from our first users. We are looking for an investment to " +
      "grow the team and reach more customers, and we would love to talk about what that " +
      "could look like for you.",
    debil:
      "Hello. So, I am going to talk about my project. It is a platform. It is for " +
      "companies. We want to help people find jobs and help companies find people. " +
      "I think it is a good idea because hiring is hard. We have a team and we are " +
      "building it. Thank you for listening, I hope you like it.",
  },
};

// --- Argumentos -------------------------------------------------------------

function valorDe(nombre) {
  const indice = process.argv.indexOf(nombre);
  if (indice === -1) return null;
  const valor = process.argv[indice + 1];
  if (!valor || valor.startsWith("--")) {
    console.error(`Falta el valor de ${nombre}.`);
    process.exit(1);
  }
  return valor;
}

const esUltra = process.argv.includes("--ultra");
const idioma = valorDe("--lang") ?? "es";
const soloFixture = valorDe("--fixture");

if (idioma !== "es" && idioma !== "en") {
  console.error(`--lang inválido: "${idioma}". Valores válidos: es, en.`);
  process.exit(1);
}
if (soloFixture && !CALIDADES.includes(soloFixture)) {
  console.error(`--fixture inválido: "${soloFixture}". Valores válidos: ${CALIDADES.join(", ")}.`);
  process.exit(1);
}

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
const maxTokens = Number(process.env.MODEL_MAX_TOKENS) || (esUltra ? 2048 : 1024);
const temperature = Number(process.env.MODEL_TEMPERATURE) || 0.7;
const timeoutMs = esUltra ? 90_000 : 60_000;

// --- Contexto compartido: la rúbrica REAL de producción ---------------------
const tipoPitch = "capital";
const rubrica = RUBRICAS[tipoPitch];
const puntos = rubrica.map((punto) => punto.id);

// --- Esquema EXACTO de producción (misma función que usa el adaptador) ------
const esquema = construirEsquemaAnalisisRestringido(puntos, {
  idioma,
  incluirTraza: esUltra,
});
const itemsRubrica = esquema.properties.rubrica.items;
const nombreEsquema = esUltra ? "analisis_pitch_ultra" : "analisis_pitch";

console.log("=== Corrida ===");
console.log(`idioma: ${idioma} | nivel: ${esUltra ? "ultra" : "estandar"} | modelo: ${modelo}`);
console.log(`fixtures: ${soloFixture ?? CALIDADES.join(", ")}`);
console.log(`url: ${baseUrl}/chat/completions | max_tokens: ${maxTokens}`);

console.log("\n=== Esquema de producción (construirEsquemaAnalisisRestringido) ===");
console.log(`puntos de la rúbrica (${puntos.length}): ${puntos.join(" | ")}`);
console.log(`incluirTraza: ${esUltra}`);
console.log(`required: ${JSON.stringify(esquema.required)}`);
console.log(`properties: ${JSON.stringify(Object.keys(esquema.properties))}`);
console.log(`rubrica.minItems === maxItems: ${esquema.properties.rubrica.minItems} === ${esquema.properties.rubrica.maxItems}`);
console.log(`items.required: ${JSON.stringify(itemsRubrica.required)}`);
console.log(`items.additionalProperties: ${itemsRubrica.additionalProperties}`);
console.log(`items.properties: ${JSON.stringify(Object.keys(itemsRubrica.properties))}`);
console.log(`items tiene "punto": ${Object.prototype.hasOwnProperty.call(itemsRubrica.properties, "punto")}`);
if (esUltra) {
  const trazaEsquema = esquema.properties.traza;
  console.log(`traza.minItems === maxItems: ${trazaEsquema?.minItems} === ${trazaEsquema?.maxItems} (esperado: 4 === 8)`);
}

// --- Una corrida por fixture ------------------------------------------------

/** Manda un fixture al modelo y devuelve el análisis validado + diagnóstico. */
async function analizar(transcripcion) {
  const prompt = construirPrompt({
    transcripcion,
    tipoNombre: NOMBRE_TIPO[idioma],
    rubrica,
    idioma,
    tiempoMaximoSegundos: 60,
    tiempoRealSegundos: 48,
    nivel: esUltra ? "ultra" : "estandar",
  });

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
      json_schema: { name: nombreEsquema, strict: true, schema: esquema },
    },
  };

  if (!esUltra) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  let respuesta;
  try {
    respuesta = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { error: `Error de red/timeout: ${error.message}` };
  }

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    return { error: `HTTP ${respuesta.status}: ${texto.slice(0, 400)}` };
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return { error: `La respuesta no es JSON: ${texto.slice(0, 400)}` };
  }

  const eleccion = cuerpo.choices?.[0];
  const contenido = eleccion?.message?.content ?? "";
  const finishReason = eleccion?.finish_reason ?? "(sin finish_reason)";
  const uso = cuerpo.usage ?? {};

  let parseado = null;
  try {
    parseado = JSON.parse(contenido);
  } catch (error) {
    return { error: `El content no parsea como JSON: ${error.message}`, contenido, finishReason, uso };
  }

  let analisis = null;
  let errorValidacion = null;
  try {
    analisis = validarAnalisis(parseado, rubrica, { exigirTraza: esUltra });
  } catch (error) {
    errorValidacion = `${error.name}: ${error.message}`;
  }

  return { analisis, errorValidacion, parseado, contenido, finishReason, uso };
}

const resultados = [];

for (const calidad of CALIDADES) {
  if (soloFixture && calidad !== soloFixture) continue;

  console.log(`\n${"=".repeat(78)}`);
  console.log(`FIXTURE: ${calidad.toUpperCase()} (${idioma})`);
  console.log("=".repeat(78));
  console.log(`transcripción:\n${FIXTURES[idioma][calidad]}\n`);

  const resultado = await analizar(FIXTURES[idioma][calidad]);
  resultados.push({ calidad, ...resultado });

  if (resultado.error) {
    console.error(`FALLÓ: ${resultado.error}`);
    if (resultado.contenido) console.error(`content:\n${resultado.contenido}`);
    continue;
  }

  console.log(
    `finish_reason: ${resultado.finishReason} | usage: prompt=${resultado.uso.prompt_tokens ?? "?"} completion=${resultado.uso.completion_tokens ?? "?"} reasoning=${resultado.uso.completion_tokens_details?.reasoning_tokens ?? "?"}`,
  );

  if (!esUltra && (resultado.uso.completion_tokens_details?.reasoning_tokens ?? 0) !== 0) {
    console.warn("AVISO: se esperaban 0 tokens de razonamiento con enable_thinking:false.");
  }
  if (resultado.finishReason === "length") {
    console.warn("AVISO: respuesta truncada (length). El adaptador reintentaría con max_tokens duplicado.");
  }

  if (resultado.errorValidacion) {
    console.error(`validarAnalisis(): LANZÓ ${resultado.errorValidacion}`);
    console.error(`content:\n${resultado.contenido}`);
    continue;
  }

  const { analisis, parseado } = resultado;
  console.log(`\nvalidarAnalisis(): OK | score: ${analisis.score}`);
  console.log(`veredicto_corto: ${analisis.veredicto_corto}`);

  const rubricaCruda = parseado?.rubrica;
  console.log(`\nrubrica: es array: ${Array.isArray(rubricaCruda)} | length: ${Array.isArray(rubricaCruda) ? rubricaCruda.length : "(no es array)"} (esperado: ${puntos.length})`);

  console.log("\n  punto (id)                 | cumplido | claves del modelo | comentario");
  console.log("  ---------------------------+----------+-------------------+-----------");
  analisis.rubrica.forEach((item, i) => {
    const claves = rubricaCruda?.[i] && typeof rubricaCruda[i] === "object" ? Object.keys(rubricaCruda[i]) : [];
    console.log(
      `  ${item.punto.padEnd(26)} | ${String(item.cumplido).padEnd(8)} | ${JSON.stringify(claves).padEnd(17)} | ${item.comentario}`,
    );
  });

  const cumplidos = analisis.rubrica.filter((item) => item.cumplido).length;
  console.log(`\ncumplidos: ${cumplidos}/${puntos.length}`);

  if (esUltra) {
    const n = analisis.traza?.length ?? 0;
    console.log(`traza: ${n} paso(s) (esperado: 4 a 8) | en rango: ${n >= 4 && n <= 8}`);
    for (const [i, paso] of (analisis.traza ?? []).entries()) {
      console.log(`  [${i + 1}] ${paso}`);
    }
  }
}

// --- Resumen: ¿el evaluador distingue calidad en este idioma? ---------------

const conScore = resultados.filter((r) => r.analisis);

if (conScore.length > 0) {
  console.log(`\n${"=".repeat(78)}`);
  console.log(`RESUMEN (${idioma}${esUltra ? ", ultra" : ""})`);
  console.log("=".repeat(78));
  console.log("  calidad  | score | cumplidos | veredicto");
  console.log("  ---------+-------+-----------+---------");
  for (const calidad of CALIDADES) {
    const r = resultados.find((item) => item.calidad === calidad);
    if (!r) continue;
    if (!r.analisis) {
      console.log(`  ${calidad.padEnd(8)} |   —   |     —     | (sin resultado válido)`);
      continue;
    }
    const cumplidos = r.analisis.rubrica.filter((item) => item.cumplido).length;
    console.log(
      `  ${calidad.padEnd(8)} | ${String(r.analisis.score).padStart(5)} | ${String(`${cumplidos}/${puntos.length}`).padStart(9)} | ${r.analisis.veredicto_corto}`,
    );
  }
}

const scores = CALIDADES.map((calidad) =>
  resultados.find((item) => item.calidad === calidad)?.analisis?.score,
);
const completo = scores.every((score) => typeof score === "number");
const [debil, medio, fuerte] = scores;
const discrimina = completo && debil < medio && medio < fuerte;

if (completo) {
  console.log(
    `\norden esperado debil < medio < fuerte: ${discrimina ? "SÍ" : "NO"} → debil=${debil} medio=${medio} fuerte=${fuerte}`,
  );
}

const todoValido = resultados.every((r) => r.analisis && !r.errorValidacion);
const ok = todoValido && (soloFixture ? true : discrimina);

console.log(`\nRESULTADO: ${ok ? "OK" : "FALLÓ"}`);
if (!soloFixture && completo && !discrimina) {
  console.log(
    "El evaluador NO ordenó los tres niveles de calidad. Revisar la tabla de puntos: ahí se ve qué punto se marcó mal.",
  );
}
if (!todoValido) {
  console.log("Al menos un fixture no devolvió un análisis válido (ver los FALLÓ de arriba).");
}
process.exit(ok ? 0 : 1);
