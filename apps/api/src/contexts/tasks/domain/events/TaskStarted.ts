import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The hexagonal replacement for AEX's `broadcast({ type: 'task_updated', ... })`.
// A WebSocket adapter turns this into a push carrying status/progress/title.
export class TaskStarted implements DomainEvent {
  readonly name = 'tasks.TaskStarted'
  readonly status = 'running' as const
  constructor(
    public readonly aggregateId: string,
    public readonly title: string,
    public readonly progress: number,
    public readonly occurredAt: Date,
  ) {}
}
