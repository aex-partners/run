import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateTask, CreateTaskCommand } from '@/contexts/tasks/application/ports/in/CreateTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { Notifier } from '@/contexts/tasks/application/ports/out/Notifier'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

// Application service (AEX `tasks.create`). Builds a human-owned task, assigns it
// to the (deduped) users, persists, and raises a per-assignee notification
// (approval_requested for approval tasks, otherwise task_assigned). The rules
// (non-empty title, valid kind) live in the VO/aggregate; this only orchestrates.
export class CreateTaskService implements CreateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly notifier: Notifier,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateTaskCommand): Promise<Result<{ id: string }>> {
    const kind = TaskKind.of(cmd.kind ?? 'task')
    if (!kind.ok) return fail(kind.error)

    const now = this.clock.now()
    const id = this.tasks.nextId()
    const task = Task.create({
      id,
      title: cmd.title,
      description: cmd.description ?? null,
      kind: kind.value,
      executor: TaskExecutor.human(),
      type: TaskType.inference(),
      createdBy: cmd.createdBy,
      conversationId: cmd.conversationId ?? null,
      input: null,
      dueAt: cmd.dueAt ? new Date(cmd.dueAt) : null,
      parentTaskId: null,
      agentId: null,
      toolName: null,
      inputSchema: null,
      outputSchema: null,
      structuredInput: null,
      now,
    })
    if (!task.ok) return fail(task.error)

    const uniqueAssignees = [...new Set(cmd.assigneeIds)]
    const assignees = uniqueAssignees.map((userId) => TaskAssignee.create(id.value, userId, now))

    await this.tasks.save(task.value)
    await this.assignees.saveAll(assignees)
    await this.events.publish(task.value.pullEvents())

    const notifyKind = kind.value.value === 'approval' ? 'approval_requested' : 'task_assigned'
    for (const userId of uniqueAssignees) {
      await this.notifier.notify({ userId, kind: notifyKind, title: cmd.title, taskId: id.value })
    }

    return ok({ id: id.value })
  }
}
