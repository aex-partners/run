import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { Reaction } from '@/contexts/conversations/domain/Reaction'

// Recorded on pin/star/react. Fans out to ALL conversation members (the source
// broadcasts `message_updated` to everyone, actor included). Only the fields that
// changed are populated.
export interface MessageChanges {
  pinned?: boolean
  starred?: boolean
  reactions?: readonly Reaction[]
}

export class MessageUpdated implements DomainEvent {
  readonly name = 'conversations.MessageUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly conversationId: string,
    public readonly recipientIds: readonly string[],
    public readonly changes: MessageChanges,
    public readonly occurredAt: Date,
  ) {}
}
