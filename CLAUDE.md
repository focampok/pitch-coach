# Pitch Coach — Guía de trabajo para agentes

> Este archivo aplica tanto para **Claude Code** como para **Roo Code**. Ambos agentes deben seguir estas reglas al trabajar dentro de este codebase.

## Entorno de desarrollo

- **Todo el desarrollo se realiza en Linux Mint nativo.** No se usa Docker ni contenedores de ningún tipo durante el desarrollo local.
- **No generar `docker-compose.yml` ni instrucciones que asuman contenedores** para correr el proyecto en local (ej. "levanta el contenedor", "entra al container"). Los comandos deben asumir ejecución directa en el sistema (`npm run dev`, `npm install`, etc.).
- El único uso de Docker en todo el proyecto es un **`Dockerfile` exclusivo para producción en Railway**. Este Dockerfile:
  - No se usa ni se ejecuta en local.
  - Su único propósito es que Railway pueda construir y desplegar la aplicación.
  - No debe asumirse como parte del flujo de desarrollo diario ni como herramienta de debugging.
- Cualquier instrucción de instalación, testing o ejecución que el agente proponga debe funcionar directamente sobre el sistema operativo (Linux Mint), sin pasos intermedios de contenedores.

## Configuración de Next.js — agentRules: false

`next.config.ts` incluye `agentRules: false`. Esto es intencional, no un valor por defecto.

**Qué hace**: Next.js 16 incluye una función que, al correr `npm run dev`, genera o modifica automáticamente un archivo de reglas para agentes de IA en la raíz del proyecto — por defecto intenta usar `CLAUDE.md` para esto, inyectándole un bloque de contenido genérico de Next.js.

**Por qué está desactivado**: al crear el proyecto, esta función reemplazó `CLAUDE.md` por un puntero de una línea a un `AGENTS.md` generado automáticamente, y en arranques posteriores seguía modificando el archivo agregándole contenido no solicitado. Dado que `CLAUDE.md` es la fuente de verdad de las reglas de trabajo del proyecto (leída también por Roo Code vía symlink en `.roo/rules/`), esto representaba riesgo de diluir o sobrescribir las reglas del proyecto sin aviso en cada arranque del servidor.

**Regla para agentes**: no reactivar `agentRules` ni eliminar esta configuración sin que se solicite explícitamente. Si en el futuro se necesita que Next.js gestione un archivo de reglas de agentes, debe hacerse apuntando a un archivo distinto de `CLAUDE.md` (por ejemplo, dejando que gestione su propio `AGENTS.md` de forma independiente), nunca sobre `CLAUDE.md` directamente.

## Variables de entorno

- Todas las credenciales y claves (API key de Gemini, y cualquier otra futura) se manejan **exclusivamente** mediante variables de entorno. Nunca se hardcodean en el código, ni siquiera "temporalmente para probar".
- Archivo `.env.local` en la raíz del proyecto para desarrollo local — **nunca se comitea a git**. Debe estar en `.gitignore` desde el primer commit.
- Archivo `.env.example` sí se comitea, con las mismas keys pero sin valores reales (o con placeholders), para que quede documentado qué variables necesita el proyecto.
- Variables esperadas (ir actualizando esta lista conforme se agreguen):
  - `GEMINI_API_KEY` — clave de la API de Gemini, usada únicamente en API routes (server-side), nunca expuesta al cliente.
- En Railway, las variables de entorno se configuran directamente en el panel del proyecto (Settings → Variables), replicando las mismas keys que en `.env.local`.
- Cualquier variable que empiece con `NEXT_PUBLIC_` queda expuesta al navegador — **nunca usar ese prefijo para API keys o secretos.**

## Estructura de carpetas (scaffolding)

Proyecto Next.js (App Router) con todo en un solo repositorio, sin backend separado:

