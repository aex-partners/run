import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Raised when a notification is persisted. The real EventPublisher adapter fans
// this out over WebSocket (the AEX `notification_new` push that drives the
// unread badge); here it crosses the same port any other event does.
export class NotificationCreated implements DomainEvent {
  readonly name = 'notifications.NotificationCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly kind: string,
    public readonly taskId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
