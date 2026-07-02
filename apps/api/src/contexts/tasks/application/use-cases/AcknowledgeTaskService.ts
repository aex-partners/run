import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  AcknowledgeTask,
  AcknowledgeTaskCommand,
} from '@/contexts/tasks/application/ports/in/AcknowledgeTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Notifier } from '@/contexts/tasks/application/ports/out/Notifier'
import { TaskId } from '@/contexts/tasks/domain/ids'

// Application service (AEX `tasks.acknowledge`). The acting user acks their own
// assignment; if that was the LAST outstanding ack the task itself flips to
// `acknowledged`. The creator is notified (unless they acked their own task).
export class AcknowledgeTaskService implements AcknowledgeTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly notifier: Notifier,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AcknowledgeTaskCommand): Promise<Result<{ success: true; allAcked: boolean }>> {
    const taskId = TaskId.of(cmd.id)
    const assignment = await this.assignees.findOne(taskId, cmd.userId)
    if (!assignment) return fail('Not an assignee')

    const now = this.clock.now()
    const acked = assignment.acknowledge(now)
    if (!acked.ok) return fail(acked.error)
    await this.assignees.save(assignment)
    await this.events.publish(assignment.pullEvents())

    // "Fully acknowledged" = every assignee acked (this user counts as acked now).
    const all = await this.assignees.listByTask(taskId)
    const allAcked = all.every((a) => a.isAcknowledged() || a.userId === cmd.userId)

    const task = await this.tasks.findById(taskId)
    if (task && allAcked) {
      const transition = task.acknowledge(now)
      if (transition.ok) {
        await this.tasks.save(task)
        await this.events.publish(task.pullEvents())
      }
    }

    if (task && task.createdBy !== cmd.userId) {
      await this.notifier.notify({
        userId: task.createdBy,
        kind: 'task_acknowledged',
        title: task.title,
        taskId: task.id.value,
      })
    }

    return ok({ success: true, allAcked })
  }
}
