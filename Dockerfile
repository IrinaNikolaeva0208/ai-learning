# syntax=docker/dockerfile:1

# ---- base ------------------------------------------------------------------
# openssl is required by Prisma's query engine.
FROM node:22-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# ---- development -----------------------------------------------------------
# Full dependency tree, used by docker-compose.override.yml for watch mode.
FROM base AS development

ENV NODE_ENV=development
# No .git in the image, so skip husky's hook install during `npm ci`.
ENV HUSKY=0

# The schema is copied before install: the postinstall hook runs
# `prisma generate`, which needs it.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json .env.test ./
COPY src ./src
COPY test ./test

# Run as the image's unprivileged user (uid 1000), so files written through a
# bind mount — the SQLite file in data/ — are owned by the host user, not root.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["npm", "run", "start:dev"]

# ---- build -----------------------------------------------------------------
FROM development AS build

RUN npm run build \
  && npm prune --omit=dev

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
# SQLite file lives on a volume; relative file: URLs resolve from prisma/.
ENV DATABASE_URL=file:../data/app.db

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000

# Apply pending migrations before serving, so a fresh volume gets a schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
