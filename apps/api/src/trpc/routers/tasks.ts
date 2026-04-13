import { z } from "zod";
import { and, eq, isNotNull, desc, asc, gt, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { tasks, taskLogs } from "../../db/schema/index.js";
import { enqueueTask, cancelTaskJob } from "../../queue/task-queue.js";
import { broadcast } from "../../ws/index.js";

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
        scheduledOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.status) conditions.push(eq(tasks.status, input.status));
      if (input.scheduledOnly) {
        conditions.push(eq(tasks.status, "pending"));
        conditions.push(isNotNull(tasks.scheduledAt));
        conditions.push(gt(tasks.scheduledAt, new Date()));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const order = input.scheduledOnly ? asc(tasks.scheduledAt) : desc(tasks.createdAt);

      const q = ctx.db.select().from(tasks);
      return where
        ? q.where(where).orderBy(order).limit(input.limit).offset(input.offset)
        : q.orderBy(order).limit(input.limit).offset(input.offset);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);
      return task ?? null;
    }),

  getLogs: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        limit: z.number().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(taskLogs)
        .where(eq(taskLogs.taskId, input.taskId))
        .orderBy(asc(taskLogs.createdAt))
        .limit(input.limit);
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!task) return { error: "Task not found" };
      if (task.status !== "pending" && task.status !== "running") {
        return { error: `Cannot cancel task with status: ${task.status}` };
      }

      // Best-effort: also drop the BullMQ job so a scheduled-but-not-yet-fired
      // task does not still trigger after we set status=cancelled.
      try { await cancelTaskJob(input.id); } catch { /* job may already be gone */ }
      await ctx.db
        .update(tasks)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(eq(tasks.id, input.id));

      broadcast({
        type: "task_updated",
        task: { id: input.id, status: "cancelled", progress: task.progress, title: task.title },
      });

      return { success: true };
    }),

  retry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [original] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!original) return { error: "Task not found" };

      const newId = crypto.randomUUID();
      const [newTask] = await ctx.db
        .insert(tasks)
        .values({
          id: newId,
          title: original.title,
          description: original.description,
          input: original.input,
          createdBy: ctx.session.user.id,
          conversationId: original.conversationId,
          type: original.type,
          agentId: original.agentId,
          toolName: original.toolName,
          inputSchema: original.inputSchema,
          outputSchema: original.outputSchema,
          structuredInput: original.structuredInput,
        })
        .returning();

      await enqueueTask(newTask.id);

      broadcast({
        type: "task_updated",
        task: { id: newTask.id, status: "pending", progress: 0, title: newTask.title },
      });

      return { id: newTask.id };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today
      FROM tasks
    `);

    return {
      running: Number(result.running) || 0,
      pending: Number(result.pending) || 0,
      failed: Number(result.failed) || 0,
      completedToday: Number(result.completed_today) || 0,
    };
  }),
});
