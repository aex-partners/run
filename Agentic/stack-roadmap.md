# AEX Agentic — Stack & Roadmap

> Documento de referencia para o desenvolvimento completo do AEX Agentic.

---

## Fases concluidas

### Phase 0 — UI Component Library ✅

| Camada | Stack | Status |
|--------|-------|--------|
| **UI Components** | React 19 + TypeScript + Vite | 30 componentes (atomic design) |
| **Styling** | Tailwind v4 + CSS Variables | Tema laranja #EA580C |
| **Component Docs** | Storybook v8 | Stories para todos os componentes |
| **Icons** | Lucide React | Padronizado |
| **Workflow Canvas** | ReactFlow (@xyflow/react) | Visual editor funcional |
| **i18n** | `src/locales/en.ts` | Estrutura pronta |

### Phase 1 — Fundacao (Backend + Auth + DB) ✅

| Camada | O que foi construido |
|--------|---------------------|
| **Monorepo** | npm workspaces: `apps/api`, `apps/web`, `packages/shared` |
| **API** | Fastify 5 + tRPC 11, routers: `auth.me`, `conversations.{list,getById,create,addMember}`, `messages.{list,send}`, `users.{list,invite,updateRole}` |
| **DB** | PostgreSQL 17 + Drizzle ORM. Tabelas: users, sessions, accounts, conversations, conversation_members, messages |
| **Auth** | better-auth com emailAndPassword + admin plugin, sign-up/sign-in testados |
| **Shared** | `@aex/shared`: UserRole, ConversationType, MessageRole, signUp/signIn schemas |
| **WebSocket** | Scaffold em `/ws` (echo mode, sem auth, broadcast/sendToUser helpers) |
| **Frontend** | TRPCProvider + httpBatchLink, Vite proxy `/api` → :3001, `/ws` → ws://:3001 |
| **Docker** | docker-compose.yml: postgres, redis, api, web, caddy |

### Phase 2 — Chat Funcional + App Shell ✅

| Camada | O que foi construido |
|--------|---------------------|
| **Seed** | `apps/api/src/scripts/seed.ts` — cria admin@aex.app idempotente. Script `db:seed` no package.json |
| **Users Router** | `users.{list,invite,updateRole}` — admin-only, protecao contra self-demotion |
| **Conversations** | `conversations.list` enriquecido (lastMessage, lastMessageAt via subquery), `rename` e `delete` com verificacao de membership |
| **Messages** | `messages.list` com LEFT JOIN users (authorName), `send` com broadcast WebSocket para membros |
| **WebSocket** | Auth via cookie (getSession), multi-connection (`Map<string, Set<WebSocket>>`), ping/pong, `sendToConversation` helper |
| **Auth Config** | `trustedOrigins: [CORS_ORIGIN]` para aceitar requests do frontend |
| **Login/Signup** | `LoginPage` e `SignupPage` chamando better-auth REST, tratamento de erros |
| **Routing** | react-router-dom, `ProtectedRoute` com `trpc.auth.me`, AuthContext provider |
| **App Shell** | `MainApp` com AppShell, section switching (chat, settings, coming soon) |
| **Chat** | `ChatPage` — tRPC queries mapeadas para ChatScreen, create/send/delete/rename mutations |
| **Settings** | `SettingsPage` — UserTable com dados reais, invite modal (Radix Dialog) |
| **WebSocket FE** | `useWebSocket` — auto-reconnect com backoff, invalidacao do React Query cache em new_message |
| **ChatScreen** | Adicionado prop `onRenameConversation` com callback no commitRename |
| **i18n** | Strings de auth adicionadas em `locales/en.ts` |
| **Cleanup** | App.css limpo (removido boilerplate Vite), App.tsx reescrito com router |

### Phase 3 — Agente de IA (OpenAI) ✅

