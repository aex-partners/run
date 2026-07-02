import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class AgentCreated implements DomainEvent {
  readonly name = 'agents.AgentCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly agentName: string,
    public readonly slug: string,
    public readonly occurredAt: Date,
  ) {}
}
