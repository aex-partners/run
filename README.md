# AEX Run

AI-first, self-hosted, single-tenant ERP. Users interact entirely via chat. The AI creates database schemas dynamically, executes business operations as tasks, and runs automations via workflows and flows.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/aex-run?referralCode=h-m7f_&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Features

- **AI Chat** - Claude-powered assistant (Eric) that understands your business context, executes tasks, and manages data through natural conversation
- **Dynamic Database** - Create entities (tables) with 28+ field types on the fly. Kanban, calendar, and table views. Inline editing, relationships, formulas, AI-generated fields
- **Tasks** - AI-driven task execution with real-time progress, logs, cancel/retry
- **Workflows** - Visual workflow builder (ReactFlow) with cron and event triggers
- **Flows** - Step-by-step automation builder with pieces (integrations), code blocks, loops, and routers
- **Email** - Built-in email client with SMTP/IMAP, multi-account, AI drafts
- **Files** - File manager with upload, folders, sharing, public links, AI indexing for RAG
- **Plugins** - Extensible piece-based plugin system (inspired by Activepieces)
- **Forms** - Public forms linked to entities for data collection
- **Knowledge Base** - Company knowledge storage for AI context
- **Real-time** - WebSocket for live updates across all modules
- **i18n** - English and Portuguese (pt-BR)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS v4, Radix UI, React Router v7, TanStack Query |
| **Backend** | Node.js, Fastify, tRPC, Drizzle ORM, BullMQ |
| **AI** | Claude Agent SDK, MCP tools, SearXNG (web search) |
| **Database** | PostgreSQL 17 (pgvector), Redis |
| **Auth** | better-auth (session cookies, email/password) |
| **Infra** | Docker Compose, Caddy reverse proxy |

## Architecture

```
aex/
├── apps/
│   ├── api/          # Fastify backend (tRPC, AI, workers, flows)
│   └── web/          # React SPA (Vite)
├── packages/
│   ├── shared/       # Types, schemas, constants
│   ├── plugin-framework/  # Plugin system framework
│   └── plugin-common/     # Plugin utilities (auth, HTTP, polling)
├── docker-compose.yml
├── Caddyfile
└── .env
```

## Quick Start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/aex-partners/run.git
cd run
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `ANTHROPIC_API_KEY`. Generate a proper `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Start infrastructure

```bash
docker compose up -d postgres redis searxng
```

This starts PostgreSQL (pgvector), Redis, and SearXNG.

### 4. Run migrations and seed

```bash
npm run db:migrate -w @aex/api
npm run db:seed -w @aex/api
```

### 5. Start development

```bash
npm run dev
```

- **API**: http://localhost:3001
- **Web**: http://localhost:5173
- **Default login**: admin@aex.app / admin123

### Alternative: Docker Compose (production)

```bash
docker compose up -d
```

All services start behind Caddy on port 80. The API runs migrations automatically on boot.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key for Claude |
| `BETTER_AUTH_SECRET` | Yes | - | Auth session secret (min 32 chars) |
| `BETTER_AUTH_URL` | Yes | - | API public URL (e.g. `http://localhost:3001`) |
| `CORS_ORIGIN` | Yes | - | Web app URL (e.g. `http://localhost:5173`) |
| `PORT` | No | `3001` | API server port |
| `ENCRYPTION_KEY` | No | - | Key for encrypting plugin credentials |

See [`.env.example`](.env.example) for a ready-to-use template.

## Commands

```bash
# Development
npm run dev              # Start API + Web concurrently
npm run dev:api          # API only (port 3001)
npm run dev:web          # Web only (port 5173)

# Database
npm run db:migrate -w @aex/api    # Run migrations
npm run db:generate -w @aex/api   # Generate new migration
npm run db:seed -w @aex/api       # Seed sample data
npm run db:reset -w @aex/api      # Drop all tables + migrate

# Tests
npm test -w @aex/api              # API tests (vitest)
npm test -w @aex/web              # Web tests (vitest + jsdom)
npm run test:e2e -w @aex/web      # Playwright E2E

# Other
npm run storybook                 # Component storybook (port 6006)
npm run lint -w @aex/web          # ESLint
npm run check-translations -w @aex/web  # i18n completeness check
```

## Deploy on Railway

Click the button at the top or use:

```
https://railway.com/deploy/aex-run?referralCode=h-m7f_
```

The template provisions PostgreSQL, Redis, API, and Web services. Set `ANTHROPIC_API_KEY` in the API service variables after deploy. The API runs migrations automatically on boot.

## License

Proprietary. All rights reserved.