| Camada | O que foi construido |
|--------|---------------------|
| **OpenAI SDK** | `openai` package, client singleton em `apps/api/src/ai/client.ts` |
| **AI Module** | 6 arquivos: `client.ts`, `prompts.ts`, `tools.ts`, `executor.ts`, `agent.ts`, `pending-actions.ts` |
| **System Prompt** | AEX Agentic como ERP assistant, instrucoes para tools vs conversa |
| **5 Tools** | `create_conversation`, `rename_conversation`, `delete_conversation`, `list_users`, `send_message` |
| **Tool Execution** | Read-only tools (list_users) executam imediatamente; mutating tools passam por ActionCard |
| **Streaming** | Token-by-token via WebSocket: `ai_stream_start`, `ai_stream_chunk`, `ai_stream_end` |
| **Typing Indicator** | `ai_typing` events, exibido no MessageThread enquanto aguarda resposta |
| **Auto-naming** | Conversas auto-nomeadas apos primeira troca (gpt-4.1-nano) |
| **Abort Handling** | `AbortController` por conversa, cancela chamada anterior em mensagens rapidas |
| **ActionCard Flow** | `ai.confirmAction` mutation, PendingAction in-memory com 5min TTL |
| **Metadata Column** | `metadata` text column em messages para persistir ActionCard state |
| **COALESCE authorName** | AI messages sem authorId mostram "AEX Agentic" |
| **Frontend Streaming** | `WebSocketProvider` context, streams ref + tick counter para re-render |
| **Welcome Screen** | Tela de boas-vindas com cards de acao quando nenhuma conversa selecionada |
| **Settings Guard** | Icone de Settings oculto para users nao-admin |
| **Branding** | Logo SVG real da AEX em AppShell, Login, Signup. Nome "AEX Agentic" |
| **Sidebar Fix** | ConversationItem com ellipsis correto, sidebar 280px |
| **Unread Counts** | `lastReadAt` em conversation_members, query SQL eficiente com INNER JOIN, `markRead` mutation, badges no sidebar |
| **Coming Soon** | Placeholders com icone + titulo + descricao + badge "Under development" para Database, Tasks, Workflows |

**Arquivos criados (9):**
`ai/client.ts`, `ai/prompts.ts`, `ai/tools.ts`, `ai/executor.ts`, `ai/agent.ts`, `ai/pending-actions.ts`, `trpc/routers/ai.ts`, `providers/WebSocketProvider.tsx`

**Arquivos modificados (14):**
`api/package.json`, `env.ts`, `.env`, `db/schema/app.ts`, `trpc/router.ts`, `trpc/routers/messages.ts`, `trpc/routers/conversations.ts`, `hooks/useWebSocket.ts`, `pages/ChatPage.tsx`, `pages/MainApp.tsx`, `pages/LoginPage.tsx`, `pages/SignupPage.tsx`, `components/screens/ChatScreen/ChatScreen.tsx`, `components/layout/AppShell/AppShell.tsx`, `components/molecules/ConversationItem/ConversationItem.tsx`, `components/organisms/ConversationList/ConversationList.tsx`, `locales/en.ts`

**Decisoes tecnicas:**
- OpenAI (gpt-4.1) ao inves de Claude, por preferencia do usuario
- gpt-4.1-nano para auto-naming (mais barato/rapido)
- Fire-and-forget: `messages.send` retorna imediatamente, AI processa async
- Streaming via WebSocket (nao SSE), 3 eventos: start/chunk/end
- Tool calls acumulados como fragmentos JSON, parseados apos stream end
- PendingAction in-memory (sem DB), 5min TTL, server restart perde pendentes
- WebSocketProvider context evita conexoes duplicadas entre MainApp e ChatPage
- `width: 0; min-width: 100%` trick para forcar ellipsis dentro do Radix ScrollArea
- Unread count via SQL JOIN eficiente (nao carrega mensagens no JS)

---

## Stack Completa

```
┌─────────────────────────────────────────────────┐
│                    FRONTEND                      │
│  React 19 · TypeScript · Vite · Tailwind v4     │
│  Radix UI · ReactFlow · Storybook               │
├─────────────────────────────────────────────────┤
│                   API LAYER                      │
│  tRPC  (type-safe, end-to-end TypeScript)       │
│  WebSocket (chat em tempo real, AI streaming)    │
├─────────────────────────────────────────────────┤
│                    BACKEND                       │
│  Node.js + Fastify (HTTP + WS server)           │
│  BullMQ (fila de tasks e workflows) [Phase 4]   │
│  OpenAI API (agente de IA, tool use, streaming) │
├─────────────────────────────────────────────────┤
│                   DATABASE                       │
│  PostgreSQL (dados + schemas dinamicos)          │
│  Drizzle ORM (migrations, type-safe queries)    │
│  Redis (fila BullMQ, sessoes, cache)            │
├─────────────────────────────────────────────────┤
│                    AUTH                           │
│  better-auth (self-hosted, sessoes, RBAC)       │
├─────────────────────────────────────────────────┤
│                   INFRA                          │
│  Docker Compose (single-tenant, self-hosted)    │
│  Caddy (reverse proxy, auto-TLS)               │
└─────────────────────────────────────────────────┘
```

