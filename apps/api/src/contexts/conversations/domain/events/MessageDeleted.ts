import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Recorded on delete-for-everyone (a soft delete). Fans out `message_deleted` to
// all conversation members so every client drops it. Per-user "delete for me"
// records NO event (it changes nothing for other members).
export class MessageDeleted implements DomainEvent {
  readonly name = 'conversations.MessageDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly conversationId: string,
    public readonly recipientIds: readonly string[],
    public readonly occurredAt: Date,
  ) {}
}
