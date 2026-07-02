import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FormCreated implements DomainEvent {
  readonly name = 'forms.FormCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly entityId: string,
    public readonly formName: string,
    public readonly occurredAt: Date,
  ) {}
}
