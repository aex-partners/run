import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailLabelId } from '@/contexts/email/domain/ids'

// Mirrors the AEX `email_labels` table.
export interface EmailLabelRow {
  id: string
  accountId: string
  name: string
  color: string
  createdAt: Date
}

export interface EmailLabelValues {
  id: string
  accountId: string
  name: string
  color: string
}

export const EmailLabelMapper = {
  toValues(label: EmailLabel): EmailLabelValues {
    return {
      id: label.id.value,
      accountId: label.accountId,
      name: label.name,
      color: label.color,
    }
  },

  toDomain(row: EmailLabelRow): EmailLabel {
    return EmailLabel.rehydrate(EmailLabelId.of(row.id), {
      accountId: row.accountId,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt,
    })
  },
}
