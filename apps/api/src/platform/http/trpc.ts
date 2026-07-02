import { initTRPC, TRPCError } from '@trpc/server'
import { Result } from '@/shared/kernel/Result'

// Per-request context. `user` is populated by the better-auth adapter; protected
// procedures assert it. Mirrors AEX's ctx.session guard. `email` is carried so
// the audit/settings/identity bridges can populate `actorEmail`.
export interface AppContext {
  user: { id: string; role: string; email: string } | null
}

const t = initTRPC.context<AppContext>().create()

export const router = t.router
export const mergeRouters = t.mergeRouters
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, user: ctx.user } })
})

// Driving adapters call in-ports that return Result<T>; this unwraps into a
// value or a tRPC error, the single translation point HTTP <-> domain.
export const unwrap = <T>(r: Result<T>): T => {
  if (r.ok) return r.value
  throw new TRPCError({ code: 'BAD_REQUEST', message: r.error })
}
