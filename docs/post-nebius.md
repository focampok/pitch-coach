# Estado post-Nebius

Documento **después** del baseline [`docs/pre-nebius.md`](pre-nebius.md). Describe el
repositorio en su estado actual: migración a Nebius Token Factory, hardening previo y
todo lo implementado desde entonces (STT universal, bilingüe, hallazgos, Ultra,
Tavily enriquecido, Sentry, historial local, guion descargable, etc.).

**Contraparte viva del mapa archivo ↔ código:** [`docs/status.md`](status.md) (misma
fecha de corte y mismo criterio de verificación). Este archivo enfatiza el **antes /
después** frente al tag `pre-nebius` y la arquitectura de la capa de modelo; el
detalle tabular de implementación no se duplica aquí — vive en `status.md` §1.

| Referencia | Valor |
| --- | --- |
| Baseline | tag `pre-nebius` → `51ddfd6` (2026-08-30) |
| Estado documentado | `HEAD` en `main` al **2026-10-02** → `e90781a` ("feat(stt): download a timed pitch script…") |
| Commits desde el tag | 26 (`git rev-list --count pre-nebius..HEAD`) |
| Diff acumulado vs tag | 117 archivos, +21325 / −2284 (`git diff --shortstat pre-nebius HEAD`) |

Hito Nebius (solo la migración de proveedor, no el repo completo):

```
c018cc6 hardening: secure, determinize and isolate the model layer before Nebius
6024240 docs: document pre-nebius baseline for the Nebius migration
ea1c55e feat(model): add Nebius Token Factory provider, standard + ultra tiers
15902cb feat(modelo): log mínimo no sensible en la ruta de éxito
```

Todo lo posterior en `main` (Scribe, sparring, bilingüe, Tavily fases A/B, Sentry,
historial, guion, etc.) está reflejado en el **resumen de producto** (§4) y en
[`status.md`](status.md).

---

## 1. Arquitectura del análisis (ahora)

La API route no conoce proveedores concretos. El flujo es: **route → caso de uso →
capa neutra → adaptador**.

| Capa | Archivo | Rol |
| --- | --- | --- |
| Entrada HTTP | [`src/app/api/analizar-pitch/route.ts`](../src/app/api/analizar-pitch/route.ts) | Valida cuerpo e `idioma`, límite 8000 caracteres (413), prompt, `analizarConModelo`, compone `ResultadoAnalisis` con muletillas server-side, 502 genérico al cliente |
| Caso de uso | [`src/lib/analisis-modelo.ts`](../src/lib/analisis-modelo.ts) | `system` + `user`, esquema, nombres de puntos, `validarAnalisis` |
| Política compartida | [`src/lib/modelo.ts`](../src/lib/modelo.ts) | Fallbacks, reintentos, backoff, timeout (20 s estándar/rápido; 90 s ultra), parseo JSON |
| Adaptadores | [`proveedor-nebius.ts`](../src/lib/proveedor-nebius.ts), [`proveedor-gemini.ts`](../src/lib/proveedor-gemini.ts) | Solo transporte HTTP |

**Selección de proveedor:** `proveedorActivo()` lee `MODEL_PROVIDER` en cada
llamada. Default **`nebius`**; `gemini` es contingencia manual; otro valor →
`ErrorModelo`.

**Tres niveles Nebius** (`crearProveedorNebius(nivel)`):

| Nivel | Uso en el producto | Modelo | Razonamiento |
| --- | --- | --- | --- |
| `estandar` | Análisis principal del pitch | `MODEL` (default Super) | `enable_thinking: false` |
| `ultra` | Botón "Análisis Ultra" en el dashboard | `NEBIUS_MODEL_ULTRA` | Campo omitido (thinking activo) + `traza` en JSON |
| `rapido` | Sparring, Tavily, validaciones auxiliares | `NEBIUS_MODEL_NANO` | `enable_thinking: false` |

Gemini ignora el nivel (`estandar` / `ultra` / `rapido`): una sola calidad de
modelo vía `GEMINI_*` / `MODEL_*`.

**Esquema restringido (Nebius):** `construirEsquemaAnalisisRestringido(puntos)` en
[`validar-analisis.ts`](../src/lib/validar-analisis.ts) — longitud exacta de
`rubrica`, ítems `{ cumplido, comentario }` sin `punto` ni `score`. Gemini usa el
esquema neutro sin restricción estricta de longitud en el proveedor.

