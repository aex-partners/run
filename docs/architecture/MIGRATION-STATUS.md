# Migration Status — AEX Run → hexagonal (run-hex)

Full migration of `/Dev/run` (AEX Run) into Ports & Adapters + DDD bounded
contexts. Scope chosen: **everything (backend + frontend + infra), 1:1 fidelity**.

## Verified green

- **Backend**: `tsc --noEmit` = 0 errors; `depcruise` = 0 violations (1085 modules,
  3851 deps); offline in-memory demo runs; `tsx src/main/server.ts` boots against
  real Postgres+Redis (schema pushed: 43 tables, better-auth up, Fastify listening,
  10 BullMQ workers connected, `/health` 200).
- **Frontend**: `vite build` succeeds (3132 modules → dist). Consumes the backend
  `AppRouter` via a type-only import (erased at build).

## Shape

```
run-hex/ (npm workspaces)
├── apps/api/src/
│   ├── contexts/   20 bounded contexts, each {domain, application/{ports,use-cases,queries,mappers}, adapters/{in,out}}
│   ├── platform/   db (drizzle+pgvector schema, 37 tables), http (fastify+trpc), queue (bullmq), auth (better-auth), events (ws), config
│   ├── shared/     kernel (Result, Identifier, AggregateRoot, Decider, EventPublisher, Clock), domain (Json)
│   └── main/       container.ts (real wiring + ACL bridges), routes.ts (AppRouter), mcp.ts, workers.ts, server.ts, demo/
├── apps/web/       React SPA (256 components, 20 pages) — driving adapter over the tRPC in-ports
├── packages/       shared, plugin-framework, plugin-common
└── docker-compose.yml, Caddyfile, .env.example, drizzle.config.ts
```

## 20 contexts (all wired into AppRouter)

data, automation, assistant, plugins, conversations, tasks, email, credentials,
integrations, identity, files, forms, reminders, notifications, knowledge,
settings, audit, geocode, agents, skills.

Dependency rule enforced in CI by dependency-cruiser: `adapters → application →
domain`; domain+application import zero npm/platform; contexts never import each
other (cross-context only via ACL out-ports fulfilled in `main/container.ts`).

## Known remaining work (for true 100% 1:1)

Backend deferred bridges — RESOLVED (verified: tsc 0, depcruise 0, server boots /health 200):
- ✅ **credentials StateSigner → AES-256-GCM** (`AesStateSigner`): OAuth `state` now
  confidential + authenticated (key = ENCRYPTION_KEY or derived from BETTER_AUTH_SECRET).
- ✅ **tasks AgentRunner → assistant RunInference** (new non-streaming `RunInference`
  in-port + `ClaudeBatchRuntime` SDK adapter; per-tool task budget guard not threaded —
  RunInference enforces its own MutationBudget cap).
- ✅ **email AiDrafter → assistant RunInference** (summarize/draft).
- ✅ **automation TriggerRegistry → plugins InvokePieceTrigger** (onEnable/onDisable/run).
- ✅ **credentials OAuthConfigProvider → plugins GetOAuthConfig** (piece catalog).
- ✅ **assistant AgentDirectory → agents.ResolveAgent + skills.ResolveSkill** (real agent
  config + skill prompt assembly; live company/knowledge prompt enrichment not gathered).
- ✅ **files → knowledge file-indexing consumer** (extract text via pdf-parse/utf8 → IndexFile).

- ✅ **settings SetupProvisioner saga**: owner promotion + invites (identity) + Eric agent
  (agents, with bot user) + SMTP account (email). Routine-entity seeding left as a seed
  script (source-specific starter-entity list).
- ✅ **plugins real piece execution** (`ActivepiecesPieceClient`): loads the piece from
  `.pieces/` and runs `action.run` / trigger hooks with a real ActionContext (store via
  PluginStoreRepository, resolved credential, auth gate). Wired into InvokePiece +
  ResolvePieceAction + InvokePieceTrigger; automation `PieceGateway` → `ResolvePieceAction`.
  Pieces resolve at runtime from `PIECES_DIR`; absent piece → graceful fail (offline demo
  keeps StubPieceClient).

Genuinely remaining (minor):
- routine-entity seed data (a `db:seed` script with AEX's starter entities).
- 14 ported-style controllers still wrapped `z.any()` in routes.ts (input typing nicety).
- DB provisioned via `drizzle-kit push` (no generated migration files).
- ✅ **frontend strict `tsc` is now 0** (was ~419). Fixes: api emits declarations
  (`build:types` via tsc-alias) so web consumes a clean `AppRouter` .d.ts; all 14
  plain controllers became native typed tRPC routers; the tRPC contract was aligned
  to AEX's procedure names/shapes the copied frontend calls (entities/records merged,
  viewPreferences, forms.getPublicForm, credentials.getByPlugin, task.agentId/type,
  email.externalId, entity.createdAt/viaFieldId); i18n param strictness relaxed via a
  permissive `TFunction` overload; unused imports/casts/4 real prop bugs fixed.
  Frontend `tsc --noEmit` = 0 and `vite build` OK.
  Two latent pre-existing runtime bugs surfaced + flagged (PublicForm options render
  `[object Object]`; FilesPage restore is a no-op) — left as-is (would change runtime).
- ✅ **frontend reorganized into hexagonal feature-folders** (was Atomic Design). 296
  files moved via a ts-morph codemod (auto-rewrote all importers): `app/` (App, main,
  providers), `platform/` (the access layer: trpc, api, ws, i18n), `shared/` (ui, lib,
  hooks), and `features/{auth,chat,database,files,flows,forms,knowledge,mail,settings,
  tasks,workspace}/`. tsc 0, vite build OK, 202 tests pass (7 pre-existing DocsPage
  failures unrelated — repo-root docs/user/*.md absent in this checkout).

Router typing:
- 14 ported-style controllers return plain handler maps and are wrapped in
  `routes.ts` as `protectedProcedure` with `z.any()` input (server-authoritative
  user injected). They lose per-input static typing at the router boundary until
  refactored to native `router()` factories. 10 controllers are fully tRPC-typed.

Per-context fidelity caveats (documented in each agent's report / code comments):
- data: bulk record-key migration on field rename/type-change not implemented;
  read-side relationship/rollup label resolution not modeled.
- error codes: `Result<T>` carries a string only, so domain failures surface as
  tRPC `BAD_REQUEST` (source used CONFLICT/FORBIDDEN/NOT_FOUND).
- reminders persisted to the dedicated `reminders` table (source used `tasks`).
- table-ownership: a few read adapters query another context's table via the shared
  platform schema (depcruise allows; ownership-wise prefer routing through ACL).

Infra/tooling:
- DB provisioned via `drizzle-kit push`; generated migration files not produced.
- Frontend `tsc --noEmit` carries ~400 pre-existing strictness errors inherited
  from the source (unused React imports, i18n param typing, deep instantiation).
  The source's gate is `vite build` + eslint, not strict tsc — same here.

## How to run

```bash
npm install --legacy-peer-deps
docker compose up -d postgres redis           # or point .env at existing pg/redis
docker exec <pg> psql -U aex -d aex -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run db:push -w @aex/api
npm run dev                                    # api :3001 + web :5173
npm run verify -w @aex/api                     # tsc + depcruise
npm run demo -w @aex/api                       # offline hexagon demo
```
