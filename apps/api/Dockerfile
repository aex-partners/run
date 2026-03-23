FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@aex/api --workspace=@aex/shared --include-workspace-root
# Ensure workspace node_modules dirs exist for COPY (npm hoists deps, so these may be empty)
RUN mkdir -p /app/apps/api/node_modules /app/packages/shared/node_modules

# Build
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build -w @aex/shared 2>/dev/null; true

# Runtime
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY package.json ./

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
