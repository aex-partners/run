import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'

// Mirrors the AEX `mail_account_members` table (composite key accountId+userId,
// canSend as a 0/1 integer).
export interface MailMemberRow {
  accountId: string
  userId: string
  canSend: number
  addedAt: Date
}

export interface MailMemberValues {
  accountId: string
  userId: string
  canSend: number
}

export const MailMemberMapper = {
  toValues(member: MailAccountMember): MailMemberValues {
    return {
      accountId: member.accountId,
      userId: member.userId,
      canSend: member.canSend ? 1 : 0,
    }
  },

  toDomain(row: MailMemberRow): MailAccountMember {
    return MailAccountMember.rehydrate(row.accountId, row.userId, {
      canSend: row.canSend === 1,
      addedAt: row.addedAt,
    })
  },
}
