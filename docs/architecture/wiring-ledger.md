# Wiring Ledger (ACL out-ports → fulfilled in main/container.ts)

Running list of cross-context ACL out-ports declared by migrated contexts. Each
is an interface in `<ctx>/application/ports/out/`; the composition root bridges
it to the target context's in-port (no context imports another).

## From Wave 2

| Source ctx | Out-port | Target / fulfillment |
|---|---|---|
| reminders | `ConversationPoster` | conversations `AppendMessage`/`PostSystemMessage` (new in-port) |
| reminders | `Scheduler` (BullScheduler) | platform BullMQ queue `reminder-<id>` + ReminderWorker |
| notifications | `EmailSender` | email `SendTransactional` (digest template); stub until email lands |
| forms | `EntityRecordSink` | data `InsertRecord` |
| forms | `EntityCatalog` | data (read entity field defs) — prefer a data read in-port |
| files | `FileIndexingQueue` | knowledge indexing in-port |
| files | `UserDirectory` | identity users read in-port |
| identity | `AuditTrail` | audit `RecordAuditEvent` |
| identity | `ConversationGateway` (ensureDm/ensureEric) | conversations `EnsureDm`/`EnsureEric` |
| identity | `InviteNotifier` | email/notifications invite template |
| identity | `SessionGateway`, `PasswordHasher` | better-auth (platform) |
| identity | `BreachChecker` | HIBP adapter (provided) |
| settings | `AuditTrail` | audit `RecordAuditEvent` |
| settings | `SetupProvisioner` | SAGA in main: data(entities), assistant(agents/eric), identity(owner), email(account) |
| geocode | `GeocodeProvider` | NominatimProvider (provided) |
| knowledge | `FileSourceGateway` | files read in-port |
| knowledge | `EmbeddingGateway` | VoyageEmbeddingGateway (provided, needs ANTHROPIC_API_KEY) |

## Cross-cutting fixes for Wave 6

- **AppContext.email**: add so audit `actorEmail` is populated (identity/settings need it).
- **Error-code fidelity**: `unwrap` collapses CONFLICT/FORBIDDEN/NOT_FOUND → BAD_REQUEST.
  Add a `Result` error-kind → tRPC code mapping in platform/http/trpc.
- **Table ownership leak**: some read adapters query another context's table directly
  via the shared `@/platform/db/schema` (depcruise allows it; ownership-wise it bypasses
  the boundary). E.g. forms `GetPublicForm` reads `entities`, files `UserDirectory` reads
  `users`. Decide: accept (pragmatic shared-DB) or route reads through ACL in-ports.
- **Reminders persistence**: ported against dedicated `reminders` table (cleaner) vs
  source `tasks(kind=reminder)`. Reconcile with tasks context.
- **UnitOfWork**: identity invite + settings setup span multiple repos; source used one
  DB transaction. Consider a UnitOfWork port if atomicity is required.

## Wave 3 (in progress)

tasks, email, credentials, integrations, conversations — append their ACL ports here
on completion (AgentRunner, SmtpSender/ImapClient/Cipher, OAuthClient, RecordSink,
AttachmentResolver, AgentDirectory, ...).
