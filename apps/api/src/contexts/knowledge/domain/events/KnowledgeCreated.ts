import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class KnowledgeCreated implements DomainEvent {
  readonly name = 'knowledge.KnowledgeCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly scope: string,
    public readonly category: string,
    public readonly occurredAt: Date,
  ) {}
}
