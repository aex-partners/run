import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class EmailLabelsChanged implements DomainEvent {
  readonly name = 'email.EmailLabelsChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly labelNames: readonly string[],
    public readonly occurredAt: Date,
  ) {}
}
