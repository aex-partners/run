import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailLabelDeleted implements DomainEvent {
  readonly name = 'email.EmailLabelDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
