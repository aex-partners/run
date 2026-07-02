import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileAccessChanged implements DomainEvent {
  readonly name = 'files.FileAccessChanged'
  constructor(
    public readonly aggregateId: string,
    public readonly fileId: string,
    public readonly userId: string,
    public readonly access: string,
    public readonly occurredAt: Date,
  ) {}
}
