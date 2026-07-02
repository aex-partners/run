import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { MarkRead } from '@/contexts/notifications/application/ports/in/MarkRead'
import { MarkAllRead } from '@/contexts/notifications/application/ports/in/MarkAllRead'
import { UpdatePreferences } from '@/contexts/notifications/application/ports/in/UpdatePreferences'
import { ListNotifications } from '@/contexts/notifications/application/queries/ListNotifications'
import { GetUnreadCount } from '@/contexts/notifications/application/queries/GetUnreadCount'
import { GetPreferences } from '@/contexts/notifications/application/queries/GetPreferences'

// Driving adapter (tRPC). Ports the AEX `notificationsRouter` 1:1: same zod
// shapes, same procedure names, reads as `.query` / writes as `.mutation`. Every
// procedure is self-scoped, so the acting user comes from the protected-procedure
// context (`ctx.user.id`, AEX's `ctx.session.user.id`). Holds no logic of its own.
export const notificationController = (deps: {
  list: ListNotifications
  unreadCount: GetUnreadCount
  markRead: MarkRead
  markAllRead: MarkAllRead
  getPreferences: GetPreferences
  updatePreferences: UpdatePreferences
}) =>
  router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(30) }).default({}))
      .query(({ ctx, input }) => deps.list.execute({ userId: ctx.user.id, limit: input.limit })),

    unreadCount: protectedProcedure.query(({ ctx }) =>
      deps.unreadCount.execute({ userId: ctx.user.id }),
    ),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.markRead.execute({ userId: ctx.user.id, id: input.id })),
      ),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) =>
      unwrap(await deps.markAllRead.execute({ userId: ctx.user.id })),
    ),

    getPreferences: protectedProcedure.query(({ ctx }) =>
      deps.getPreferences.execute({ userId: ctx.user.id }),
    ),

    updatePreferences: protectedProcedure
      .input(z.object({ emailDigest: z.boolean() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.updatePreferences.execute({
            userId: ctx.user.id,
            emailDigest: input.emailDigest,
          }),
        ),
      ),
  })
