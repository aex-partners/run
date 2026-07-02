import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FormDeleted implements DomainEvent {
  readonly name = 'forms.FormDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly entityId: string,
    public readonly occurredAt: Date,
  ) {}
}
