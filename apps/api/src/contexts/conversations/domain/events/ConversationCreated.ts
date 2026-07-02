import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { ConversationType } from '@/contexts/conversations/domain/ConversationType'

export class ConversationCreated implements DomainEvent {
  readonly name = 'conversations.ConversationCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly type: ConversationType,
    public readonly agentId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
