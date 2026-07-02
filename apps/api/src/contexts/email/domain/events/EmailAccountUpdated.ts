import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailAccountUpdated implements DomainEvent {
  readonly name = 'email.EmailAccountUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
