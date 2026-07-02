import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'

// Driven port for the mail_account_members store (composite key accountId+userId).
export interface MailMemberRepository {
  find(accountId: string, userId: string): Promise<MailAccountMember | null>
  // Upsert (the AEX addMember does onConflictDoUpdate on canSend).
  save(member: MailAccountMember): Promise<void>
  delete(member: MailAccountMember): Promise<void>
}
