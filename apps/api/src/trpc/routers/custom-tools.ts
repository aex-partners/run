import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { customTools } from "../../db/schema/index.js";
import { buildCustomTool } from "../../ai/tool-registry.js";

const customToolInput = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase with underscores"),
  description: z.string().min(1),
  inputSchema: z.string().min(2),
  outputSchema: z.string().nullable().optional(),
  type: z.enum(["http", "query", "code", "composite"]),
  config: z.string().default("{}"),
  isReadOnly: z.boolean().default(false),
  integrationId: z.string().nullable().optional(),
});

export const customToolsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(customTools);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [tool] = await ctx.db
        .select()
        .from(customTools)
        .where(eq(customTools.id, input.id))
        .limit(1);
      return tool ?? null;
    }),

  create: protectedProcedure
    .input(customToolInput)
    .mutation(async ({ ctx, input }) => {
      // Validate JSON schemas
      try {
        JSON.parse(input.inputSchema);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid inputSchema JSON" });
      }
      if (input.outputSchema) {
        try {
          JSON.parse(input.outputSchema);
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid outputSchema JSON" });
        }
      }
      try {
        JSON.parse(input.config);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid config JSON" });
      }

      const id = crypto.randomUUID();
      const [created] = await ctx.db
        .insert(customTools)
        .values({
          id,
          name: input.name,
          description: input.description,
          inputSchema: input.inputSchema,
          outputSchema: input.outputSchema ?? null,
          type: input.type,
          config: input.config,
          isReadOnly: input.isReadOnly,
          integrationId: input.integrationId ?? null,
          createdBy: ctx.session.user.id,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(customToolInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      if (updates.inputSchema) {
        try { JSON.parse(updates.inputSchema); } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid inputSchema JSON" });
        }
      }
      if (updates.config) {
        try { JSON.parse(updates.config); } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid config JSON" });
        }
      }

      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) setValues.name = updates.name;
      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.inputSchema !== undefined) setValues.inputSchema = updates.inputSchema;
      if (updates.outputSchema !== undefined) setValues.outputSchema = updates.outputSchema;
      if (updates.type !== undefined) setValues.type = updates.type;
      if (updates.config !== undefined) setValues.config = updates.config;
      if (updates.isReadOnly !== undefined) setValues.isReadOnly = updates.isReadOnly;
      if (updates.integrationId !== undefined) setValues.integrationId = updates.integrationId;

      const [updated] = await ctx.db
        .update(customTools)
        .set(setValues)
        .where(eq(customTools.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(customTools).where(eq(customTools.id, input.id));
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({
      id: z.string(),
      testInput: z.record(z.unknown()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      const [toolRow] = await ctx.db
        .select()
        .from(customTools)
        .where(eq(customTools.id, input.id))
        .limit(1);

      if (!toolRow) throw new TRPCError({ code: "NOT_FOUND" });

      const toolCtx = { db: ctx.db, userId: ctx.session.user.id };
      const builtTool = buildCustomTool(toolRow, toolCtx);

      try {
        const result = await (builtTool as any).execute(input.testInput, {
          toolCallId: crypto.randomUUID(),
        });
        return { success: true, result };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
});
