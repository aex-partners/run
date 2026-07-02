import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class TaskSnoozed implements DomainEvent {
  readonly name = 'tasks.TaskSnoozed'
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly snoozedUntil: Date,
    public readonly occurredAt: Date,
  ) {}
}
