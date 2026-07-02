import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Raised by the TaskAssignee aggregate when one assignee acks. Distinct from the
// task-level TaskAcknowledged (which fires only once EVERY assignee has acked).
export class AssigneeAcknowledged implements DomainEvent {
  readonly name = 'tasks.AssigneeAcknowledged'
  constructor(
    public readonly aggregateId: string,
    public readonly taskId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
