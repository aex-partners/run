import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListReminders } from '@/contexts/reminders/application/ports/in/ListReminders'
import { CancelReminder } from '@/contexts/reminders/application/ports/in/CancelReminder'

// Driving adapter (tRPC). Native typed router mirroring the source reminders
// router: list (`.query`) + cancel (`.mutation`). The owner `userId` comes from
// `ctx.user.id`. Holds no logic.
export const reminderController = (deps: { list: ListReminders; cancel: CancelReminder }) =>
  router({
    // Read path goes straight to the query — no domain involved.
    list: protectedProcedure
      .input(
        z
          .object({
            status: z.enum(['scheduled', 'fired', 'cancelled']).optional(),
            limit: z.number().min(1).max(200).default(100),
          })
          .optional()
          .default({}),
      )
      .query(({ ctx, input }) =>
        deps.list.execute({ userId: ctx.user.id, status: input.status, limit: input.limit }),
      ),

    cancel: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.cancel.execute({ reminderId: input.id, userId: ctx.user.id })),
      ),
  })
