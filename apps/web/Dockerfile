FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/plugin-common/package.json ./packages/plugin-common/
COPY packages/plugin-framework/package.json ./packages/plugin-framework/
RUN npm ci --ignore-scripts

# Copy source and build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN npx vite build

# Serve with Caddy
FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