Guía operativa: [`guia-integracion-nebius.md`](guia-integracion-nebius.md).

---

## 2. Contrato de salida (ahora)

El modelo devuelve **solo** evaluación y copy; el servidor asigna ids/nombres de
rúbrica y calcula el **score** de forma determinista:

```
score = clamp( round(cumplidos / total * 80) + clamp(claridad, 0, 20), 0, 100 )
```

JSON típico (análisis estándar):

```json
{
  "veredicto_corto": "Buen problema; falta cerrar el ask.",
  "claridad": 17,
  "rubrica": [
    { "cumplido": true, "comentario": "..." },
    { "cumplido": false, "comentario": "..." }
  ]
}
```

Análisis Ultra añade `"traza": ["paso 1", "..."]` (4–8 pasos). El prompt y el
esquema van en el **idioma de sesión** (`es` / `en`); ver [`alcance.md`](alcance.md)
§15.

Validación local **tolerante** a campos extra del modelo; **estricta** en el número
de ítems de rúbrica (dispara reintento vía capa neutra).

---

## 3. Tabla comparativa (tag `pre-nebius` vs. `HEAD` actual)

| Área | Antes (`pre-nebius`) | Después (`HEAD`, 2026-10-02) |
| --- | --- | --- |
| **Proveedor LLM** | Solo Gemini en `gemini.ts` | Nebius default + Gemini contingencia; capa neutra |
| **Score y nombres de rúbrica** | Los inventaba el modelo | Servidor: ids/nombres por índice + score determinista |
| **Prompt / inyección** | Un string con transcripción embebida | `system` / `user`, transcripción delimitada como dato no confiable |
| **STT** | Web Speech API (Chrome) | MediaRecorder + **ElevenLabs Scribe** (`/api/transcribir`); texto de respaldo |
| **Seguridad XSS** | `dangerouslySetInnerHTML` sin escapar | HTML escapado + resaltado por intervalos |
| **Límites y rate limit** | No existían | 8000 chars, 20 MB audio, 10/10 min (5/10 en `/api/enriquecer`) |
| **Tests** | Ninguno | Vitest: `src/lib/` + rutas API (`npm test`) |
| **Idioma** | Solo español en producto | **es / en** completo (UI, rúbricas, prompts, voz, muletillas) |
| **Ultra** | N/A | Botón en dashboard + traza |
| **Hallazgos** | N/A | "Resolver hallazgos" — `/api/sparring/*`, hasta 3 puntos |
| **Tavily** | `results[0]` simple | Pipeline con entidades, Extract, validación de cifra, frase hablada |
| **Historial** | N/A | `localStorage`, panel "Tu progreso" (20 entradas) |
| **Guion** | N/A | Descarga `.txt` con marcas `[mm:ss.cc]` si Scribe devolvió timestamps |
| **Coach UI** | Avatar reactivo (2 estados) | Indicador de **texto** temporal (UX/UI pendiente) |
| **Observabilidad** | Logs locales | **Sentry** opcional con scrub de PII (ver `sentry.md`, `status.md` §5) |
| **Rutas API** | 3 | 6 (+ sparring pregunta/evaluar, transcribir) |

Detalle fila por fila de la migración Nebius (HTTP, `json_schema`, reintento por
`length`): tabla histórica en commits `ea1c55e`–`15902cb`; el comportamiento
vigente coincide con [`guia-integracion-nebius.md`](guia-integracion-nebius.md).

---

## 4. Estado del producto (alineado con `status.md`)

Resumen al **2026-10-02** — mismo contenido que el bloque inicial de
[`status.md`](status.md). Para la tabla **Implementado ↔ archivos**, usar
`status.md` §1.

**Cerrado:**

- Loop voz → Scribe → muletillas → análisis → dashboard + veredicto a pedido.
- Indicador de coach en texto (`Escuchando…` / `Transcribiendo…` / frases finales).
- Análisis Nebius/Gemini, Ultra, Resolver hallazgos, Tavily enriquecido (2 primeros
  puntos fallidos de la rúbrica), TTS sin autoplay, historial local, modo bilingüe,
  guion descargable, deploy Railway, tests unitarios, Sentry con privacidad.

