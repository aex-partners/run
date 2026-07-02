import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class TaskAcknowledged implements DomainEvent {
  readonly name = 'tasks.TaskAcknowledged'
  readonly status = 'acknowledged' as const
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly progress: number,
    public readonly occurredAt: Date,
  ) {}
}
