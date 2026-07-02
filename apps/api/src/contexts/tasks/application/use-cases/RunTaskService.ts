import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RunTask, RunTaskCommand } from '@/contexts/tasks/application/ports/in/RunTask'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { TaskLogRepository } from '@/contexts/tasks/application/ports/out/TaskLogRepository'
import {
  AgentRunner,
  AgentToolGuard,
  AgentRunOutput,
  AgentRunFailure,
} from '@/contexts/tasks/application/ports/out/AgentRunner'
import { Notifier } from '@/contexts/tasks/application/ports/out/Notifier'
import { ConversationPoster } from '@/contexts/tasks/application/ports/out/ConversationPoster'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskLogLevel } from '@/contexts/tasks/domain/TaskStatus'
import { TaskBudget, TaskBudgetLimits } from '@/contexts/tasks/domain/TaskBudget'

// THE IMPERATIVE SHELL of the budgeted runner (decider/shell style, as in
// `automation`'s FlowInterpreter). It owns all the IO; the hard rule — the
// mutation budget — stays in the pure TaskBudget VO, which this shell holds as
// state and charges through the `guard` it injects into the AgentRunner.
//
// Flow (port of AEX task-worker + task-runner):
//   load -> skip if not pending
//        -> surface (post + notify) if reminder/human, stay pending
//        -> else: mark running, run (inference budgeted | structured), then
//           complete | fail | cancel, and report the outcome to chat.
export class RunTaskService implements RunTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly assignees: TaskAssigneeRepository,
    private readonly logs: TaskLogRepository,
    private readonly agent: AgentRunner,
    private readonly notifier: Notifier,
    private readonly poster: ConversationPoster,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
    private readonly limits: TaskBudgetLimits,
  ) {}

  async execute(cmd: RunTaskCommand): Promise<Result<{ ran: boolean }>> {
    const task = await this.tasks.findById(TaskId.of(cmd.taskId))
    if (!task) return ok({ ran: false })
    if (task.status !== 'pending') return ok({ ran: false })

    // Human-facing reminders/tasks are surfaced, not executed by the AI runner.
    // They stay `pending` (open) until the assignee acks on the board.
    if (task.kind.value === 'reminder' || task.executor.value === 'human') {
      await this.surface(task)
      return ok({ ran: false })
    }

    const started = task.start(this.clock.now())
    if (!started.ok) return ok({ ran: false })
    await this.tasks.save(task)
    await this.events.publish(task.pullEvents())

    if (task.type.value === 'structured') return this.runStructured(task)
    return this.runInference(task)
  }

  // AEX `fireReminderTask`: surface the reminder (system message into the bound
  // conversation, if any) and raise a `reminder_fired` notification per assignee.
  private async surface(task: Task): Promise<void> {
    if (task.conversationId) {
      await this.poster.post({
        conversationId: task.conversationId,
        userId: task.createdBy,
        role: 'system',
        content: `Reminder: ${task.title}`,
        metadata: { reminder: { taskId: task.id.value, title: task.title } },
      })
    }
    const assignees = await this.assignees.listByTask(task.id)
    for (const a of assignees) {
      await this.notifier.notify({ userId: a.userId, kind: 'reminder_fired', title: task.title, taskId: task.id.value })
    }
  }

  // The budget-enforced agentic path. A mutable TaskBudget lives here; the guard
  // closure charges it (PURE) per non-readonly tool and writes the audit log.
  private async runInference(task: Task): Promise<Result<{ ran: boolean }>> {
    if (!task.input || !task.input.trim()) {
      return this.failTask(task, 'Inference task requires a non-empty input prompt')
    }
    if (!task.conversationId) {
      return this.failTask(task, 'Inference task requires a conversation_id so the result has somewhere to land')
    }

    let budget = TaskBudget.fromLimits(this.limits)

    await this.log(task, 'info', 'scheduled task starting', {
      conversationId: task.conversationId,
      prompt: task.input,
    })

    const guard: AgentToolGuard = async (req) => {
      if (req.toolClass === 'readonly') return { behavior: 'allow' }
      const decision = budget.charge(req.toolClass)
      if (!decision.allowed) {
        await this.log(task, 'warn', `denied ${req.toolName}: ${decision.denied} budget exhausted`, { input: req.input })
        return { behavior: 'deny', message: decision.reason }
      }
      budget = decision.budget
      await this.log(task, 'step', `allowed ${req.toolName}`, { input: req.input })
      return { behavior: 'allow' }
    }

    const run = await this.agent.runInference({
      taskId: task.id.value,
      prompt: task.input,
      conversationId: task.conversationId,
      userId: task.createdBy,
      agentId: task.agentId,
      guard,
    })

    return this.finish(task, run, budget)
  }

  // Deterministic single-tool execution (no model, no budget).
  private async runStructured(task: Task): Promise<Result<{ ran: boolean }>> {
    if (!task.toolName) return this.failTask(task, 'structured task requires a toolName')

    const run = await this.agent.runStructured({
      taskId: task.id.value,
      toolName: task.toolName,
      structuredInput: task.structuredInput,
      conversationId: task.conversationId,
      userId: task.createdBy,
    })

    return this.finish(task, run, null)
  }

  // Shared completion handling for both run paths. Mirrors AEX task-worker's
  // try/catch: success -> completed + report summary; cancelled -> cancelled,
  // silent; failure -> failed + report failure message.
  private async finish(
    task: Task,
    run: Result<AgentRunOutput, AgentRunFailure>,
    budget: TaskBudget | null,
  ): Promise<Result<{ ran: boolean }>> {
    if (!run.ok) {
      if (run.error.cancelled) {
        const transition = task.cancelDuringRun(this.clock.now())
        if (transition.ok) {
          await this.tasks.save(task)
          await this.events.publish(task.pullEvents())
        }
        return ok({ ran: true })
      }
      return this.failTask(task, run.error.message)
    }

    const text = run.value.text
    if (budget) {
      await this.log(task, 'info', 'scheduled task finished', {
        mutationsUsed: budget.used.mutations,
        deletesUsed: budget.used.deletes,
        emailsUsed: budget.used.emails,
        textLength: text.length,
      })
    }

    const result = text.trim() || '(scheduled task finished with no text output)'
    const completed = task.complete(result, this.clock.now())
    if (!completed.ok) return ok({ ran: true })
    await this.tasks.save(task)
    await this.events.publish(task.pullEvents())

    if (task.conversationId) {
      const summary = result.length > 500 ? result.slice(0, 500) + '...' : result
      await this.poster.post({
        conversationId: task.conversationId,
        userId: task.createdBy,
        role: 'ai',
        content: summary,
      })
    }

    return ok({ ran: true })
  }

  private async failTask(task: Task, error: string): Promise<Result<{ ran: boolean }>> {
    const transition = task.fail(error, this.clock.now())
    if (transition.ok) {
      await this.tasks.save(task)
      await this.events.publish(task.pullEvents())
    }
    if (task.conversationId) {
      await this.poster.post({
        conversationId: task.conversationId,
        userId: task.createdBy,
        role: 'ai',
        content: `The task "${task.title}" failed. Please try again or contact support.`,
      })
    }
    return ok({ ran: true })
  }

  // Append-only audit log. Best-effort: a logging fault must never break task
  // execution (the adapter swallows it), so this never rejects.
  private async log(
    task: Task,
    level: TaskLogLevel,
    message: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    const log = TaskLog.create(this.logs.nextId(), task.id, level, message, metadata, this.clock.now())
    await this.logs.append(log)
  }
}
