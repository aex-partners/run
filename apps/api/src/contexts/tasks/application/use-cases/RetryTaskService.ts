import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RetryTask, RetryTaskCommand } from '@/contexts/tasks/application/ports/in/RetryTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Scheduler } from '@/contexts/tasks/application/ports/out/Scheduler'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { canAccessTask } from '@/contexts/tasks/domain/TaskVisibility'

// Application service (AEX `tasks.retry`). Clones the original into a new pending
// task owned by the retrier, persists it, and enqueues it immediately (delay 0).
export class RetryTaskService implements RetryTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RetryTaskCommand): Promise<Result<{ id: string }>> {
    const original = await this.tasks.findById(TaskId.of(cmd.id))
    if (!original) return fail('Task not found')

    const assigneeIds = (await this.assignees.listByTask(TaskId.of(cmd.id))).map((a) => a.userId)
    if (!canAccessTask(original, assigneeIds, cmd.userId)) return fail('Task not found')

    const now = this.clock.now()
    const newId = this.tasks.nextId()
    const clone = Task.createFrom(original, newId, cmd.userId, now)
    if (!clone.ok) return fail(clone.error)

    await this.tasks.save(clone.value)
    await this.scheduler.schedule(newId.value, now)
    await this.events.publish(clone.value.pullEvents())

    return ok({ id: newId.value })
  }
}
