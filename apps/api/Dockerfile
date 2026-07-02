FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies (cached layer)
FROM base AS deps
# node-sped-nfe -> pem shells out to the openssl CLI to read the A1 .pfx certificate.
RUN apk add --no-cache openssl
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

# Run as root: Railway mounts the /app/uploads volume root-owned, so a non-root
# user can't write uploads or the seed marker. The reference deploy also runs as
# root. Claude Agent SDK gets a pre-accepted TOS + empty settings under /root.
RUN mkdir -p /root/.claude /app/uploads \
  && echo "true" > /root/.claude/.tosAccepted \
  && echo "{}" > /root/.claude/settings.json

ENV FILE_STORAGE_PATH=/app/uploads
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
