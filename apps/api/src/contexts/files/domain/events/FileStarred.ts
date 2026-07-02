import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileStarred implements DomainEvent {
  readonly name = 'files.FileStarred'
  constructor(
    public readonly aggregateId: string,
    public readonly starred: boolean,
    public readonly occurredAt: Date,
  ) {}
}
