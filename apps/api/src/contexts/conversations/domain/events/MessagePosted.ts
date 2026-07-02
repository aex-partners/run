import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'

// Recorded when a message lands in a conversation (send, forward, audio, system
// post). `recipientIds` is the fan-out audience the platform WS adapter pushes
// to — the conversation's members minus the author (the source excludes the
// sender from its own `new_message` broadcast). The aggregateId is the message id.
export class MessagePosted implements DomainEvent {
  readonly name = 'conversations.MessagePosted'
  constructor(
    public readonly aggregateId: string,
    public readonly conversationId: string,
    public readonly authorId: string | null,
    public readonly role: MessageRole,
    public readonly content: string,
    public readonly recipientIds: readonly string[],
    public readonly occurredAt: Date,
  ) {}
}
