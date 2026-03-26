FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/plugin-framework/package.json ./packages/plugin-framework/
COPY packages/plugin-common/package.json ./packages/plugin-common/
RUN npm ci --ignore-scripts

# Copy source and build shared packages
FROM deps AS runtime
COPY packages/shared ./packages/shared
COPY packages/plugin-framework ./packages/plugin-framework
COPY packages/plugin-common ./packages/plugin-common
COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx drizzle-kit migrate && npx tsx src/index.ts"]
