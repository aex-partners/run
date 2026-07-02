import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { ApprovalDecision } from '@/contexts/tasks/domain/TaskStatus'

export class TaskApprovalDecided implements DomainEvent {
  readonly name = 'tasks.TaskApprovalDecided'
  constructor(
    public readonly aggregateId: string,
    public readonly decision: ApprovalDecision,
    public readonly occurredAt: Date,
  ) {}
}
