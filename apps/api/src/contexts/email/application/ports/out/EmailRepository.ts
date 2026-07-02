import { Email } from '@/contexts/email/domain/Email'
import { EmailId } from '@/contexts/email/domain/ids'

// Driven port. States WHAT the application needs from the emails store; an
// adapter under adapters/out implements HOW (Drizzle/Postgres, in-memory, ...).
// Account-scoped lookups carry the caller's accessible account ids so ownership
// can never be bypassed — the AEX verifyEmailAccess guard, made a port concern.
export interface EmailRepository {
  nextId(): EmailId
  // Worker-side load (no user scope): the snooze wake job knows only the id.
  findById(id: EmailId): Promise<Email | null>
  // The ownership-checked single load behind every per-email action.
  findInAccounts(id: EmailId, accountIds: readonly string[]): Promise<Email | null>
  // Bulk, ownership-checked load behind the markRead/move/spam multi-id actions.
  findManyInAccounts(ids: readonly string[], accountIds: readonly string[]): Promise<Email[]>
  // External Message-IDs already stored for an account, to skip duplicates on sync.
  existingExternalIds(accountId: string): Promise<Set<string>>
  save(email: Email): Promise<void>
  saveMany(emails: readonly Email[]): Promise<void>
}