```
pitch-coach/
├── CLAUDE.md
├── README.md
├── .roo/
│   └── rules/
│       └── CLAUDE.md -> symlink a ../../CLAUDE.md
├── docs/
│   └── alcance.md
├── .env.local              # no se commitea
├── .env.example
├── Dockerfile              # solo para build/deploy en Railway, no se usa en local
├── package.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── page.tsx                 # pantalla principal (selector de pitch + grabación + dashboard)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── analizar-pitch/
│   │           └── route.ts         # API route: recibe transcripción + tipo de pitch, llama a Gemini, responde JSON
│   ├── components/
│   │   ├── SelectorTipoPitch.tsx
│   │   ├── GrabadorVoz.tsx           # maneja Web Speech API (STT)
│   │   ├── ReproductorVeredicto.tsx  # maneja SpeechSynthesis (TTS)
│   │   ├── DashboardResultado.tsx    # transcripción, muletillas, rúbrica, score
│   │   └── ui/                       # componentes visuales reutilizables (botones, cards, etc.)
│   ├── lib/
│   │   ├── gemini.ts                 # cliente y llamada a Gemini API
│   │   ├── rubricas.ts               # las 4 rúbricas hardcodeadas (capital, educación, innovación, tecnología)
│   │   ├── muletillas.ts             # lógica de detección por regex/keyword matching
│   │   └── prompts.ts                # construcción del prompt que se envía a Gemini
│   └── types/
│       └── pitch.ts                  # tipos TypeScript: TipoPitch, ResultadoAnalisis, etc.
└── public/
```

### README.md

El proyecto debe tener un `README.md` en la raíz, con al menos:

- Nombre del proyecto y una línea que explique qué hace (ver `docs/alcance.md` sección 2, "Concepto").
- Track del hackathon (Learning by Shipping) y nombre del evento (The Next Craft).
- Stack técnico resumido (Next.js, Gemini API, Web Speech API, Railway).
- Instrucciones de setup local:
  - Clonar el repo.
  - `npm install`.
  - Copiar `.env.example` a `.env.local` y completar `GEMINI_API_KEY`.
  - `npm run dev` para levantar en local (sin Docker, ejecución nativa).
- Nota explícita de que el `Dockerfile` es solo para el deploy en Railway y no se usa en desarrollo local.
- Se actualiza conforme el proyecto avanza — no es un documento estático que se escribe una sola vez al inicio.

### .gitignore

Debe incluir, como mínimo:

```
# dependencias
node_modules/

# build de Next.js
.next/
out/

# variables de entorno (nunca se comitean)
.env
.env.local
.env*.local

# logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# sistema operativo / editor
.DS_Store
*.pem

# Railway (si genera archivos locales de config)
.railway/
```

`.env.example` es la única excepción de archivo de entorno que **sí** se comitea, ya que no contiene valores reales.

Notas sobre la estructura:
- La lógica de negocio (rúbricas, detección de muletillas, construcción de prompts) vive en `src/lib/`, separada de los componentes de UI — facilita que el agente edite una cosa sin tocar la otra.
- Un único API route (`/api/analizar-pitch`) concentra la llamada al LLM. No se crean múltiples endpoints salvo que el alcance crezca.
- El `Dockerfile` vive en la raíz solo porque Railway lo espera ahí — no implica que se use en desarrollo (ver regla de entorno de desarrollo arriba).

## Convención de idioma

- **Mercado objetivo: LATAM.** Todo lo que el usuario final ve debe estar en **español**:
  - Textos de UI (botones, labels, mensajes de error visibles, veredictos hablados y escritos).
  - Contenido de las rúbricas y el feedback generado por el LLM.
  - Prompts enviados a Gemini deben pedir explícitamente respuesta en español.
- **El código se escribe en inglés**, siguiendo convención estándar de la industria:
  - Nombres de variables, funciones, tipos, y archivos técnicos genéricos (ej. `route.ts`, `page.tsx`) en inglés.
  - Comentarios en el código pueden ir en español si aclaran contexto de negocio específico (ej. explicar una rúbrica), pero la lógica general se comenta en inglés cuando es puramente técnica.
- **Excepción intencional**: los nombres de archivo/componentes directamente ligados a conceptos de negocio en español (como se ve en el scaffolding arriba: `SelectorTipoPitch.tsx`, `rubricas.ts`) se mantienen en español porque reflejan directamente el dominio del producto y facilitan que el agente entienda el propósito sin ambigüedad. Si en algún punto se prefiere consistencia total en inglés para el código, esta sección debe actualizarse antes de que el agente empiece a generar archivos nuevos.