---

## Fases concluidas (continuacao)

### Phase 4 — Tasks ✅

| Camada | O que foi construido |
|--------|---------------------|
| **BullMQ** | Fila `tasks` com Redis, worker com concurrency 3 |
| **Schema** | Tabelas `tasks` (id, title, status, progress, input, result, error, scheduledAt) e `task_logs` (id, taskId, level, message, metadata) |
| **tRPC Router** | `tasks.{list,getById,getLogs,cancel,retry,stats}` |
| **Task Runner** | AI loop (gpt-4.1) com tools, max 10 iteracoes, cancellation support, blocked tools (prevent loops) |
| **AI Tools** | `create_task` (com schedule_in_minutes), `list_tasks`, `cancel_task` |
| **Frontend** | TasksPage com stats grid, filtros, TaskDetailPanel com logs |
| **Real-time** | WebSocket events `task_updated` e `task_log`, progresso em tempo real |

**Decisoes tecnicas:**
- Worker reporta resultado final na conversa via `reportToChat()`
- Tasks com schedule_in_minutes usam delay do BullMQ
- Background task runner bloqueia create_task/cancel_task/list_tasks para evitar loops infinitos

---

### Phase 5 — Banco de Dados Dinamico + Onboarding ✅

| Camada | O que foi construido |
|--------|---------------------|
| **Schema** | Tabelas `entities` (id, name, slug, fields JSON, createdBy), `entity_records` (id, entityId, data JSON), `settings` (key/value) |
| **Entity Fields** | Sistema de campos dinamicos: text, number, email, phone, date, select, checkbox. Validacao de dados. `slugify()` para normalizacao |
| **tRPC Router** | `entities.{list,getById,records,createRecord,updateRecord,deleteRecord,deleteEntity,renameEntity,addField,removeField}` + `settings.{get,set}` |
| **AI Tools** | `create_entity`, `add_field`, `query_records`, `insert_record`, `update_record`, `delete_record`, `list_entities`, `save_company_profile` |
| **Onboarding** | System prompt adaptativo: detecta sistema vazio, guia setup, auto-executa create_entity e save_company_profile sem ActionCard |
| **Frontend** | DatabasePage com entity sidebar, DataGrid com CRUD inline, add field dialog |
| **Dynamic Prompt** | `buildSystemPrompt(db)` carrega company profile + entities com campos no contexto da IA |

**Decisoes tecnicas:**
- Fields armazenados como JSON string (nao JSONB), parseados no runtime
- Records armazenam data como JSON com slugified keys
- `resolveEntity()` aceita ID, slug, ou nome (case-insensitive)
- Onboarding tools (create_entity, save_company_profile) auto-executam sem confirmacao
- Entity templates por tipo de negocio no prompt de onboarding

---

### Phase 6 — Workflows ✅

| Camada | O que foi construido |
|--------|---------------------|
| **Schema** | Tabelas `workflows` (id, name, slug, status, triggerType, triggerConfig, graph JSON) e `workflow_executions` (id, workflowId, status, triggeredBy, result, error) |
| **tRPC Router** | `workflows.{list,getById,create,update,saveGraph,delete,execute,executionHistory,setTrigger}` |
| **Execution Engine** | Topological sort do grafo, execucao sequencial de nodes: trigger (skip), action (OpenAI+tools), condition (branching yes/no), notification (broadcast) |
| **Queue** | Fila `workflow-executions` separada da `tasks`, worker com concurrency 2 |
| **Triggers** | Cron (BullMQ repeatable jobs), Event (in-memory map + hook no broadcast), `loadActiveTriggers()` no startup |
| **AI Tools** | `create_workflow` (gera graph automatico dos steps), `list_workflows`, `execute_workflow`, `update_workflow` |
| **Dynamic Prompt** | Secao `## Active Workflows` no system prompt com lista de workflows ativos e seus triggers |
| **Frontend** | WorkflowsPage com sidebar, canvas ReactFlow, history panel, empty state. Substitui ComingSoonPlaceholder |
| **WebSocket** | Eventos `workflow_updated`, `workflow_execution_started/step/completed/failed`, invalidacao automatica de queries |

