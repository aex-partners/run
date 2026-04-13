import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { reminders } from "../../db/schema/index.js";
import { cancelReminderJob } from "../../queue/reminder-queue.js";

export const remindersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["scheduled", "fired", "cancelled"]).optional(),
        limit: z.number().min(1).max(200).default(100),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const filter = input.status
        ? and(eq(reminders.userId, ctx.session.user.id), eq(reminders.status, input.status))
        : eq(reminders.userId, ctx.session.user.id);

      // Scheduled first (asc by fire time) so the next-to-fire is on top.
      // Anything else sorted by created date desc (most recent first).
      const order = input.status === "scheduled"
        ? asc(reminders.scheduledFor)
        : desc(reminders.createdAt);

      return ctx.db
        .select()
        .from(reminders)
        .where(filter)
        .orderBy(order)
        .limit(input.limit);
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(reminders)
        .where(and(eq(reminders.id, input.id), eq(reminders.userId, ctx.session.user.id)))
        .limit(1);
      if (!row) return { error: "Reminder not found" };
      if (row.status !== "scheduled") return { error: `Already ${row.status}` };

      await cancelReminderJob(input.id);
      await ctx.db
        .update(reminders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(reminders.id, input.id));

      return { success: true };
    }),
});
