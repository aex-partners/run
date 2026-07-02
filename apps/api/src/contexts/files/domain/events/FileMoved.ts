import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileMoved implements DomainEvent {
  readonly name = 'files.FileMoved'
  constructor(
    public readonly aggregateId: string,
    public readonly parentId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