**Decisoes tecnicas:**
- Graph = ReactFlow JSON direto (`{ nodes: [], edges: [] }`), sem transformacao intermediaria
- Action nodes executam chamada AI com tools (sincrono dentro do workflow, nao BullMQ separado)
- Condition nodes avaliam resultado do no anterior (truthy check: count > 0, records.length > 0, etc.)
- `generateGraphFromSteps()` cria layout vertical automatico a partir de array de steps da IA
- Event triggers via hook no `broadcast()`: checa matches e enfileira automaticamente
- Cron triggers re-registrados no startup via `loadActiveTriggers(db)`
- Workflow worker trata tanto execucoes manuais (executionId) quanto cron (workflowId direto)

---

## Roadmap

### Phase 7 — Plugins & Marketplace

1. Schema: tabela `plugins` (id, name, version, config JSONB, enabled)
2. Plugin API: interface TypeScript para registrar tools + triggers
3. PluginCard na SettingsScreen com install/uninstall
4. Plugins registram tools que a IA pode chamar
5. Plugins registram triggers que workflows podem usar
6. Marketplace interno (lista de plugins disponiveis)

**Notas pos-Phase 6:**
- O sistema de tools ja e extensivel (Map de executores em `executor.ts`). O plugin system precisa apenas de um registry que injeta tools no `toolExecutors` e no `TOOL_DEFINITIONS`.
- Triggers de workflow ja suportam event type generico. Plugins podem registrar novos event types que o hook no broadcast reconhece.
- PluginCard UI ja existe no Storybook, falta conectar.

#### Verificacao
- Instalar plugin → IA ganha novas tools
- Desinstalar plugin → tools removidas
- Plugin aparece como trigger option no workflow canvas

---

### Phase 8 — Producao

1. RBAC: permissoes granulares por entidade/acao
2. Audit log: tabela com quem/o que/quando para todas as mutacoes
3. Backup/restore: pg_dump agendado, restore via settings
4. Rate limiting e validacao de input em todas as rotas
5. Dockerfile otimizado (multi-stage build)
6. Documentacao: README com setup, deploy, configuracao
7. Health checks e graceful shutdown
8. Script de one-click install (docker compose + seed)

**Notas pos-Phase 6:**
- Todas as mutations ja passam por `protectedProcedure` (auth obrigatorio). RBAC precisa adicionar verificacao de role/permissao em cima disso.
- O `broadcast()` agora tem hook de event triggers. O audit log pode usar o mesmo pattern: hook no broadcast que grava na tabela audit.
- PendingActions ainda sao in-memory (perdem-se no restart). Phase 8 pode migrar para Redis ou DB.
- Workflow executions ja gravam result/error, servem como base para audit trail de automacoes.

#### Verificacao
- User sem permissao recebe 403
- Audit log registra todas as acoes
- `docker compose up` em maquina limpa → sistema funcional

---

## Inventario atual (pos-Phase 6)

### tRPC Routers (9 routers, 42 procedures)

