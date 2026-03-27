# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AEX is an AI-first, self-hosted, single-tenant ERP. Users interact via chat, the AI creates database schemas dynamically, executes business operations as tasks, and runs automations via workflows/flows. No multi-tenant isolation needed.

## Commands

```bash
# Start everything (kills existing ports, runs API + Web concurrently)
npm run dev

# Start individually
npm run dev:api          # API on :3001 (tsx watch)
npm run dev:web          # Web on :5173 (Vite)

# Infrastructure
docker compose up -d     # Postgres (pgvector/pg17), Redis, SearXNG

# Database (from root or with -w @aex/api)
npm run db:push -w @aex/api       # Push schema to DB
npm run db:migrate -w @aex/api    # Run migrations
npm run db:generate -w @aex/api   # Generate migration files
npm run db:seed -w @aex/api       # Seed data
npm run db:reset -w @aex/api      # Reset DB
npm run dev-reset-db              # Reset DB + start dev

# Tests
npm test -w @aex/api              # API tests (vitest, sequential, forks pool)
npm test -w @aex/web              # Web tests (vitest, jsdom)
npx vitest run src/path/file.test.ts -w @aex/api   # Single test file

# Web extras
npm run lint -w @aex/web          # ESLint
npm run storybook                 # Storybook on :6006
npm run test:e2e -w @aex/web      # Playwright E2E
npm run check-translations -w @aex/web  # Verify i18n completeness
```

## Architecture

### Monorepo structure (npm workspaces)

- `apps/api` - Fastify backend with tRPC, BullMQ workers, WebSocket, Claude Agent SDK
- `apps/web` - React SPA (Vite, Tailwind v4, Radix UI, React Router, TanStack Query)
- `packages/shared` - Shared types, schemas, entity knowledge, constants
- `packages/plugin-framework` - Plugin system framework (piece-based, inspired by Activepieces)
- `packages/plugin-common` - Common plugin utilities (auth, HTTP, polling, validation)

### API (`apps/api/src/`)

**Entry point**: `index.ts` boots Fastify, registers all workers, loads triggers.

**Key layers**:
- `trpc/` - tRPC router with sub-routers per domain (entities, conversations, tasks, workflows, flows, agents, etc.)
- `ai/` - Chat handler using Claude Agent SDK with tool registry, MCP server factory, subagents, skill templates
- `db/schema/` - Drizzle ORM schemas: `auth.ts` (better-auth tables), `app.ts` (business entities), `relations.ts`
- `queue/` - BullMQ workers: task-worker (AI task execution), workflow-worker, flow-worker, email-worker, bling-worker
- `flow-engine/` - Visual flow execution engine: piece executor, code executor, loop executor, router executor, variable service
- `pieces/` - Integration plugins (e.g., piece-bling)
- `credentials/` - OAuth2 handler for plugin credentials
- `ws/` - WebSocket for real-time updates

**Auth**: better-auth with Fastify adapter, session cookies.

**DB**: PostgreSQL with pgvector extension, Drizzle ORM. Config in `drizzle.config.ts`.

### Web (`apps/web/src/`)

**Routing**: React Router v7 in `App.tsx`. Protected routes wrap `MainApp`, public routes for login/signup/setup/public forms.

**State**: Zustand for local state (`stores/`), TanStack Query + tRPC for server state.

**i18n**: i18next with `locales/en.ts` (English) and `locales/pt-BR.ts`. All component text in English, i18n-ready via string constants.

**Component structure** (Atomic Design in `components/`):
- `atoms/` - Primitives (Button, Badge, Avatar, Input)
- `molecules/` - Composed units (MessageBubble, TaskCard, ActionCard)
- `organisms/` - Complex sections (ConversationList, DataGrid, WorkflowCanvas)
- `screens/` - Full page content areas
- `layout/` - AppShell
- `ui/` - shadcn-style base components (button, badge, card, etc.)
- `ai/` - AI chat-specific components

**Pages**: Chat, Database, Tasks, Workflows, Flows, Files, Mail, Settings, Login/Signup/Setup.

### Infrastructure

- `docker-compose.yml`: Postgres (pgvector), Redis, SearXNG, Caddy reverse proxy, API, Web
- `Caddyfile`: Routes `/api/*` and `/ws` to API, everything else to Web
- `.env` at monorepo root (loaded by API via dotenv with relative path `../../.env`)

## Key Conventions

- TypeScript strict mode, ES2022 target, ESM (`"type": "module"`)
- API tests run sequentially (`fileParallelism: false`) with a global setup/teardown for DB
- Drizzle schema split: `auth.ts` for auth tables, `app.ts` for business tables
- tRPC routers map 1:1 with domains (one file per resource in `trpc/routers/`)
- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Lucide React for icons
