import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class TaskFailed implements DomainEvent {
  readonly name = 'tasks.TaskFailed'
  readonly status = 'failed' as const
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly progress: number,
    public readonly error: string,
    public readonly occurredAt: Date,
  ) {}
}
