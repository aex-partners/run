import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '@/platform/http/trpc'
import { ListAuditEntries } from '@/contexts/audit/application/ports/in/ListAuditEntries'

// Admin/owner guard, mirroring AEX's adminProcedure.
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx })
})

// Driving adapter (tRPC). Validates/parses input, calls the in-port. Holds no
// logic. Wire the returned router under `auditLog` in the root tRPC router.
export const auditController = (deps: { list: ListAuditEntries }) =>
  router({
    list: adminProcedure
      .input(
        z
          .object({
            action: z.string().optional(),
            resourceType: z.string().optional(),
            actorId: z.string().optional(),
            before: z.coerce.date().optional(),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .default({}),
      )
      .query(({ input }) => deps.list.execute(input)),
  })
