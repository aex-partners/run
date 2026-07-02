import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Permanent deletion (trash emptied or hard delete). The bytes are removed from
// storage by the use case before this is published.
export class FileDeleted implements DomainEvent {
  readonly name = 'files.FileDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
