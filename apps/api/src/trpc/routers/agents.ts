import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { agents } from "../../db/schema/index.js";
import { slugify } from "../../db/entity-fields.js";

const agentInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  avatar: z.string().optional(),
  systemPrompt: z.string().min(1),
  modelId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
  internetAccess: z.boolean().default(false),
});

export const agentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(agents);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      return agent ?? null;
    }),

  create: protectedProcedure
    .input(agentInput)
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const slug = slugify(input.name);

      const [created] = await ctx.db
        .insert(agents)
        .values({
          id,
          name: input.name,
          slug,
          description: input.description ?? null,
          avatar: input.avatar ?? null,
          systemPrompt: input.systemPrompt,
          modelId: input.modelId ?? null,
          skillIds: JSON.stringify(input.skillIds),
          toolIds: JSON.stringify(input.toolIds),
          internetAccess: input.internetAccess,
          createdBy: ctx.session.user.id,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(agentInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.name !== undefined) {
        setValues.name = updates.name;
        setValues.slug = slugify(updates.name);
      }
      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.avatar !== undefined) setValues.avatar = updates.avatar;
      if (updates.systemPrompt !== undefined) setValues.systemPrompt = updates.systemPrompt;
      if (updates.modelId !== undefined) setValues.modelId = updates.modelId;
      if (updates.skillIds !== undefined) setValues.skillIds = JSON.stringify(updates.skillIds);
      if (updates.toolIds !== undefined) setValues.toolIds = JSON.stringify(updates.toolIds);
      if (updates.internetAccess !== undefined) setValues.internetAccess = updates.internetAccess;

      const [updated] = await ctx.db
        .update(agents)
        .set(setValues)
        .where(eq(agents.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select({ isSystem: agents.isSystem })
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);

      if (agent?.isSystem) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete system agent" });
      }

      await ctx.db.delete(agents).where(eq(agents.id, input.id));
      return { success: true };
    }),
});
