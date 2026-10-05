# Guía para actualizar el README de Pitch Coach

Úsala cuando el Serverless Job del acta de comité ya funcione de punta a punta: se crea, termina, y el dashboard muestra el acta. No antes. Si el job no está, no lo nombres en el README.

No es una landing ni un pitch deck. El README sigue siendo la ficha de setup. Lo técnico (NVIDIA, Nebius, Tavily, el job) entra en dos sitios: una sección corta en este README y el detalle que ya vive en `docs/`. El video se graba después de este pase.

No toques el tono de producto de las primeras líneas. No añadas mercado, equipo, ni una segunda página.

## Qué editar, en este orden

### 1. Loop principal

En **Qué hace**, después del dashboard, una frase y nada más:

El servidor puede pedir un acta de comité. Un job en Nebius corre fuera del request, escribe una objeción por cada punto no cumplido y un guion que cabe en la duración elegida, y el dashboard lo muestra cuando el archivo ya está.

No digas que el job reemplaza el análisis. El análisis de la grabación sigue siendo Token Factory en el proceso de Next (Super por defecto, Ultra solo si se pide, Nano en lo barato).

### 2. Sección nueva: Cómo corre

Ponla después de **Stack** y antes de **Setup local**. Cuatro bloques, cada uno con el archivo real. Rellena los huecos con lo que quedó en el código, no con esta guía.

**Token Factory (NVIDIA, en cada práctica).** El servidor llama a `https://api.tokenfactory.nebius.com/v1/chat/completions` desde `src/lib/proveedor-nebius.ts`. Modelos por defecto:

- Análisis de la toma: `nvidia/nemotron-3-super-120b-a12b` (Super).
- Análisis Ultra, solo si el usuario lo pide: `nvidia/Nemotron-3-Ultra-550b-a55b`.
- Sparring, entidades y validación de cifra: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`.

El modelo no pone el score. La rúbrica está en `src/lib/rubricas.ts` y el servidor recalcula las muletillas. Detalle: `docs/guia-integracion-nebius.md`.

**Tavily (solo si falta un punto).** Search y extract desde el servidor. La transcripción no se envía. Como máximo dos puntos en el request de la práctica (`MAX_PUNTOS_ENRIQUECIDOS`). Si no hay cifra usable, no hay sugerencia. Detalle: `docs/guia-integracion-tavily.md`.

**Job del acta (Nebius Serverless AI, sin GPU).** No es un Endpoint y no rehospeda la app. Railway sigue sirviendo Next. El job es una VM que arranca, escribe el acta y sale. El token de AI Cloud no es `NEBIUS_API_KEY`.

Completa esta lista con los valores del job que sí corriste:

- Imagen y worker: ruta real (la propuesta era `jobs/comite/`).
- Crear el job: método y URL reales (la doc de jobs usa `POST https://api.nebius.cloud/ai/v1/jobs`).
- VM: platform y preset sin GPU, los que elegiste en consola. No copies un preset con GPU.
- Entrada: archivo inyectado con la sesión ya analizada. Tope documentado: 64 KiB.
- Salida: volumen o bucket donde queda `acta.json`. Sin eso el disco del job se borra al terminar.
- Timeout que configuraste. El mínimo documentado es 1 hora; el worker tiene que salir solo.
- Qué modelo usa el worker. La propuesta era Super para el acta y Nano para aceptar o rechazar la cifra. Ultra no entra en el job.
- Misma regla de Tavily: al job no le llega la transcripción, solo entidades cortas y el nombre del punto.

**Qué no hace falta para la regla del hackathon.** La app ya llama a Token Factory en runtime. El job es el acta, no el requisito de entrada. Gemini sigue siendo contingencia manual (`MODEL_PROVIDER=gemini`) y no es el camino de la demo.

### 3. Stack

Añade una línea, solo si el código ya está:

- **Nebius Serverless Job** — acta de comité, VM sin GPU, un proceso que termina.

No listes un Endpoint.

### 4. Setup local

En el paso de variables, separa las dos claves:

- `NEBIUS_API_KEY` — Token Factory. Sigue siendo la del análisis.
- La clave de AI Cloud del job — el nombre real de la variable en `.env.example`. No la llames igual que la de Token Factory si el código no lo hace.

El job no tiene que correr para `npm run dev`. Di cómo se dispara desde el dashboard y qué pasa si falta la clave (el análisis de la toma sigue; el acta no).

### 5. Limitaciones

Quita o reescribe la línea que diga que no hay trabajo fuera del request, si el job ya lo es. Deja las que sigan siendo ciertas: historial en `localStorage`, STT no en vivo, tests sin UI.

Añade solo limitaciones reales del job que hayas visto (por ejemplo: el acta no aparece si el volumen no montó, o el dashboard no hace polling de logs).

### 6. Documentación

Una fila nueva en la tabla:

| `docs/guia-integracion-job.md` | Acta de comité: imagen, variables, volumen, cómo leer el resultado |

Ese archivo se escribe en el mismo pase que el README. No dupliques el contenido en los dos sitios: el README resume, la guía tiene comandos y variables.

### 7. Capturas

Sustituye o suma una captura del dashboard donde se lea, sin abrir DevTools:

- el id del modelo de Token Factory de esa toma
- una cifra de Tavily con su URL, o el descarte
- el id del job y el acta (objeciones y guion)

Esas tres son las que el video va a enseñar. Si una no cabe en la UI, no la inventes en el README.

## Qué no poner

- Una landing, un mercado, un equipo o un "por qué ahora".
- Jobs, Endpoints o AI Cloud como si ya estuvieran, si el job de prueba no terminó.
- Un preset de GPU copiado de la documentación de Nebius.
- Claves, tokens o el contenido de `.env.local`.
- Otro hackathon, otro calendario, u otra pista.

## Cuando el README ya quedó

Recién ahí se prepara el video. Menos de 3 minutos, público en YouTube, y en este orden: una grabación corta, el dashboard con el id del modelo, la cifra de Tavily o su descarte, el id del job y el acta. El formulario de Devpost y el párrafo de proyecto previo (`docs/formulario-devpost.md`, sección 6) van después del video. El cierre del envío es el viernes 30 oct 2026, 11:00 GT.
