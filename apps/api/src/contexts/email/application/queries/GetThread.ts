// Read side (CQRS). Backs emails.getThread: every accessible email sharing a
// threadId, oldest first, shaped for the thread view.
export interface ThreadMessage {
  id: string
  from: string
  fromEmail: string
  subject: string
  bodyHtml: string | null
  bodyText: string | null
  date: Date
  to: string[]
  cc: string[]
}

export interface GetThread {
  execute(input: { userId: string; threadId: string }): Promise<ThreadMessage[]>
}
