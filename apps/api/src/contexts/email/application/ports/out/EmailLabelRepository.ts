import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailLabelId } from '@/contexts/email/domain/ids'

// Driven port for the email_labels store (label definitions per account).
export interface EmailLabelRepository {
  nextId(): EmailLabelId
  findById(id: EmailLabelId): Promise<EmailLabel | null>
  // Resolve a label by name within the caller's accounts, to copy its colour
  // when toggling the tag on an email.
  findByNameInAccounts(name: string, accountIds: readonly string[]): Promise<EmailLabel | null>
  save(label: EmailLabel): Promise<void>
  delete(label: EmailLabel): Promise<void>
}
