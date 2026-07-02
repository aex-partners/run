import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EntityUpdated implements DomainEvent {
  readonly name = 'data.EntityUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
