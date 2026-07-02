import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Raised the first time a notification is marked read. Lets the badge/unread
// count update reactively without the read side polling.
export class NotificationRead implements DomainEvent {
  readonly name = 'notifications.NotificationRead'
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
