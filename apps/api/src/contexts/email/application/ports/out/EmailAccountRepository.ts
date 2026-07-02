import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Driven port for the email_accounts store.
export interface EmailAccountRepository {
  nextId(): EmailAccountId
  findById(id: EmailAccountId): Promise<EmailAccount | null>
  // Ids of every account the user may act on (owned + shared memberships). Backs
  // the scoping of all email/label queries and actions.
  accountIdsForUser(userId: string): Promise<string[]>
  save(account: EmailAccount): Promise<void>
  delete(account: EmailAccount): Promise<void>
}
