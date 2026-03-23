import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { flows, flowVersions, flowRuns, flowFolders } from "../../db/schema/index.js";
import { enqueueFlowRun } from "../../queue/flow-queue.js";
import { enableTrigger, disableTrigger } from "../../flow-engine/trigger-lifecycle.js";

export const flowsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const allFlows = await ctx.db.select().from(flows);
    // Attach latest version name and run count
    const result = await Promise.all(
      allFlows.map(async (f) => {
        const [latestVersion] = await ctx.db
          .select({ displayName: flowVersions.displayName })
          .from(flowVersions)
          .where(eq(flowVersions.flowId, f.id))
          .orderBy(desc(flowVersions.createdAt))
          .limit(1);

        return {
          ...f,
          displayName: latestVersion?.displayName ?? "Untitled Flow",
        };
      }),
    );
    return result;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [flow] = await ctx.db.select().from(flows).where(eq(flows.id, input.id)).limit(1);
      if (!flow) throw new TRPCError({ code: "NOT_FOUND" });

      const versions = await ctx.db
        .select()
        .from(flowVersions)
        .where(eq(flowVersions.flowId, input.id))
        .orderBy(desc(flowVersions.createdAt));

      return { ...flow, versions };
    }),

  create: protectedProcedure
    .input(z.object({
      displayName: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const flowId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const now = new Date();

      // Create flow
      await ctx.db.insert(flows).values({
        id: flowId,
        status: "disabled",
        createdBy: ctx.session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      // Create initial draft version with empty trigger
      const defaultTrigger = JSON.stringify({
        name: "trigger",
        displayName: "Trigger",
        type: "EMPTY",
        valid: true,
        settings: {},
      });

      await ctx.db.insert(flowVersions).values({
        id: versionId,
        flowId,
        displayName: input.displayName,
        trigger: defaultTrigger,
        state: "draft",
        valid: false,
        createdAt: now,
        updatedAt: now,
      });

      return { id: flowId, versionId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["enabled", "disabled"]).optional(),
      folderId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.status !== undefined) updates.status = input.status;
      if (input.folderId !== undefined) updates.folderId = input.folderId;

      await ctx.db.update(flows).set(updates).where(eq(flows.id, input.id));

      // Manage trigger lifecycle on status change
      if (input.status === "enabled") {
        await enableTrigger(input.id, ctx.db);
      } else if (input.status === "disabled") {
        await disableTrigger(input.id, ctx.db);
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(flows).where(eq(flows.id, input.id));
      return { success: true };
    }),

  // --- Versions ---

  saveVersion: protectedProcedure
    .input(z.object({
      flowId: z.string(),
      displayName: z.string().min(1),
      trigger: z.string(), // JSON stringified FlowTrigger
    }))
    .mutation(async ({ ctx, input }) => {
      // Find existing draft version
      const [existingDraft] = await ctx.db
        .select()
        .from(flowVersions)
        .where(and(eq(flowVersions.flowId, input.flowId), eq(flowVersions.state, "draft")))
        .limit(1);

      if (existingDraft) {
        // Update existing draft
        await ctx.db
          .update(flowVersions)
          .set({
            displayName: input.displayName,
            trigger: input.trigger,
            updatedAt: new Date(),
          })
          .where(eq(flowVersions.id, existingDraft.id));
        return { versionId: existingDraft.id };
      }

      // Create new draft version
      const versionId = crypto.randomUUID();
      await ctx.db.insert(flowVersions).values({
        id: versionId,
        flowId: input.flowId,
        displayName: input.displayName,
        trigger: input.trigger,
        state: "draft",
        valid: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { versionId };
    }),

  publish: protectedProcedure
    .input(z.object({ flowId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Lock the version
      await ctx.db
        .update(flowVersions)
        .set({ state: "locked", valid: true, updatedAt: new Date() })
        .where(eq(flowVersions.id, input.versionId));

      // Set as published version
      await ctx.db
        .update(flows)
        .set({ publishedVersionId: input.versionId, updatedAt: new Date() })
        .where(eq(flows.id, input.flowId));

      return { success: true };
    }),

  listVersions: protectedProcedure
    .input(z.object({ flowId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(flowVersions)
        .where(eq(flowVersions.flowId, input.flowId))
        .orderBy(desc(flowVersions.createdAt));
    }),

  // --- Execution ---

  execute: protectedProcedure
    .input(z.object({
      flowId: z.string(),
      triggerPayload: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get published or latest version
      const [flow] = await ctx.db.select().from(flows).where(eq(flows.id, input.flowId)).limit(1);
      if (!flow) throw new TRPCError({ code: "NOT_FOUND" });

      let versionId = flow.publishedVersionId;
      if (!versionId) {
        // Try latest version
        const [latest] = await ctx.db
          .select()
          .from(flowVersions)
          .where(eq(flowVersions.flowId, input.flowId))
          .orderBy(desc(flowVersions.createdAt))
          .limit(1);
        if (!latest) throw new TRPCError({ code: "BAD_REQUEST", message: "Flow has no versions" });
        versionId = latest.id;
      }

      const runId = crypto.randomUUID();
      await ctx.db.insert(flowRuns).values({
        id: runId,
        flowId: input.flowId,
        flowVersionId: versionId,
        status: "pending",
        triggeredBy: ctx.session.user.id,
        triggerPayload: input.triggerPayload ? JSON.stringify(input.triggerPayload) : null,
        createdAt: new Date(),
      });

      await enqueueFlowRun(runId);

      return { runId };
    }),

  listRuns: protectedProcedure
    .input(z.object({
      flowId: z.string().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db.select().from(flowRuns);
      if (input.flowId) {
        query = query.where(eq(flowRuns.flowId, input.flowId)) as typeof query;
      }
      return query.orderBy(desc(flowRuns.createdAt)).limit(input.limit ?? 50);
    }),

  getRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db.select().from(flowRuns).where(eq(flowRuns.id, input.runId)).limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ...run,
        steps: run.steps ? JSON.parse(run.steps) : {},
      };
    }),

  // --- Folders ---

  listFolders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(flowFolders).orderBy(flowFolders.displayOrder);
  }),

  createFolder: protectedProcedure
    .input(z.object({ displayName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      await ctx.db.insert(flowFolders).values({
        id,
        displayName: input.displayName,
        createdAt: new Date(),
      });
      return { id };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(flowFolders).where(eq(flowFolders.id, input.id));
      return { success: true };
    }),

  renameFolder: protectedProcedure
    .input(z.object({ id: z.string(), displayName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [folder] = await ctx.db
        .select()
        .from(flowFolders)
        .where(eq(flowFolders.id, input.id))
        .limit(1);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(flowFolders)
        .set({ displayName: input.displayName })
        .where(eq(flowFolders.id, input.id));
      return { success: true };
    }),

  reorderFolders: protectedProcedure
    .input(z.object({ folderIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.folderIds.map((id, index) =>
          ctx.db
            .update(flowFolders)
            .set({ displayOrder: index })
            .where(eq(flowFolders.id, id)),
        ),
      );
      return { success: true };
    }),

  moveFlow: protectedProcedure
    .input(z.object({
      flowId: z.string(),
      folderId: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [flow] = await ctx.db
        .select()
        .from(flows)
        .where(eq(flows.id, input.flowId))
        .limit(1);
      if (!flow) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.folderId !== null) {
        const [folder] = await ctx.db
          .select()
          .from(flowFolders)
          .where(eq(flowFolders.id, input.folderId))
          .limit(1);
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      }

      await ctx.db
        .update(flows)
        .set({ folderId: input.folderId, updatedAt: new Date() })
        .where(eq(flows.id, input.flowId));
      return { success: true };
    }),

  restoreVersion: protectedProcedure
    .input(z.object({
      flowId: z.string(),
      versionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the flow exists
      const [flow] = await ctx.db
        .select()
        .from(flows)
        .where(eq(flows.id, input.flowId))
        .limit(1);
      if (!flow) throw new TRPCError({ code: "NOT_FOUND", message: "Flow not found" });

      // Verify the source version exists and belongs to this flow
      const [sourceVersion] = await ctx.db
        .select()
        .from(flowVersions)
        .where(
          and(
            eq(flowVersions.id, input.versionId),
            eq(flowVersions.flowId, input.flowId),
          ),
        )
        .limit(1);
      if (!sourceVersion) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      if (sourceVersion.state !== "locked") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can only restore from a locked version" });
      }

      // Delete any existing draft before creating a new one
      await ctx.db
        .delete(flowVersions)
        .where(and(eq(flowVersions.flowId, input.flowId), eq(flowVersions.state, "draft")));

      // Create a new draft version cloned from the locked version
      const newVersionId = crypto.randomUUID();
      const now = new Date();
      await ctx.db.insert(flowVersions).values({
        id: newVersionId,
        flowId: input.flowId,
        displayName: sourceVersion.displayName,
        trigger: sourceVersion.trigger,
        state: "draft",
        valid: false,
        schemaVersion: sourceVersion.schemaVersion,
        createdAt: now,
        updatedAt: now,
      });

      return { versionId: newVersionId };
    }),
});
