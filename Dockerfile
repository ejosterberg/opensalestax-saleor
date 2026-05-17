# SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

# Multi-stage build: build with full deps, ship slim production layer.
# Target image size <100 MB based on node:20-alpine.

FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and build.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Strip dev deps so the production image only ships what runs.
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------

FROM node:20-alpine AS runtime
WORKDIR /app

# Run as the unprivileged `node` user that the base image already
# provides (OWASP A05 â€” don't run as root in production).
ENV NODE_ENV=production

# Copy the production-only dependency tree + built artifacts.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node LICENSE ./LICENSE

USER node

# Health probe â€” read by docker-compose / orchestrators.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

EXPOSE 3000
CMD ["node", "dist/server.js"]
