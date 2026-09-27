# Dockerfile exclusivo para el build/deploy en Railway (ver CLAUDE.md).
# No se usa en desarrollo local — el flujo local es `npm run dev` nativo.

# ---- Dependencias ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:24-alpine AS builder
WORKDIR /app

# Sentry en build-time. Railway NO expone las variables del servicio a un build
# por Dockerfile: hay que declararlas con ARG (y el ARG solo vale dentro de la
# etapa donde se declara, por eso van acá y no antes del primer FROM).
#
# Sin esto, `npm run build` no ve el token y el plugin avisa
# "No auth token provided. Will not upload source maps" — el deploy sale igual,
# pero los stack traces de producción quedan minificados.
#
# SENTRY_RELEASE se pasa explícito porque .dockerignore excluye .git, así que la
# detección automática de release (que lee el SHA de git) no encuentra nada.
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- Runtime ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usuario sin privilegios (práctica estándar del Dockerfile oficial de Next.js).
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# El build standalone (next.config.ts → output: "standalone") incluye el
# servidor y solo las dependencias necesarias; static y public van aparte.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Railway asigna el puerto vía $PORT; el server standalone lo respeta.
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
