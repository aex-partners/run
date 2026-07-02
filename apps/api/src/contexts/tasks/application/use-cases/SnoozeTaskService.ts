import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SnoozeTask, SnoozeTaskCommand } from '@/contexts/tasks/application/ports/in/SnoozeTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Scheduler } from '@/contexts/tasks/application/ports/out/Scheduler'
import { TaskId } from '@/contexts/tasks/domain/ids'

// Application service (AEX `tasks.snooze`). Snoozes both this assignee's view and
// the task itself (snoozedUntil + scheduledAt mirror), then re-schedules the
// queue job to fire at the snooze target: drop the pending job, re-enqueue at
// `until`.
export class SnoozeTaskService implements SnoozeTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SnoozeTaskCommand): Promise<Result<{ success: true; until: string }>> {
    const taskId = TaskId.of(cmd.id)
    const assignment = await this.assignees.findOne(taskId, cmd.userId)
    if (!assignment) return fail('Not an assignee')

    const until = new Date(cmd.until)
    assignment.snooze(until)
    await this.assignees.save(assignment)

    const task = await this.tasks.findById(taskId)
    if (!task) return fail('Task not found')
    const transition = task.snooze(until, this.clock.now())
    if (!transition.ok) return fail(transition.error)
    await this.tasks.save(task)
    await this.events.publish(task.pullEvents())

    // Drop any pending fire job, then re-enqueue at the snooze target.
    await this.scheduler.cancel(cmd.id)
    await this.scheduler.schedule(cmd.id, until)

    return ok({ success: true, until: until.toISOString() })
  }
}
