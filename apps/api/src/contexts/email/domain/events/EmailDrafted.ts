import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailDrafted implements DomainEvent {
  readonly name = 'email.EmailDrafted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
