import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class TaskCancelled implements DomainEvent {
  readonly name = 'tasks.TaskCancelled'
  readonly status = 'cancelled' as const
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly progress: number,
    public readonly occurredAt: Date,
  ) {}
}
