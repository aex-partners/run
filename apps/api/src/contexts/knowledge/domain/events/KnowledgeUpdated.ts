import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class KnowledgeUpdated implements DomainEvent {
  readonly name = 'knowledge.KnowledgeUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
