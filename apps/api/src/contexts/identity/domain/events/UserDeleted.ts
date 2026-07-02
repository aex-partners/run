import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class UserDeleted implements DomainEvent {
  readonly name = 'identity.UserDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
