// Driven port for the background send pipeline. Transactional mail is enqueued
// here and delivered by the EmailWorker driving adapter (AEX email-queue.ts ->
// email-worker.ts). The adapter wraps a BullMQ "email-send" queue.
export interface QueuedEmail {
  accountId: string
  to: string[]
  cc?: string[]
  subject: string
  bodyHtml: string
  bodyText?: string
  fromName?: string
  replyTo?: string
  inReplyTo?: string
  // When false, the delivered email is NOT persisted to the Sent folder
  // (transactional mail is fire-and-forget). Defaults to storing.
  storeSent?: boolean
}

export interface EmailQueue {
  enqueue(job: QueuedEmail): Promise<void>
}
