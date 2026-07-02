import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailSummarized implements DomainEvent {
  readonly name = 'email.EmailSummarized'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
