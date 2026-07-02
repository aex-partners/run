import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CancelTask, CancelTaskCommand } from '@/contexts/tasks/application/ports/in/CancelTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Scheduler } from '@/contexts/tasks/application/ports/out/Scheduler'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { canAccessTask } from '@/contexts/tasks/domain/TaskVisibility'

// Application service (AEX `tasks.cancel`). Access-checks, applies the pure cancel
// transition (guards pending|running), drops the still-pending queue job, then
// persists and publishes. The TaskCancelled event replaces AEX's WS broadcast.
export class CancelTaskService implements CancelTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CancelTaskCommand): Promise<Result<{ success: true }>> {
    const taskId = TaskId.of(cmd.id)
    const task = await this.tasks.findById(taskId)
    if (!task) return fail('Task not found')

    const assigneeIds = (await this.assignees.listByTask(taskId)).map((a) => a.userId)
    if (!canAccessTask(task, assigneeIds, cmd.userId)) return fail('Task not found')

    const transition = task.cancel(this.clock.now())
    if (!transition.ok) return fail(transition.error)

    // Best-effort: also drop the BullMQ job so a scheduled-but-not-yet-fired task
    // does not still trigger after we set status=cancelled.
    await this.scheduler.cancel(cmd.id)
    await this.tasks.save(task)
    await this.events.publish(task.pullEvents())

    return ok({ success: true })
  }
}