| Router | Procedure | Tipo | Descricao |
|--------|-----------|------|-----------|
| `auth` | `me` | query | Retorna sessao do usuario atual |
| `conversations` | `list` | query | Conversas do usuario com lastMessage, lastMessageAt, unreadCount |
| `conversations` | `getById` | query | Conversa por ID |
| `conversations` | `create` | mutation | Criar conversa (dm/channel/ai) |
| `conversations` | `addMember` | mutation | Adicionar membro |
| `conversations` | `rename` | mutation | Renomear (verifica membership) |
| `conversations` | `markRead` | mutation | Atualiza lastReadAt para zerar unread |
| `conversations` | `delete` | mutation | Deletar (verifica membership) |
| `messages` | `list` | query | Mensagens com authorName (COALESCE "AEX Agentic"), metadata, paginacao cursor |
| `messages` | `send` | mutation | Envia mensagem + trigger AI se tipo=ai (fire-and-forget) |
| `users` | `list` | query | Lista usuarios (admin-only) |
| `users` | `invite` | mutation | Cria usuario (admin-only) |
| `users` | `updateRole` | mutation | Altera role (admin-only, protege self-demotion) |
| `ai` | `confirmAction` | mutation | Confirma/cancela ActionCard pendente |
| `tasks` | `list` | query | Lista tasks com filtro de status |
| `tasks` | `getById` | query | Task por ID |
| `tasks` | `getLogs` | query | Logs de uma task |
| `tasks` | `cancel` | mutation | Cancela task pending/running |
| `tasks` | `retry` | mutation | Recria task a partir de uma falhada |
| `tasks` | `stats` | query | Contagens por status |
| `entities` | `list` | query | Entidades com record count |
| `entities` | `getById` | query | Entidade com fields parsed |
| `entities` | `records` | query | Records paginados de uma entidade |
| `entities` | `createRecord` | mutation | Insere record com validacao |
| `entities` | `updateRecord` | mutation | Atualiza record com merge |
| `entities` | `deleteRecord` | mutation | Deleta record |
| `entities` | `deleteEntity` | mutation | Deleta entidade (cascade) |
| `entities` | `renameEntity` | mutation | Renomeia entidade + slug |
| `entities` | `addField` | mutation | Adiciona campo a entidade |
| `entities` | `removeField` | mutation | Remove campo de entidade |
| `settings` | `get` | query | Busca setting por key |
| `settings` | `set` | mutation | Salva setting key/value |
| `workflows` | `list` | query | Workflows com execution count |
| `workflows` | `getById` | query | Workflow com graph parsed |
| `workflows` | `create` | mutation | Cria workflow com trigger node default |
| `workflows` | `update` | mutation | Atualiza nome/status, gerencia triggers |
| `workflows` | `saveGraph` | mutation | Salva nodes/edges JSON |
| `workflows` | `delete` | mutation | Deleta com cleanup de triggers |
| `workflows` | `execute` | mutation | Cria execution e enfileira |
| `workflows` | `executionHistory` | query | Lista executions de um workflow |
| `workflows` | `setTrigger` | mutation | Altera triggerType/Config, re-registra |

### Tabelas DB (12 tabelas)

| Tabela | Colunas principais |
|--------|--------------------|
| `users` | id, name, email, role (user/admin), banned, createdAt |
| `sessions` | id, userId, token, expiresAt, ipAddress, userAgent |
| `accounts` | id, userId, accountId, providerId, password |
| `conversations` | id, name, type (dm/channel/ai), createdAt, updatedAt |
| `conversation_members` | conversationId, userId, joinedAt, lastReadAt [PK composta] |
| `messages` | id, conversationId, authorId, content, role (user/ai/system), metadata (JSON), createdAt |
| `tasks` | id, title, description, status, progress, input, result, error, conversationId, createdBy, scheduledAt, timestamps |
| `task_logs` | id, taskId, level (info/warn/error/step), message, metadata, createdAt |
| `entities` | id, name, slug, fields (JSON), createdBy, timestamps |
| `entity_records` | id, entityId, data (JSON), createdBy, timestamps |
| `settings` | key (PK), value, updatedAt |
| `workflows` | id, name, slug, status (active/paused), triggerType (manual/cron/event), triggerConfig (JSON), graph (JSON), createdBy, timestamps |
| `workflow_executions` | id, workflowId, status (pending/running/completed/failed), triggeredBy, result, error, timestamps |

### WebSocket Events (16 tipos)

| Evento | Direcao | Descricao |
|--------|---------|-----------|
| `new_message` | server→client | Nova mensagem (broadcast para membros) |
| `ai_typing` | server→client | Indicador de digitacao da IA |
| `ai_stream_start` | server→client | Inicio do streaming de resposta |
| `ai_stream_chunk` | server→client | Fragmento de texto da IA |
| `ai_stream_end` | server→client | Fim do streaming |
| `conversation_renamed` | server→client | Conversa renomeada (auto-naming) |
| `task_updated` | server→client | Task status/progress changed |
| `task_log` | server→client | Novo log entry de task |
| `entity_updated` | server→client | Entity schema changed |
| `record_updated` | server→client | Entity record changed |
| `workflow_updated` | server→client | Workflow criado/atualizado/deletado |
| `workflow_execution_started` | server→client | Execucao iniciou |
| `workflow_execution_step` | server→client | Step de execucao (running/completed/failed) |
| `workflow_execution_completed` | server→client | Execucao completou |
| `workflow_execution_failed` | server→client | Execucao falhou |
| `workflow_notification` | server→client | Notificacao de workflow step |

