import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CreateTask } from '@/contexts/tasks/application/ports/in/CreateTask'
import { CancelTask } from '@/contexts/tasks/application/ports/in/CancelTask'
import { RetryTask } from '@/contexts/tasks/application/ports/in/RetryTask'
import { AcknowledgeTask } from '@/contexts/tasks/application/ports/in/AcknowledgeTask'
import { SnoozeTask } from '@/contexts/tasks/application/ports/in/SnoozeTask'
import { ListTasks } from '@/contexts/tasks/application/queries/ListTasks'
import { GetTask } from '@/contexts/tasks/application/queries/GetTask'
import { ListTaskLogs } from '@/contexts/tasks/application/queries/ListTaskLogs'
import { TaskStats } from '@/contexts/tasks/application/queries/TaskStats'

// Driving adapter (HTTP/tRPC). Mirrors AEX's 9-procedure tasks router. Validates/
// shapes input, calls the in-port/query, unwraps Result into a value or an error.
// Holds no logic. The acting user (`userId`) is read from the authenticated ctx.
export const taskController = (deps: {
  create: CreateTask
  cancel: CancelTask
  retry: RetryTask
  acknowledge: AcknowledgeTask
  snooze: SnoozeTask
  list: ListTasks
  get: GetTask
  logs: ListTaskLogs
  stats: TaskStats
}) =>
  router({
    // --- mutations ---
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          assigneeIds: z.array(z.string()).min(1),
          kind: z.enum(['task', 'reminder', 'approval']).default('task'),
          dueAt: z.string().datetime().optional(),
          conversationId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.create.execute({
            createdBy: ctx.user.id,
            title: input.title,
            description: input.description,
            assigneeIds: input.assigneeIds,
            kind: input.kind,
            dueAt: input.dueAt,
            conversationId: input.conversationId,
          }),
        ),
      ),

    cancel: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => unwrap(await deps.cancel.execute({ userId: ctx.user.id, id: input.id }))),

    retry: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => unwrap(await deps.retry.execute({ userId: ctx.user.id, id: input.id }))),

    acknowledge: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.acknowledge.execute({ userId: ctx.user.id, id: input.id })),
      ),

    snooze: protectedProcedure
      .input(z.object({ id: z.string(), until: z.string().datetime() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.snooze.execute({ userId: ctx.user.id, id: input.id, until: input.until })),
      ),

    // --- read paths go straight to the queries — no domain involved ---
    list: protectedProcedure
      .input(
        z
          .object({
            status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'acknowledged']).optional(),
            scheduledOnly: z.boolean().optional(),
            limit: z.number().min(1).max(100).default(50),
            offset: z.number().min(0).default(0),
          })
          .default({}),
      )
      .query(({ ctx, input }) =>
        deps.list.execute({
          userId: ctx.user.id,
          status: input.status,
          scheduledOnly: input.scheduledOnly,
          limit: input.limit,
          offset: input.offset,
        }),
      ),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ ctx, input }) => deps.get.execute({ userId: ctx.user.id, id: input.id })),

    getLogs: protectedProcedure
      .input(z.object({ taskId: z.string(), limit: z.number().min(1).max(200).default(100) }))
      .query(({ ctx, input }) =>
        deps.logs.execute({ userId: ctx.user.id, taskId: input.taskId, limit: input.limit }),
      ),

    stats: protectedProcedure.query(({ ctx }) => deps.stats.execute({ userId: ctx.user.id })),
  })
