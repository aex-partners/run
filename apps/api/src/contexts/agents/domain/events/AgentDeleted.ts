import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class AgentDeleted implements DomainEvent {
  readonly name = 'agents.AgentDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
