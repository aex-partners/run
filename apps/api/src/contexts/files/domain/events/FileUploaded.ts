import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class FileUploaded implements DomainEvent {
  readonly name = 'files.FileUploaded'
  constructor(
    public readonly aggregateId: string,
    public readonly ownerId: string,
    public readonly fileName: string,
    public readonly size: number,
    public readonly occurredAt: Date,
  ) {}
}
