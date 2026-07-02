import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileTrashed implements DomainEvent {
  readonly name = 'files.FileTrashed'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
