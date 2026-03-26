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

# Install Claude Code CLI globally (required by Agent SDK)
RUN npm install -g @anthropic-ai/claude-code

# Copy source and build shared packages
FROM deps AS runtime
COPY packages/shared ./packages/shared
COPY packages/plugin-framework ./packages/plugin-framework
COPY packages/plugin-common ./packages/plugin-common
COPY apps/api ./apps/api

# Create non-root user (Claude Code blocks bypassPermissions with root)
RUN addgroup -S aex && adduser -S aex -G aex
RUN mkdir -p /home/aex/.claude && chown -R aex:aex /home/aex/.claude /app
RUN echo "true" > /home/aex/.claude/.tosAccepted && echo "{}" > /home/aex/.claude/settings.json && chown -R aex:aex /home/aex/.claude

USER aex
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
