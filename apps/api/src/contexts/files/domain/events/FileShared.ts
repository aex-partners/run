import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileShared implements DomainEvent {
  readonly name = 'files.FileShared'
  constructor(
    public readonly aggregateId: string,
    public readonly fileId: string,
    public readonly userId: string,
    public readonly access: string,
    public readonly occurredAt: Date,
  ) {}
}
