import { Result } from '@/shared/kernel/Result'

export interface DigestEmailItem {
  title: string
  body: string | null
}

export interface DigestEmail {
  userId: string
  name: string
  count: number
  items: DigestEmailItem[]
}

// ACL out-port. The notifications context must NOT import the email context, so
// it declares WHAT it needs (send a user their unread-notification digest) and
// the composition root fulfills HOW — routing to the email/transactional context
// (AEX `sendNotificationEmail` with the "notification-digest" template). System
// mail-account resolution and locale selection are the email context's concern,
// hidden behind this port: when no account is configured the adapter simply
// returns a failure/no-op and the digest counts that user as not sent.
export interface EmailSender {
  sendDigest(email: DigestEmail): Promise<Result<void>>
}
