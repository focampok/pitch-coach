# Documentación — Pitch Coach

Índice orientado por objetivo ([Diátaxis](https://diataxis.fr/)). Antes de la
fase de UX/UI, estos documentos son la fuente de verdad del producto y del
código.

## Empezar (tutorial)

1. [README](../README.md) — qué es el proyecto, setup local y deploy.
2. Copiar [`.env.example`](../.env.example) → `.env.local` y completar keys.
3. `npm run dev` y probar el loop con micrófono (o texto de respaldo).

## Guías (cómo resolver un problema)

| Guía | Cuándo usarla |
| --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Nuevo tipo de pitch, muletilla, idioma o PR |
| [guia-integracion-nebius.md](guia-integracion-nebius.md) | Capa de modelo, esquema JSON, smoke test Nebius |
| [guia-integracion-gemini.md](guia-integracion-gemini.md) | Contingencia `MODEL_PROVIDER=gemini` |
| [guia-integracion-elevenlabs.md](guia-integracion-elevenlabs.md) | Scribe (STT) y TTS |
| [guia-integracion-tavily.md](guia-integracion-tavily.md) | Pipeline de sugerencias en `/api/enriquecer` |

## Referencia (qué es qué)

| Documento | Contenido |
| --- | --- |
| [alcance.md](alcance.md) | Problema, loop de usuario, rúbricas, bilingüe, servicios, fuera de alcance |
| [status.md](status.md) | Tabla implementado ↔ archivos, variables de entorno, tests, Sentry (resumen) |
| [`.env.example`](../.env.example) | Lista completa de variables y defaults documentados |
| [CLAUDE.md](../CLAUDE.md) | Convenciones del repo para humanos y agentes |

### API routes (servidor)

| Ruta | Función |
| --- | --- |
| `POST /api/transcribir` | Audio → texto (Scribe) |
| `POST /api/analizar-pitch` | Transcripción → rúbrica, claridad, veredicto, score |
| `POST /api/tts` | Texto → audio (veredicto / preguntas) |
| `POST /api/enriquecer` | Tavily + validación + frase hablada |
| `POST /api/sparring/pregunta` | Pregunta de seguimiento (hallazgos) |
| `POST /api/sparring/evaluar` | Evalúa respuesta del usuario |

Todas aceptan `idioma` (`es` \| `en`); el 429 usa cabecera `X-Idioma` cuando el
cuerpo aún no se leyó. Detalle en [alcance.md §15](alcance.md).

## Explicación (por qué está así)

| Documento | Tema |
| --- | --- |
| [sentry.md](sentry.md) | Privacidad, filtrado de PII, source maps, decisiones de SDK |
| [pre-nebius.md](pre-nebius.md) | Baseline del repo **antes** del hardening y la migración a Nebius (tag `pre-nebius`) |
| [post-nebius.md](post-nebius.md) | Estado **después** del baseline; alineado con [status.md](status.md), contraparte de `pre-nebius.md` |

- **`pre-nebius.md`** — congelado en el tag `pre-nebius` (cómo era el proyecto).
- **`post-nebius.md`** — narrativa antes/después + arquitectura Nebius actualizada.
- **`status.md`** — tabla archivo ↔ código y notas de verificación (fuente viva).

## Próxima fase (UX/UI)

En [alcance.md §5.1](alcance.md) y [status.md](status.md): el coach es un
indicador de texto temporal; la animación y el lenguaje visual se definirán en
UX/UI. No hay STT en vivo (Scribe Realtime) en el alcance actual.
