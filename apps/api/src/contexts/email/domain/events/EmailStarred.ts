import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailStarred implements DomainEvent {
  readonly name = 'email.EmailStarred'
  constructor(
    public readonly aggregateId: string,
    public readonly starred: boolean,
    public readonly occurredAt: Date,
  ) {}
}
