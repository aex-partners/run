import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { workflows, workflowExecutions } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";
import { slugify } from "../../db/entity-fields.js";
import { enqueueWorkflowExecution } from "../../queue/workflow-queue.js";
import { registerCronTrigger, unregisterCronTrigger, registerEventTrigger, unregisterEventTrigger } from "../../workflows/triggers.js";

export const workflowsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const allWorkflows = await ctx.db
        .select()
        .from(workflows)
        .orderBy(desc(workflows.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const counts = await ctx.db
        .select({
          workflowId: workflowExecutions.workflowId,
          count: sql<number>`count(*)::int`,
        })
        .from(workflowExecutions)
        .groupBy(workflowExecutions.workflowId);

      const countMap = new Map(counts.map((c) => [c.workflowId, c.count]));

      return allWorkflows.map((w) => ({
        ...w,
        triggerConfig: JSON.parse(w.triggerConfig),
        executionCount: countMap.get(w.id) ?? 0,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [workflow] = await ctx.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.id))
        .limit(1);
      if (!workflow) return null;
      return {
        ...workflow,
        graph: JSON.parse(workflow.graph),
        triggerConfig: JSON.parse(workflow.triggerConfig),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        triggerType: z.enum(["manual", "cron", "event"]).default("manual"),
        triggerConfig: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const slug = slugify(input.name);

      // Default graph with a trigger node
      const defaultGraph = {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 250, y: 50 },
            data: { label: "Trigger" },
          },
        ],
        edges: [],
      };

      const [workflow] = await ctx.db
        .insert(workflows)
        .values({
          id,
          name: input.name,
          slug,
          triggerType: input.triggerType,
          triggerConfig: JSON.stringify(input.triggerConfig ?? {}),
          graph: JSON.stringify(defaultGraph),
          createdBy: ctx.session.user.id,
        })
        .returning();

      broadcast({ type: "workflow_updated" });

      return {
        id: workflow.id,
        name: workflow.name,
        slug: workflow.slug,
        status: workflow.status,
        triggerType: workflow.triggerType,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        status: z.enum(["active", "paused"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.id))
        .limit(1);
      if (!existing) return { error: "Workflow not found" };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) {
        updates.name = input.name;
        updates.slug = slugify(input.name);
      }
      if (input.status) {
        updates.status = input.status;
      }

      await ctx.db
        .update(workflows)
        .set(updates)
        .where(eq(workflows.id, input.id));

      // Handle trigger registration on status change
      if (input.status === "active") {
        const triggerConfig = JSON.parse(existing.triggerConfig);
        if (existing.triggerType === "cron" && triggerConfig.cronExpression) {
          await registerCronTrigger(input.id, triggerConfig.cronExpression);
        } else if (existing.triggerType === "event") {
          registerEventTrigger(input.id, triggerConfig);
        }
      } else if (input.status === "paused") {
        if (existing.triggerType === "cron") {
          await unregisterCronTrigger(input.id);
        } else if (existing.triggerType === "event") {
          unregisterEventTrigger(input.id);
        }
      }

      broadcast({ type: "workflow_updated" });
      return { success: true };
    }),

  saveGraph: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        graph: z.object({
          nodes: z.array(z.any()),
          edges: z.array(z.any()),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(workflows)
        .set({ graph: JSON.stringify(input.graph), updatedAt: new Date() })
        .where(eq(workflows.id, input.id));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.id))
        .limit(1);

      if (existing) {
        if (existing.triggerType === "cron") {
          await unregisterCronTrigger(input.id);
        } else if (existing.triggerType === "event") {
          unregisterEventTrigger(input.id);
        }
      }

      await ctx.db
        .delete(workflows)
        .where(eq(workflows.id, input.id));

      broadcast({ type: "workflow_updated" });
      return { deleted: true };
    }),

  execute: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const executionId = crypto.randomUUID();
      await ctx.db.insert(workflowExecutions).values({
        id: executionId,
        workflowId: input.id,
        triggeredBy: ctx.session.user.id,
      });

      await enqueueWorkflowExecution(executionId);

      broadcast({
        type: "workflow_execution_started",
        executionId,
        workflowId: input.id,
        status: "pending",
      });

      return { executionId };
    }),

  executionHistory: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, input.workflowId))
        .orderBy(desc(workflowExecutions.createdAt))
        .limit(input.limit);
    }),

  setTrigger: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        triggerType: z.enum(["manual", "cron", "event"]),
        triggerConfig: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, input.id))
        .limit(1);
      if (!existing) return { error: "Workflow not found" };

      // Unregister old trigger
      if (existing.triggerType === "cron") {
        await unregisterCronTrigger(input.id);
      } else if (existing.triggerType === "event") {
        unregisterEventTrigger(input.id);
      }

      await ctx.db
        .update(workflows)
        .set({
          triggerType: input.triggerType,
          triggerConfig: JSON.stringify(input.triggerConfig ?? {}),
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, input.id));

      // Register new trigger if workflow is active
      if (existing.status === "active") {
        const config = input.triggerConfig ?? {};
        if (input.triggerType === "cron" && config.cronExpression) {
          await registerCronTrigger(input.id, config.cronExpression as string);
        } else if (input.triggerType === "event") {
          registerEventTrigger(input.id, config);
        }
      }

      broadcast({ type: "workflow_updated" });
      return { success: true };
    }),
});
