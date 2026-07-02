import { router, publicProcedure, unwrap } from '@/platform/http/trpc'
import { GetSession } from '@/contexts/identity/application/ports/in/GetSession'

// Driving adapter (tRPC). Mirrors the source `auth` router: a single public
// `me` query returning the current user or null. The session id is resolved into
// ctx.user by the better-auth adapter before the procedure runs.
export const authController = (deps: { getSession: GetSession }) =>
  router({
    me: publicProcedure.query(async ({ ctx }) =>
      unwrap(await deps.getSession.execute({ userId: ctx.user?.id ?? null })),
    ),
  })
