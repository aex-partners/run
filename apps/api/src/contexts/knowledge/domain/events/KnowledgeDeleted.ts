import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class KnowledgeDeleted implements DomainEvent {
  readonly name = 'knowledge.KnowledgeDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
