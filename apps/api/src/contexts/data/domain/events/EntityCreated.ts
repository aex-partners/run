import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EntityCreated implements DomainEvent {
  readonly name = 'data.EntityCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly entityName: string,
    public readonly occurredAt: Date,
  ) {}
}
