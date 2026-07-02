import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailAccountDeleted implements DomainEvent {
  readonly name = 'email.EmailAccountDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
