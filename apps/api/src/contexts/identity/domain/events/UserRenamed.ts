import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class UserRenamed implements DomainEvent {
  readonly name = 'identity.UserRenamed'
  constructor(
    public readonly aggregateId: string,
    public readonly userName: string,
    public readonly occurredAt: Date,
  ) {}
}
