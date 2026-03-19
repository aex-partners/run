FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@aex/web --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npx", "vite", "--host"]
