# Pitch Coach — revisión para el Nebius x NVIDIA Global AI Hackathon

Revisión del **4 oct 2026** (America/Guatemala). Código leído en la máquina local, path `/home/focampo/Proyectos/pitch-coach`, HEAD `48519996` (`feat(ui): propuesta de valor en masthead y pie con atribución`, 2 oct 2026 20:37 GT). No se modificó ese árbol, no se hizo commit, no se inscribió a nadie y no se desplegó nada.

Páginas vivas de este pase: [overview](https://nebiusglobalaihackathon.devpost.com/), [official rules](https://nebiusglobalaihackathon.devpost.com/rules), [fechas](https://nebiusglobalaihackathon.devpost.com/details/dates), [recursos](https://nebiusglobalaihackathon.devpost.com/resources) (el fetch devolvió poco markdown; el detalle de créditos se contrasta con el extract del mismo día), [kickoff](https://nebiusglobalaihackathon.devpost.com/updates/46203-kickoff-tips), hilo del foro sin respuesta visible [45215](https://nebiusglobalaihackathon.devpost.com/forum_topics/45215-can-one-project-win-an-overall-award-and-best-use-of-tavily). Primitiva de jobs: [docs.nebius.com/serverless/overview](https://docs.nebius.com/serverless/overview) y [docs.nebius.com/serverless/jobs/manage](https://docs.nebius.com/serverless/jobs/manage). Notas previas del mismo evento: `/workspace/hackathon-scout/nebius-global-ai-hackathon/extract.md` (4 oct ~08:10 GT) y `/workspace/hackathon-scout/nebius-nvidia-2026/` (28 sep–3 oct). Si una frase de recursos contradice las rules, mandan las rules (§11.4).

## 1. Veredicto

Pitch Coach es un coach de pitch hablado, anónimo y bilingüe (es/en). El usuario elige tipo (capital, educación, innovación, tecnología) y duración, graba o pega texto, y recibe score, rúbrica de cinco puntos, muletillas, veredicto escuchable y, si falta un punto, una cifra citada. Encaja en **Best Apps and Agents**, no en Coding (no escribe ni testea código), no en Personal AI (el historial es `localStorage` de esta sesión de navegador, no un asistente que actúa) y no en Physical AI.

La regla dura de runtime **sí está en el código**: con `MODEL_PROVIDER` vacío o `nebius`, el servidor llama a `https://api.tokenfactory.nebius.com/v1/chat/completions` y los defaults son tres Nemotron 3 (Super, Ultra, Nano). Tavily también es una llamada real, no un mock, pero solo para como máximo dos puntos. La demo [pitch-coach-production-1c0c.up.railway.app](https://pitch-coach-production-1c0c.up.railway.app/) respondió el 4 oct con la home. No se verificó que ese deploy tenga `NEBIUS_API_KEY` ni `TAVILY_API_KEY`: no se leyó `.env.local` y no se envió un pitch.

El fetch público sin login de `https://github.com/focampok/pitch-coach` ahora devuelve 200: el 404 está corregido y la página marca el repositorio como público. El HTML público también muestra la etiqueta `MIT license`; la licencia MIT debe seguir visible en el About. El repo ya no es el bloqueo que describía la revisión anterior. La mejora que más cambia el producto, y no solo el hosting, es un **Serverless Job** (VM sin GPU) que arma un acta de comité sobre los cinco puntos y sale. Un Endpoint que rehospede el Next actual no añade eso.

## 2. Reglas que importan para este repo

Fuente principal: [official rules](https://nebiusglobalaihackathon.devpost.com/rules), leídas el 4 oct 2026. El widget del overview dice lo mismo sobre el cierre: «Oct 30, 2026 @ 10:00am PDT» y «October 30 at 1:00pm EDT». Guatemala no cambia de horario (UTC-6).

| Hito | Hora oficial | GT |
|---|---|---|
| Apertura | mié 26 ago 2026, 9:00am PDT | mié 26 ago 2026, 10:00 |
| Cierre de submissions | vie 30 oct 2026, 10:00am PDT | **vie 30 oct 2026, 11:00** |
| Judging | mar 1 dic 2026 9:00am PST → mar 15 dic 2026 12:00pm PST | 1 dic 11:00 → 15 dic 14:00 |
| Ganadores | «on or around» lun 11 ene 2027, 12:00pm Pacific | ~11 ene 2027, 14:00 |
| Mantenimiento Devpost (banner en /details/dates) | 7 oct 2026, 6:00 UTC / 2:00am ET | mié 7 oct 2026, 00:00 |

Desde el domingo 4 oct 2026 quedan 26 días hasta ese viernes 11:00. El judging no pide más build.

**Premios en cash, tal como están en rules y en el overview.** Grand $20,000, 2.º $10,000, 3.º $6,000, los cuatro tracks un Jetson Orin Nano cada uno (sin valor en USD en las rules), Best Use of Tavily **$3,000**, City Winner $500 × 20, Most Valuable Feedback $100 × 10 más «NVIDIA swag pack». El overview dice «$50,000 in cash» y «$50,000+ in prizes». La suma 20+10+6+3+20×500+10×100 da 50,000; el «+» son los Jetson y el swag. No hay otra bolsa publicada en esas páginas.

**Un premio, no varios.** Texto de las rules: «Each Project is eligible for one (1) Overall Award OR one (1) Track Award and one (1) Bonus Award.» Tavily, City y Feedback están en la tabla bajo Bonus Awards. El hilo 45215 pregunta si un Overall sigue pudiendo llevar Tavily y si Feedback cuenta como bono; el fetch no mostró respuesta del organizador. Hasta que la haya, leer la tabla: un solo bono, y Feedback entra en esa lista. Para este repo el bono que el código ya persigue es Tavily. City no aplica desde Guatemala: las rules exigen haber **attended** un Builders & Brews y la lista no incluye Guatemala (sí Mexico City). La página de recursos dice que basta asociar el envío a una ciudad; §11.4 dice que mandan las rules.

**Regla dura de plataforma.** «A working software application that runs on either Nebius Token Factory or Nebius AI Cloud and uses at least one NVIDIA open source model.» «Runs on…» significa llamada en **runtime** al API de inferencia de Token Factory, **o** deploy/ejecución en AI Cloud (Serverless Jobs, Serverless Endpoints o DevPods). El kickoff nombra Nemotron, GR00T, Cosmos o Sonic. El track Best Apps pide Nemotron en Token Factory: Ultra para razonamiento pesado, Nano o Super para lo rápido, y **anima** (no obliga) a Serverless Endpoints o Jobs.

**Tavily.** El bono de $3,000 es para «a functional, runtime call to the Tavily API as part of its solution». No pide un SDK con un nombre distinto de esa API. Una key en el README sin la llamada no alcanza. Este repo ya llama `search` y `extract` desde el servidor (`src/lib/tavily.ts`, `src/lib/tavily-extract.ts`, `src/app/api/enriquecer/route.ts`).

**Elegibilidad.** Mayoría de edad en el país de residencia; Guatemala no está en la lista de exclusión (Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, y sanciones integrales de OFAC). El proyecto no puede haber recibido financiamiento o licencia comercial del sponsor o de Devpost. Materiales del envío en inglés, o con traducción del video, la descripción y las instrucciones. Varios envíos solo si son sustancialmente distintos.

**Proyecto previo.** Si existía antes del Submission Period, «must have been significantly updated» después del 26 ago 2026, 9:00am PDT, y el envío debe explicar por escrito qué cambió. Las rules no definen un diff mínimo. El git de esta máquina sí muestra que la cláusula aplica: el primer commit es `6409d7c`, 18 ago 2026 16:52 GT, autor Francisco Ocampo. El último commit anterior al periodo es `416c873`, 25 ago 2026 08:46 GT, mensaje `pre-evento`. A partir de `dc555e3` (27 ago, cliente Gemini) el historial es del periodo: Tavily y dashboard (30 ago), proveedor Nebius (25 sep, `ea1c55e`), sparring y Ultra (27 sep), bilingüe (28 sep), Tavily con extract y validación (1 oct), STT con marcas de tiempo y el rediseño Acta (2 oct). Eso es más que un rebrand. No se reescribió la historia.

**Criterios, igual peso, después de un stage 1 pass/fail** (fit real al track y a las APIs; un rebrand superficial no pasa): Technological Implementation, Design, Potential Impact, Quality of the Idea. Desempate en ese orden.

El catálogo público de Token Factory no se volvió a descargar en este pase. El extract de esta mañana (4 oct ~08:10 GT) listaba solo Nemotron 3 Nano 30B, Super 120B, Ultra 550B y Nemotron 3.5 Lightning, y no veía GR00T, Cosmos ni Sonic. El código no usa Lightning.

## 3. Qué hace el código hoy

Stack real de este árbol, no una suposición para ideas nuevas: **Next.js 16.3.1** (App Router), **React 19.2.8**, **TypeScript**, **Tailwind CSS 4**, **Vitest 3**. Sin base de datos. Sin Nest. `package.json` no declara cliente de Nebius, de Tavily ni de ElevenLabs: las llamadas son `fetch` propio.

La inferencia **no** corre en una GPU de Nebius ni en un Endpoint. Corre en el proceso Node del servidor Next (local con `npm run dev`, o el contenedor de Railway). `Dockerfile` es solo de producción (Node 24 Alpine, output standalone) y `railway.toml` apunta ese Dockerfile con healthcheck `/`. El navegador no ve la API key.

| Qué | Dónde | A quién llama |
|---|---|---|
| Análisis estándar | `src/app/api/analizar-pitch/route.ts` → `src/lib/analisis-modelo.ts` → `src/lib/modelo.ts` → `src/lib/proveedor-nebius.ts` | Token Factory, default `nvidia/nemotron-3-super-120b-a12b`, `enable_thinking: false`, timeout 20 s |
| Análisis Ultra | mismo ruta, `nivel=ultra` | default `nvidia/Nemotron-3-Ultra-550b-a55b`, sin apagar thinking, timeout 90 s, traza de 4–8 pasos |
| Sparring, entidades, query y validación de cifra | `src/app/api/sparring/*/route.ts`, `src/lib/entidades-tavily.ts`, `src/lib/query-tavily.ts`, `src/lib/validar-sugerencia.ts` | nivel `rapido`, default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` |
| STT | `src/app/api/transcribir/route.ts`, `src/lib/elevenlabs.ts` | ElevenLabs Scribe, default `scribe_v2` |
| TTS | `src/app/api/tts/route.ts` | ElevenLabs; el cliente cae a SpeechSynthesis |
| Cifras | `src/app/api/enriquecer/route.ts`, `src/lib/tavily.ts` | `https://api.tavily.com` search y extract, más Nano |
| Contingencia | `src/lib/proveedor-gemini.ts` | Gemini solo si `MODEL_PROVIDER=gemini` |

`src/lib/proveedor-nebius.ts` fija la base `https://api.tokenfactory.nebius.com/v1` si `NEBIUS_BASE_URL` viene vacía, pide `response_format.json_schema` con `strict: true`, y reintenta una vez si `finish_reason` es `length`. El score y los nombres de los puntos no los inventa el modelo: la rúbrica vive en `src/lib/rubricas.ts` (4 tipos × 5) y el servidor recalcula muletillas en `src/lib/muletillas.ts`.

Tavily está acotado a propósito. `MAX_PUNTOS_ENRIQUECIDOS = 2` en `src/lib/tavily.ts`. La transcripción no se manda a Tavily; solo entidades cortas y el nombre del punto. Sin `TAVILY_API_KEY` la ruta responde 200 con `sugerencias: []`. Rate limit en memoria: 5 peticiones / 10 min en `/api/enriquecer`, 10 / 10 min en el resto (`src/lib/rate-limit.ts`). No hay cola ni trabajo que sobreviva al request.

No hay Serverless Endpoint, Job, DevPod ni Sandbox en el árbol. No hay llamada a `api.nebius.cloud`. El historial (`src/lib/historial-sesiones.ts`) guarda como máximo 20 prácticas en `localStorage` y no guarda transcripción, veredicto ni audio.

El loop de producto está cerrado en `docs/status.md` (snapshot 2 oct 2026) y en la UI: `src/app/page.tsx`, `src/components/GrabadorVoz.tsx`, `src/components/DashboardResultado.tsx`, `src/components/SparringCoach.tsx`, `src/components/PanelProgreso.tsx`. Tests de API con fetch mockeado; el micrófono no tiene test de UI.

## 4. Fortalezas

- Cumple el mínimo de Token Factory con tres tamaños de Nemotron en el mismo producto, que es justo el reparto que el track Best Apps describe (Super en cada grabación, Ultra solo si se pide, Nano en lo barato). El esquema restringido y el score server-side hacen la implementación menos frágil que un prompt único.
- Es un producto usable, no un notebook: selectores, grabación con corte, texto de respaldo, dashboard, voz a pedido, bilingüe, historial local y demo que carga.
- Tavily no muestra el primer hit. Extract más un validador Nano que exige cifra, cita y relevancia, y si no hay dato no hay sugerencia. Eso es uso real del API, no un badge.
- La privacidad está pensada: claves solo server-side, transcripción fuera de Tavily, Sentry con scrub (`src/lib/sentry-scrub.ts`), historial sin el texto del pitch.
- La actualización dentro del periodo es demostrable con fechas de git.

## 5. Debilidades

Frente a los cuatro criterios, no frente a una lista de features.

**Implementación.** La llamada a Token Factory es correcta y testeada con mocks (`test/proveedor-nebius.test.ts`), pero todo el «agente» cabe en el timeout del request: 20 s estándar, 90 s Ultra. No hay workflow que siga cuando el usuario cierra la pestaña. AI Cloud no aparece. Un juez que busque Jobs o Endpoints no los encuentra; la rule no los exige, el brief del track sí los señala como el paso siguiente.

**Producto vs demo.** La experiencia de una práctica está cerrada. Lo que no está es la segunda vuelta: hoy «Resolver hallazgos» hace hasta tres preguntas (`SparringCoach.tsx`) y Tavily cubre dos puntos. No sale un guion reescrito contra la duración elegida ni un acta que se pueda leer sin volver a grabar. El coach visual sigue siendo texto; `docs/status.md` lo marca como temporal. Eso no tumba el stage 1, pero el criterio Design compara con un producto completo.

**Impacto.** La audiencia está dicha (quien practica un pitch de capital, educación, innovación o tecnología, LATAM, sin cuenta). El demo muestra feedback de una toma. No muestra que alguien llegue a una reunión con el hueco cerrado. En un overview que en este fetch marcó 17,291 participantes —el extract de la misma mañana ya avisó que ese contador no es estable entre fetches— un coach de voz más es fácil de archivar si el juez no ve la cifra citada y el id del modelo.

**No obviedad.** Rúbrica fija más STT más LLM es un género lleno. Lo menos obvio que ya existe es el contrato (el modelo no pone el score, Tavily no recibe el monólogo, la cifra se tira si es de otro sector). Eso está en el código y casi no se ve en la superficie. El id del modelo no vuelve al cliente; vive en logs del servidor.

**Configuración de producción.** Las claves del deploy de Railway no están comprobadas: si producción estuviera en `MODEL_PROVIDER=gemini`, el runtime de Nebius no se estaría ejerciendo aunque el default del código sea Nebius. La home cargó; no se corrió un análisis.

## 6. Mejoras priorizadas (~26 días)

No se propone otro producto ni otro stack. El árbol sigue en Next. Lo nuevo es un trabajo que el request actual no puede terminar.

### 1. Job «acta de comité» en Nebius Serverless AI

Un **Job**, no un Endpoint.

Un Endpoint sirve una URL mientras está encendido y, según [la overview de Serverless AI](https://docs.nebius.com/serverless/overview), el disco del contenedor se borra al pararlo. Railway ya sirve la app. Rehospedarla no cambia lo que el usuario recibe y sí añade una VM encendida. Hospedar otro Nemotron en una GPU propia duplica lo que Token Factory ya sirve (`proveedor-nebius.ts`) y no está en el presupuesto de estos días.

Un Job corre hasta terminar y entonces suelta la VM. Encaja con un acta que no cabe en 20–90 s ni en `MAX_PUNTOS_ENRIQUECIDOS = 2`. La consola de jobs deja elegir VM **sin GPU** («VMs without GPUs only support the regular type», en [Managing jobs](https://docs.nebius.com/serverless/jobs/manage)). El worker es un cliente HTTP en Python. No hace falta la imagen CUDA del ejemplo de esa página (`gpu-l40s-a`, `1gpu-8vcpu-32gb`); copiar ese ejemplo sería pagar una GPU para hacer `fetch`.

Qué haría que la app de hoy no hace:

1. El dashboard manda la sesión ya analizada (transcripción, tipo, idioma, duración, ids de puntos no cumplidos). Tope 64 KiB: es el límite de un injected file.
2. `POST https://api.nebius.cloud/ai/v1/jobs` crea el job. El token de AI Cloud no es `NEBIUS_API_KEY` de Token Factory. Timeout `3600s`, el mínimo que documenta esa página (el máximo es 168 h; el default es 24 h). El worker tiene que salir solo: si se cuelga, la VM puede vivir hasta esa hora.
3. Dentro del contenedor, una llamada Super redacta un acta JSON: una objeción por punto no cumplido (hasta cinco, no dos) y un guion hablado que quepa en la duración elegida. Cada objeción que necesite un dato pasa por Tavily search + extract. Nano acepta o rechaza la cifra. Ultra no entra en este job: ya existe el botón de Ultra y su timeout de 90 s. Meter Ultra aquí quema crédito y alarga el video.
4. La transcripción va a Token Factory, igual que hoy. A Tavily solo van entidades cortas y el nombre del punto, la misma regla de `src/lib/tavily.ts`. El acta se escribe en un volumen montado (`spec.volumes` o `s3://…` en la CLI). El disco del job se borra al terminar; sin volumen no hay acta.
5. La UI no bloquea la práctica. Muestra el id del job. La página de manage documenta logs en consola y CLI (`nebius ai job logs`), no un GET de logs en el fragmento REST leído. No inventar un poller de logs. La lectura del acta es el objeto en el bucket.

El Job es el argumento de implementación y de producto, no el ticket de entrada: si el proyecto AI Cloud, la cuota o el registry no están listos, la regla dura ya se cumple con Token Factory. Debe existir antes del último día; el cierre sigue siendo el viernes 30 oct 2026 a las 11:00 GT, no el momento de crear el proyecto.

### 2. Cerrar la segunda vuelta del coach sin bloquear la práctica

El producto debe conservar la primera práctica rápida y añadir el paso que hoy falta: convertir los puntos no cumplidos en objeciones y en un guion que quepa en la duración elegida. El Job anterior es el lugar para el acta larga; la UI muestra su `jobId` y no sustituye el análisis en vivo. Mantener el límite de Tavily y la separación de la transcripción descritos en `src/lib/tavily.ts`.

**Dejar fuera de estos 26 días:** cuentas, sync entre dispositivos, STT en vivo, animación del coach, rúbricas editables, mudanza de Railway a un Endpoint, Sandboxes de Token Factory (van al track de Coding y siguen en beta), NemoClaw / OpenShell / Hermes, y servir Nemotron en una GPU propia. Tampoco reimplementar dentro del worker todo `tavily.ts`: el worker valida con un esquema corto; la calidad fina de entidades sigue viviendo en el servidor Next, que es quien arma el JSON inyectado.

## 7. Diff propuesto, no aplicado

Propuesta de revisión. **No está aplicada** en `/home/focampo/Proyectos/pitch-coach`. No sustituye archivos existentes; suma cuatro archivos. Los platform y preset salen de variables: no se copia el ejemplo con GPU de la doc.

```diff
diff --git a/jobs/comite/Dockerfile b/jobs/comite/Dockerfile
new file mode 100644
--- /dev/null
+++ b/jobs/comite/Dockerfile
@@ -0,0 +1,8 @@
+# Imagen del Job. Cliente HTTP, sin CUDA.
+# El preset de la VM se elige al crear el job, no aquí.
+FROM python:3.12-slim
+WORKDIR /app
+COPY worker.py .
+# /output es el volumen que se monta al crear el job.
+# Sin ese volumen el disco del job se borra al salir.
+CMD ["python", "worker.py"]
diff --git a/jobs/comite/worker.py b/jobs/comite/worker.py
new file mode 100644
--- /dev/null
+++ b/jobs/comite/worker.py
@@ -0,0 +1,112 @@
+"""Acta de comité. Una corrida y sale.
+
+Lee /mnt/files/sesion.json (injected file, tope 64 KiB en la doc de jobs).
+Llama a Token Factory. A Tavily no le manda la transcripción.
+Escribe /output/acta.json y termina. Si falta una clave, sale con código 1
+para no dejar la VM colgada hasta el timeout mínimo de 1 h.
+"""
+import json, os, sys, urllib.request
+from pathlib import Path
+
+ENTRADA = Path(os.environ.get("COMITE_ENTRADA", "/mnt/files/sesion.json"))
+SALIDA = Path(os.environ.get("COMITE_SALIDA", "/output/acta.json"))
+BASE = os.environ.get("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1").rstrip("/")
+SUPER = os.environ.get("NEBIUS_MODEL_SUPER", "nvidia/nemotron-3-super-120b-a12b")
+NANO = os.environ.get("NEBIUS_MODEL_NANO", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B")
+
+def post(url, payload, headers):
+    req = urllib.request.Request(
+        url, data=json.dumps(payload).encode(), headers=headers, method="POST"
+    )
+    with urllib.request.urlopen(req, timeout=60) as res:
+        return json.load(res)
+
+def chat(modelo, system, user):
+    clave = os.environ["NEBIUS_API_KEY"]
+    cuerpo = post(
+        f"{BASE}/chat/completions",
+        {
+            "model": modelo,
+            "messages": [
+                {"role": "system", "content": system},
+                {"role": "user", "content": user},
+            ],
+            "temperature": 0.2,
+            "max_tokens": 1500,
+            "chat_template_kwargs": {"enable_thinking": False},
+            "response_format": {
+                "type": "json_schema",
+                "json_schema": {
+                    "name": "acta_comite",
+                    "strict": True,
+                    "schema": {
+                        "type": "object",
+                        "additionalProperties": False,
+                        "required": ["objeciones", "guion"],
+                        "properties": {
+                            "objeciones": {
+                                "type": "array",
+                                "items": {
+                                    "type": "object",
+                                    "additionalProperties": False,
+                                    "required": ["punto", "pregunta", "query"],
+                                    "properties": {
+                                        "punto": {"type": "string"},
+                                        "pregunta": {"type": "string"},
+                                        "query": {"type": "string"},
+                                    },
+                                },
+                            },
+                            "guion": {"type": "string"},
+                        },
+                    },
+                },
+            },
+        },
+        {"Authorization": f"Bearer {clave}", "Content-Type": "application/json"},
+    )
+    return json.loads(cuerpo["choices"][0]["message"]["content"])
+
+def cifra_o_nada(query, idioma):
+    """search + extract. Nano solo dice si hay una cifra citable.
+    La query la armó el servidor Next con entidades cortas, no este archivo.
+    """
+    tavily = os.environ.get("TAVILY_API_KEY")
+    if not tavily or not query:
+        return None
+    busqueda = post(
+        "https://api.tavily.com/search",
+        {"query": query, "max_results": 3, "topic": "general"},
+        {"Authorization": f"Bearer {tavily}", "Content-Type": "application/json"},
+    )
+    hits = busqueda.get("results") or []
+    if not hits:
+        return None
+    top = hits[0]
+    # El veredicto de relevancia lo da Nano, no el orden de Tavily.
+    veredicto = chat(
+        NANO,
+        "Acepta la fuente solo si contiene una cifra concreta y del mismo tema. Responde JSON.",
+        json.dumps({"query": query, "idioma": idioma, "titulo": top.get("title"), "url": top.get("url"), "recorte": (top.get("content") or "")[:1500]}, ensure_ascii=False),
+    )
+    # chat() de arriba exige el esquema del acta. En el archivo real este
+    # llamado usa otro json_schema (aceptada, cifra, cita). Se deja el hueco
+    # marcado para no fingir un segundo parser en el diff.
+    return {"url": top.get("url"), "titulo": top.get("title"), "nota": "validar con esquema propio de Nano"}
+
+def main():
+    sesion = json.loads(ENTRADA.read_text())
+    acta = chat(
+        SUPER,
+        "Eres un comité de tres lectores. Una objeción por punto no cumplido. El guion debe caber en la duración. La query de cada objeción usa solo las entidades dadas, nunca una frase del pitch.",
+        json.dumps(sesion, ensure_ascii=False),
+    )
+    for objecion in acta["objeciones"]:
+        objecion["fuente"] = cifra_o_nada(objecion.get("query", ""), sesion.get("idioma", "es"))
+    SALIDA.parent.mkdir(parents=True, exist_ok=True)
+    SALIDA.write_text(json.dumps(acta, ensure_ascii=False, indent=2))
+
+if __name__ == "__main__":
+    try:
+        main()
+    except Exception as exc:
+        print(f"comite: {exc}", file=sys.stderr)
+        sys.exit(1)
diff --git a/src/lib/comite-job.ts b/src/lib/comite-job.ts
new file mode 100644
--- /dev/null
+++ b/src/lib/comite-job.ts
@@ -0,0 +1,78 @@
+// Crea un Serverless Job. No llama a Token Factory: eso lo hace el contenedor.
+// API: POST https://api.nebius.cloud/ai/v1/jobs
+// (docs.nebius.com/serverless/jobs/manage, leído el 4 oct 2026).
+
+const TOPE_BYTES = 64 * 1024; // injected file, límite documentado
+
+export interface SesionComite {
+  idioma: "es" | "en";
+  tipoPitch: string;
+  duracionMaximaMin: number;
+  transcripcion: string;
+  /** Ids de rúbrica, no el texto libre del cliente. */
+  puntosSinCumplir: string[];
+  /** Entidades ya extraídas en Next. El worker no rehace ese paso. */
+  entidades: string[];
+}
+
+export function payloadCabe(sesion: SesionComite): boolean {
+  return Buffer.byteLength(JSON.stringify(sesion), "utf8") <= TOPE_BYTES;
+}
+
+export async function crearJobComite(sesion: SesionComite): Promise<{ id: string }> {
+  const token = process.env.NEBIUS_CLOUD_TOKEN;
+  const projectId = process.env.NEBIUS_PROJECT_ID;
+  const image = process.env.NEBIUS_JOB_IMAGE;
+  const platform = process.env.NEBIUS_JOB_PLATFORM;
+  const preset = process.env.NEBIUS_JOB_PRESET;
+  const volume = process.env.NEBIUS_JOB_VOLUME;
+  if (!token || !projectId || !image || !platform || !preset || !volume) {
+    throw new Error("Falta configuración de AI Cloud. El análisis en Token Factory sigue disponible.");
+  }
+  if (!payloadCabe(sesion)) {
+    throw new Error("La sesión supera 64 KiB y no cabe en un injected file.");
+  }
+
+  const respuesta = await fetch("https://api.nebius.cloud/ai/v1/jobs", {
+    method: "POST",
+    headers: {
+      Authorization: `Bearer ${token}`,
+      "Content-Type": "application/json",
+    },
+    body: JSON.stringify({
+      metadata: { parentId: projectId, name: `pitch-acta-${Date.now()}` },
+      spec: {
+        image,
+        containerCommand: "python",
+        args: "worker.py",
+        timeout: "3600s",
+        platform,
+        preset,
+        preemptible: false,
+        volumes: [{ source: volume, containerPath: "/output", mode: "READ_WRITE" }],
+        injectedFiles: [{
+          containerPath: "/mnt/files/sesion.json",
+          content: Buffer.from(JSON.stringify(sesion), "utf8").toString("base64"),
+        }],
+        // NEBIUS_API_KEY y TAVILY_API_KEY van por SecretStash
+        // (environmentVariables de secreto en la misma doc), no en este JSON.
+      },
+    }),
+  });
+
+  if (!respuesta.ok) {
+    throw new Error(`AI Cloud respondió ${respuesta.status}`);
+  }
+  const cuerpo = (await respuesta.json()) as { metadata?: { id?: string } };
+  const id = cuerpo.metadata?.id;
+  if (!id) throw new Error("AI Cloud no devolvió metadata.id");
+  return { id };
+}
diff --git a/src/app/api/comite/route.ts b/src/app/api/comite/route.ts
new file mode 100644
--- /dev/null
+++ b/src/app/api/comite/route.ts
@@ -0,0 +1,55 @@
+import { NextResponse } from "next/server";
+import { crearJobComite, payloadCabe, type SesionComite } from "@/lib/comite-job";
+import { limitar } from "@/lib/rate-limit";
+import { extraerEntidades } from "@/lib/entidades-tavily";
+import { excedeLimiteTranscripcion } from "@/lib/limites";
+
+export const runtime = "nodejs";
+
+/**
+ * POST /api/comite
+ * No analiza el pitch. El análisis sigue en /api/analizar-pitch.
+ * Si AI Cloud no está configurado, responde 501 y el dashboard no se rompe.
+ */
+export async function POST(request: Request): Promise<NextResponse> {
+  const bloqueo = limitar(request, "comite");
+  if (bloqueo) return bloqueo as NextResponse;
+
+  let body: Partial<SesionComite>;
+  try {
+    body = (await request.json()) as Partial<SesionComite>;
+  } catch {
+    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
+  }
+
+  if (!body.transcripcion || excedeLimiteTranscripcion(body.transcripcion)) {
+    return NextResponse.json({ error: "Transcripción ausente o demasiado larga" }, { status: 413 });
+  }
+  if (body.idioma !== "es" && body.idioma !== "en") {
+    return NextResponse.json({ error: "Idioma inválido" }, { status: 400 });
+  }
+
+  const sesion: SesionComite = {
+    idioma: body.idioma,
+    tipoPitch: body.tipoPitch ?? "",
+    duracionMaximaMin: body.duracionMaximaMin ?? 3,
+    transcripcion: body.transcripcion,
+    puntosSinCumplir: (body.puntosSinCumplir ?? []).slice(0, 5),
+    entidades: body.entidades?.length
+      ? body.entidades
+      : await extraerEntidades(body.transcripcion, body.idioma),
+  };
+
+  if (!payloadCabe(sesion)) {
+    return NextResponse.json({ error: "La sesión no cabe en el job" }, { status: 413 });
+  }
+
+  try {
+    const { id } = await crearJobComite(sesion);
+    return NextResponse.json({ jobId: id });
+  } catch (error) {
+    const mensaje = error instanceof Error ? error.message : "No se pudo crear el job";
+    const sinNube = mensaje.startsWith("Falta configuración");
+    return NextResponse.json({ error: mensaje }, { status: sinNube ? 501 : 502 });
+  }
+}
```

El hunk de `cifra_o_nada` está incompleto a propósito: reutiliza `chat()` con el esquema del acta, y eso no sirve para un sí/no. En la implementación de verdad esa función lleva su propio `json_schema` (`aceptada`, `cifra`, `cita`) y no llama a Super. El botón del dashboard no está en este diff: es un `POST` a `/api/comite` desde `DashboardResultado.tsx` que muestra `jobId` o el 501, sin sustituir el análisis en vivo.

`extraerEntidades` hoy es interna al flujo de Tavily; si su firma no acepta `(transcripcion, idioma)` tal cual, el route usa el helper que ya exista en `src/lib/entidades-tavily.ts` en lugar de inventar otro. `limitar()` necesita un ámbito `"comite"` en `LIMITES_POR_AMBITO` (el de enriquecer, 5/10 min, es el techo correcto). Esas dos líneas no están expandidas aquí.

## 8. Riesgos

- **El job no es el pase de las rules.** Si AI Cloud (proyecto, registry, cuota, rol `editor`) no está listo, el envío sigue siendo válido con Token Factory. Presentar un Endpoint vacío o un job GPU que solo hace `curl` se ve como checklist.
- **Timeout mínimo de 1 h y borrado del disco.** Un worker que no sale puede facturar hasta el timeout. Sin volumen, el acta desaparece con la VM. No se verificó en una cuenta el preset sin GPU ni el precio; la doc solo afirma que la VM sin GPU existe y que se factura como Compute, por segundo, mientras corre.
- **Claves y tokens distintos.** El Job necesita el token de AI Cloud; no es `NEBIUS_API_KEY` de Token Factory. También hay que inyectar `TAVILY_API_KEY` sin poner secretos en el JSON. La configuración de producción de Railway (`NEBIUS_API_KEY`, `TAVILY_API_KEY`, `MODEL_PROVIDER=nebius`) no fue comprobada.
- **Proyecto anterior al 26 ago.** El git lo muestra (primer commit 18 ago 2026 16:52 GT; baseline `pre-evento` el 25 ago). El trabajo posterior (Nebius el 25 sep, Tavily endurecido el 1 oct, UI el 2 oct) es el argumento; un juez puede igualmente decir que el género ya estaba el 25 ago. No se tocó el historial.
- **Un solo bono.** Si la candidatura también compite en Feedback, las rules como están no dejan llevar además los $3,000 de Tavily. El hilo 45215 no tenía respuesta en este fetch.
- **Créditos.** No se volvió a abrir la página de términos del Builder Program en este pase. El premio Tavily de $3,000 sí está en las rules. No se afirma aquí un saldo de créditos.

### Hechos que este pase no pudo cerrar

- Si el contenedor de Railway tiene `NEBIUS_API_KEY`, `TAVILY_API_KEY` y `MODEL_PROVIDER=nebius`. La home cargó; no se corrió un análisis.
- Respuesta oficial al hilo 45215.
- Monto en dólares de los créditos Tavily del Builder Program.
- Id de platform y nombre de preset de una VM sin GPU. La doc dice que se puede elegir «sin GPU» y el único preset de ejemplo es `1gpu-8vcpu-32gb`.
- Catálogo Token Factory re-descargado hoy. Se cita el extract de esta mañana para Lightning / ausencia de GR00T, Cosmos y Sonic.
- Si Francisco ya pulsó Join Hackathon. No se abrió sesión.

## 9. Checklist de entregables

Esto se hace al final, cuando el producto ya no se va a tocar. Cierre: viernes 30 oct 2026, 11:00 GT.

- [ ] Dejar `https://github.com/focampok/pitch-coach` público y la licencia MIT visible en el About.
- [ ] Publicar un video público de YouTube de hasta 3 minutos. Tiene que verse una grabación, el dashboard con el id del modelo de Token Factory, y una cifra de Tavily con su URL o el descarte explícito.
- [ ] Completar el formulario de Devpost en inglés: descripción, instrucciones y feedback escrito sobre Token Factory, AI Cloud y NVIDIA.
- [ ] Pegar en el formulario el párrafo de proyecto previo de `docs/formulario-devpost.md` §6 (qué cambió después del 26 ago 2026).
- [ ] Poner la demo `https://pitch-coach-production-1c0c.up.railway.app/` en el envío.
- [ ] Revisar que el README de setup baste para correr la demo sin preguntar.
- [ ] Comprobar que el video, el repo y la demo sigan accesibles el 30 oct a las 11:00 GT.
