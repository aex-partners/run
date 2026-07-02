import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FormUpdated implements DomainEvent {
  readonly name = 'forms.FormUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly entityId: string,
    public readonly occurredAt: Date,
  ) {}
}
