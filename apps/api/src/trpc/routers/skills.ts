import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { skills } from "../../db/schema/index.js";
import { slugify } from "../../db/entity-fields.js";

const skillInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  toolIds: z.array(z.string()).default([]),
  systemToolNames: z.array(z.string()).default([]),
  guardrails: z.object({
    maxSteps: z.number().optional(),
    blockedTools: z.array(z.string()).optional(),
    requireConfirmation: z.boolean().optional(),
  }).default({}),
});

export const skillsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(skills);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [skill] = await ctx.db
        .select()
        .from(skills)
        .where(eq(skills.id, input.id))
        .limit(1);
      return skill ?? null;
    }),

  create: protectedProcedure
    .input(skillInput)
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const slug = slugify(input.name);

      const [created] = await ctx.db
        .insert(skills)
        .values({
          id,
          name: input.name,
          slug,
          description: input.description ?? null,
          systemPrompt: input.systemPrompt,
          toolIds: JSON.stringify(input.toolIds),
          systemToolNames: JSON.stringify(input.systemToolNames),
          guardrails: JSON.stringify(input.guardrails),
          createdBy: ctx.session.user.id,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(skillInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.name !== undefined) {
        setValues.name = updates.name;
        setValues.slug = slugify(updates.name);
      }
      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.systemPrompt !== undefined) setValues.systemPrompt = updates.systemPrompt;
      if (updates.toolIds !== undefined) setValues.toolIds = JSON.stringify(updates.toolIds);
      if (updates.systemToolNames !== undefined) setValues.systemToolNames = JSON.stringify(updates.systemToolNames);
      if (updates.guardrails !== undefined) setValues.guardrails = JSON.stringify(updates.guardrails);

      const [updated] = await ctx.db
        .update(skills)
        .set(setValues)
        .where(eq(skills.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(skills).where(eq(skills.id, input.id));
      return { success: true };
    }),
});
