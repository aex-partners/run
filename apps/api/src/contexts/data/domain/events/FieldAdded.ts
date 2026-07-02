import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FieldAdded implements DomainEvent {
  readonly name = 'data.FieldAdded'
  constructor(
    public readonly aggregateId: string,
    public readonly fieldName: string,
    public readonly fieldKind: string,
    public readonly occurredAt: Date,
  ) {}
}