### AI Tools (19 tools)

| Tool | Tipo | Descricao |
|------|------|-----------|
| `create_conversation` | mutating | Cria conversa (requer ActionCard) |
| `rename_conversation` | mutating | Renomeia conversa (requer ActionCard) |
| `delete_conversation` | mutating | Deleta conversa (requer ActionCard) |
| `list_users` | read-only | Lista usuarios |
| `send_message` | mutating | Envia mensagem (requer ActionCard) |
| `create_task` | mutating | Cria background task (requer ActionCard) |
| `list_tasks` | read-only | Lista tasks |
| `cancel_task` | mutating | Cancela task (requer ActionCard) |
| `create_entity` | mutating/auto-onboarding | Cria entidade com campos |
| `add_field` | mutating | Adiciona campo a entidade |
| `query_records` | read-only | Consulta records |
| `insert_record` | mutating | Insere record |
| `update_record` | mutating | Atualiza record |
| `delete_record` | mutating | Deleta record |
| `list_entities` | read-only | Lista entidades |
| `save_company_profile` | mutating/auto-onboarding | Salva perfil da empresa |
| `create_workflow` | mutating | Cria workflow com steps (gera graph automatico) |
| `list_workflows` | read-only | Lista workflows |
| `execute_workflow` | mutating | Executa workflow manualmente |
| `update_workflow` | mutating | Atualiza workflow (regenera graph se steps fornecidos) |

### BullMQ Queues (2 filas)

| Fila | Worker | Concurrency | Descricao |
|------|--------|-------------|-----------|
| `tasks` | task-worker | 3 | Executa background tasks com AI loop |
| `workflow-executions` | workflow-worker | 2 | Executa workflows (manual + cron triggers) |

### UI Components (30 componentes, atomic design)

| Nivel | Componentes |
|-------|-------------|
| **atoms** (6) | Avatar, Badge, Button, Input, Separator, StatusDot |
| **molecules** (11) | ActionCard, AIChatBar, ConversationItem, EntityRow, HistoryEntry, MessageBubble, NavItem, PluginCard, StatsCard, TaskCard, WorkflowItem |
| **organisms** (7) | ConversationList, DataGrid, MessageThread, TaskList, UserTable, WorkflowCanvas, WorkflowSidebar |
| **screens** (5) | ChatScreen, DatabaseScreen, TasksScreen, WorkflowsScreen, SettingsScreen |
| **layout** (1) | AppShell |

### Frontend Pages (6 pages, todas conectadas)

| Page | Status |
|------|--------|
| ChatPage | Conectada (tRPC + WebSocket streaming) |
| SettingsPage | Conectada (users CRUD, invite) |
| TasksPage | Conectada (list, stats, cancel, retry, detail panel) |
| DatabasePage | Conectada (entity CRUD, record CRUD inline, add field) |
| WorkflowsPage | Conectada (list, create, toggle status, delete, canvas, history) |
| LoginPage / SignupPage | Conectadas (better-auth REST) |

### Infra (Docker Compose)

| Servico | Imagem | Porta | Status |
|---------|--------|-------|--------|
| postgres | postgres:17-alpine | 5432 | Ativo |
| redis | redis:7-alpine | 6379 | Ativo (BullMQ tasks + workflows) |
| api | Node.js + Fastify | 3001 | Ativo |
| web | Vite dev server | 5173 | Ativo |
| caddy | caddy:2-alpine | 80/443 | Reverse proxy + TLS |

### O que existe como UI mas NAO tem backend

| Feature | UI pronta | Backend | Status |
|---------|-----------|---------|--------|
| Plugins | PluginCard | Nenhum | Phase 7 |

---

## Justificativa da Stack

- **tRPC** — type safety end-to-end, zero codigo de serializacao, funciona nativo com React
- **Fastify** — mais rapido que Express, suporte nativo a WebSocket
- **Drizzle** — migrations programaticas (essencial para schema dinamico), type-safe
- **BullMQ + Redis** — fila robusta para tasks e workflows, com retry e scheduling
- **OpenAI API** — gpt-4.1 para agente principal, gpt-4.1-nano para tarefas leves (auto-naming)
- **better-auth** — self-hosted, sem dependencia externa, RBAC built-in
- **Docker Compose** — single-tenant = 1 instancia por empresa, simples de deployar
