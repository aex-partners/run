import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EmailFolder } from '@/contexts/email/domain/EmailFolder'

export class EmailMoved implements DomainEvent {
  readonly name = 'email.EmailMoved'
  constructor(
    public readonly aggregateId: string,
    public readonly folder: EmailFolder,
    public readonly occurredAt: Date,
  ) {}
}
