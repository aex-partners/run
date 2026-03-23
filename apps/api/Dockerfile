FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/plugin-framework/package.json ./packages/plugin-framework/
COPY packages/plugin-common/package.json ./packages/plugin-common/
RUN npm ci

# Runtime
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY packages/plugin-framework ./packages/plugin-framework
COPY packages/plugin-common ./packages/plugin-common
COPY apps/api ./apps/api
COPY package.json ./

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
