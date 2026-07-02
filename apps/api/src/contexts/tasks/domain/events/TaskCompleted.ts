import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class TaskCompleted implements DomainEvent {
  readonly name = 'tasks.TaskCompleted'
  readonly status = 'completed' as const
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly progress: number,
    public readonly occurredAt: Date,
  ) {}
}
