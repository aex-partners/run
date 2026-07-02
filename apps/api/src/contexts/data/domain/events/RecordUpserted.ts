import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class RecordUpserted implements DomainEvent {
  readonly name = 'data.RecordUpserted'
  constructor(
    public readonly aggregateId: string,
    public readonly entityId: string,
    public readonly version: number,
    public readonly occurredAt: Date,
  ) {}
}