**Limitaciones conscientes (🟡):**

- Transcripción **no en vivo** (batch Scribe al detener).
- Coach **solo texto**; animación en fase UX/UI (indicador en vivo, **no** un
  orbe/esfera).
- Rate limit **en memoria** por instancia.
- Sin E2E automatizado con micrófono.

**Abierto para la comunidad** (`status.md` §2): historial entre dispositivos,
rúbricas custom, idiomas nuevos, STT Realtime, animación del coach.

---

## 5. Estructura del repo (ahora)

Raíz relevante (sin `node_modules` / `.next`):

```
src/app/api/     analizar-pitch, transcribir, tts, enriquecer, sparring/*
src/components/  selectores, GrabadorVoz, Dashboard, SparringCoach, PanelProgreso, …
src/lib/         modelo, proveedores, rubricas, muletillas, prompts*, tavily*, …
test/            vitest (lib + rutas con fetch mockeado)
docs/            alcance, status, pre/post-nebius, guías, sentry
```

**Demo:** misma URL que en el README de producción
(`pitch-coach-production-1c0c.up.railway.app`). Licencia MIT.

Variables de entorno: [`.env.example`](../.env.example) y `status.md` §3.

---

## 6. Evidencia y pruebas

| Qué | Cómo |
| --- | --- |
| Contrato Nebius real | `scripts/smoke-nebius.mjs` (Node ≥ 22.6, importa `src/lib` sin build) |
| Regresión automática | `npm test` — suite en `test/` (proveedor Nebius, validación, API, Sentry, Tavily, historial, guion, idiomas, …) |
| Nebius en producción | Log `[modelo] proveedor=nebius modelo=…` en Railway (observación operativa; ver `status.md`) |
| Privacidad Sentry | Tests + auditoría documentada en [`sentry.md`](sentry.md) y `status.md` §5 |

**Modo ultra:** implementado en UI y API; la medición sistemática de tokens de
razonamiento en producción no está instrumentada en logs (`modelo.ts` solo imprime
proveedor y modelo en éxito).

---

## 7. Qué no volvió al estado pre-Nebius

Estas piezas **sí cambiaron** respecto al tag `pre-nebius` y **no** se documentan
como "igual que antes":

- STT dejó de ser Web Speech → Scribe batch universal.
- Producto pasó de monolingüe a bilingüe con ids estables de rúbrica.
- Tavily pasó de enriquecimiento mínimo a pipeline con validación y frase hablada.
- Observabilidad: Sentry integrado con scrub agresivo (sin Session Replay).
- Avatar eliminado → indicador textual (decisión de producto en `alcance.md` §5.1).

Lo que **permanece** como en la era post-hardening: sesión anónima, rúbricas fijas
(4×5), sin backend separado, `Dockerfile` solo deploy, Gemini como respaldo manual.

---

## 8. Pendientes técnicos (no confundir con "no implementado")

Items vivos para mantenedores — no son deuda del tag `pre-nebius`:

1. **Rate limit en memoria** — revisar si hay varias réplicas en Railway.
2. **Tokens de modelo en logs** — propagar `usage` desde adaptadores si se quiere
   auditar costo/razonamiento en producción.
3. **Migración Sentry SDK v12** — `beforeSendTransaction` deprecado; planificar
   `beforeSendSpan` (`sentry.md` §10).
4. **Trampa `genAI`** — no instalar SDK `openai` sin desactivar captura de prompts
   (`sentry.md` §3.6.2).
5. **UX/UI** — lenguaje visual del coach y posible STT Realtime (fuera de alcance
   actual en `alcance.md`).

---

## Referencias cruzadas

| Documento | Uso |
| --- | --- |
| [`pre-nebius.md`](pre-nebius.md) | Baseline **antes** del hardening + migración |
| [`status.md`](status.md) | Mapa **vivo** implementado ↔ archivos |
| [`alcance.md`](alcance.md) | Reglas de producto y contratos (incl. bilingüe) |
| [`guia-integracion-nebius.md`](guia-integracion-nebius.md) | HTTP, esquema, smoke test |
| [`README.md`](../README.md) | Entrada rápida y setup |
