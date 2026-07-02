import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileUnshared implements DomainEvent {
  readonly name = 'files.FileUnshared'
  constructor(
    public readonly aggregateId: string,
    public readonly fileId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
