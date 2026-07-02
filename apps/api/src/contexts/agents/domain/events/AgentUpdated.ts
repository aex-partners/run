import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class AgentUpdated implements DomainEvent {
  readonly name = 'agents.AgentUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
