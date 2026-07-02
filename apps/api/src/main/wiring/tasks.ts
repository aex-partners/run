// Wiring for the `tasks` context (assigned/automated work items). Three ACL bridges:
// ConversationPoster -> conversations.PostSystemMessage, Notifier ->
// notifications.CreateNotification, and AgentRunner -> assistant RunInference (read
// through the late-bound `ai` holder). Exposes runTask (the BullMQ tasks worker).
import { ok, fail } from '@/shared/kernel/Result'
import { Infra } from '@/main/wiring/infra'
import { ConversationsWiring } from '@/main/wiring/conversations'
import { NotificationsWiring } from '@/main/wiring/notifications'

import { DrizzleTaskRepository } from '@/contexts/tasks/adapters/out/persistence/DrizzleTaskRepository'
import { DrizzleTaskAssigneeRepository } from '@/contexts/tasks/adapters/out/persistence/DrizzleTaskAssigneeRepository'
import { DrizzleTaskLogRepository } from '@/contexts/tasks/adapters/out/persistence/DrizzleTaskLogRepository'
import { DrizzleGetTask } from '@/contexts/tasks/adapters/out/persistence/DrizzleGetTask'
import { DrizzleListTasks } from '@/contexts/tasks/adapters/out/persistence/DrizzleListTasks'
import { DrizzleListTaskLogs } from '@/contexts/tasks/adapters/out/persistence/DrizzleListTaskLogs'
import { DrizzleTaskStats } from '@/contexts/tasks/adapters/out/persistence/DrizzleTaskStats'
import { BullTaskScheduler } from '@/contexts/tasks/adapters/out/queue/BullTaskScheduler'
import { CreateTaskService } from '@/contexts/tasks/application/use-cases/CreateTaskService'
import { CancelTaskService } from '@/contexts/tasks/application/use-cases/CancelTaskService'
import { RetryTaskService } from '@/contexts/tasks/application/use-cases/RetryTaskService'
import { AcknowledgeTaskService } from '@/contexts/tasks/application/use-cases/AcknowledgeTaskService'
import { SnoozeTaskService } from '@/contexts/tasks/application/use-cases/SnoozeTaskService'
import { RunTaskService } from '@/contexts/tasks/application/use-cases/RunTaskService'
import { DEFAULT_TASK_BUDGET } from '@/contexts/tasks/domain/TaskBudget'
import { taskController } from '@/contexts/tasks/adapters/in/http/TaskController'
import { ConversationPoster as TasksConversationPoster } from '@/contexts/tasks/application/ports/out/ConversationPoster'
import { Notifier } from '@/contexts/tasks/application/ports/out/Notifier'
import { AgentRunner } from '@/contexts/tasks/application/ports/out/AgentRunner'
import { RunInference } from '@/contexts/assistant/application/ports/in/RunInference'

type TasksDeps = {
  postSystemMessage: ConversationsWiring['ports']['postSystemMessage']
  createNotification: NotificationsWiring['ports']['createNotification']
  ai: { run: RunInference | undefined }
}

export function wireTasks(infra: Infra, deps: TasksDeps) {
  const { db, events, clock, redisUrl } = infra
  const { postSystemMessage, createNotification, ai } = deps

  const taskRepo = new DrizzleTaskRepository(db)
  const taskAssigneeRepo = new DrizzleTaskAssigneeRepository(db)
  const taskLogRepo = new DrizzleTaskLogRepository(db)
  const getTask = new DrizzleGetTask(db)
  const listTasks = new DrizzleListTasks(db)
  const listTaskLogs = new DrizzleListTaskLogs(db)
  const taskStats = new DrizzleTaskStats(db)
  const taskScheduler = new BullTaskScheduler(redisUrl)
  // ACL bridge: tasks ConversationPoster -> conversations PostSystemMessage.
  const tasksPoster: TasksConversationPoster = {
    post: async (req) => { await postSystemMessage.execute({ conversationId: req.conversationId, content: req.content, role: req.role, authorId: req.userId }) },
  }
  // ACL bridge: tasks Notifier -> notifications CreateNotification.
  const taskNotifier: Notifier = {
    notify: async (req) => { await createNotification.execute({ userId: req.userId, kind: req.kind, title: req.title, body: req.body ?? null, taskId: req.taskId ?? null }) },
  }
  // ACL bridge: tasks AgentRunner -> assistant RunInference. The per-tool budget
  // guard the tasks domain supplies is not threaded through (RunInference enforces
  // its own MutationBudget seeded from maxMutations); the task budget cap is still
  // honored. Cancellation surfaces as a non-cancelled failure string.
  const agentRunner: AgentRunner = {
    runInference: async (req) => {
      if (!ai.run) return fail({ cancelled: false, message: 'AgentRunner not wired' })
      const r = await ai.run.execute({ prompt: req.prompt, maxMutations: 5, budgetKey: req.userId })
      return r.ok ? ok({ text: r.value.text }) : fail({ cancelled: false, message: r.error })
    },
    runStructured: async (req) => {
      if (!ai.run) return fail({ cancelled: false, message: 'AgentRunner not wired' })
      const r = await ai.run.execute({
        prompt: `Call the tool "${req.toolName}" with this input and return its result:\n${req.structuredInput ?? '{}'}`,
        allowedTools: [req.toolName],
        maxMutations: 5,
        budgetKey: req.userId,
      })
      return r.ok ? ok({ text: r.value.text }) : fail({ cancelled: false, message: r.error })
    },
  }
  const createTask = new CreateTaskService(taskRepo, taskAssigneeRepo, taskNotifier, events, clock)
  const cancelTask = new CancelTaskService(taskRepo, taskAssigneeRepo, taskScheduler, events, clock)
  const retryTask = new RetryTaskService(taskRepo, taskAssigneeRepo, taskScheduler, events, clock)
  const acknowledgeTask = new AcknowledgeTaskService(taskRepo, taskAssigneeRepo, taskNotifier, events, clock)
  const snoozeTask = new SnoozeTaskService(taskRepo, taskAssigneeRepo, taskScheduler, events, clock)
  const runTask = new RunTaskService(taskRepo, taskAssigneeRepo, taskLogRepo, agentRunner, taskNotifier, tasksPoster, events, clock, DEFAULT_TASK_BUDGET)
  const tasksCtl = taskController({
    create: createTask, cancel: cancelTask, retry: retryTask, acknowledge: acknowledgeTask,
    snooze: snoozeTask, list: listTasks, get: getTask, logs: listTaskLogs, stats: taskStats,
  })

  return {
    controller: tasksCtl,
    ports: { runTask },
  }
}

export type TasksWiring = ReturnType<typeof wireTasks>
