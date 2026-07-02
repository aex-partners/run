import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { TaskKindValue } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutorValue } from '@/contexts/tasks/domain/TaskExecutor'

export class TaskCreated implements DomainEvent {
  readonly name = 'tasks.TaskCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly kind: TaskKindValue,
    public readonly executor: TaskExecutorValue,
    public readonly createdBy: string,
    public readonly occurredAt: Date,
  ) {}
}
