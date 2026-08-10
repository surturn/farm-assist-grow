FROM node:20-alpine AS base

WORKDIR /app

# Copy every workspace manifest first so npm can resolve the monorepo layout.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/firebase-admin/package.json ./packages/firebase-admin/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY infrastructure/queue/package.json ./infrastructure/queue/package.json
COPY infrastructure/redis/package.json ./infrastructure/redis/package.json

RUN npm ci

COPY apps ./apps
COPY packages ./packages
COPY infrastructure ./infrastructure

# ----- DEV STAGE -----
FROM base AS dev
WORKDIR /app/apps/backend

RUN ../../node_modules/.bin/prisma generate

ENV NODE_ENV=development

EXPOSE 5000

# Using tsx watch for hot module replacement in development
CMD ["sh", "-c", "../../node_modules/.bin/prisma db push --schema prisma/schema.prisma --accept-data-loss && exec ../../node_modules/.bin/tsx watch src/server.ts"]

# ----- PROD STAGE -----
FROM base AS prod
WORKDIR /app/apps/backend

RUN ../../node_modules/.bin/prisma generate

ENV NODE_ENV=production

EXPOSE 5000

CMD ["sh", "-c", "../../node_modules/.bin/prisma db push --schema prisma/schema.prisma --accept-data-loss && exec ../../node_modules/.bin/tsx src/server.ts"]
