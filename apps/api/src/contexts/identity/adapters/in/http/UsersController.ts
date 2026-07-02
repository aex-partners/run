import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { ListAssignableUsers } from '@/contexts/identity/application/queries/ListAssignableUsers'
import { ListUsers } from '@/contexts/identity/application/queries/ListUsers'
import { InviteUser } from '@/contexts/identity/application/ports/in/InviteUser'
import { ChangeUserRole } from '@/contexts/identity/application/ports/in/ChangeUserRole'
import { SetUserStatus } from '@/contexts/identity/application/ports/in/SetUserStatus'
import { RenameUser } from '@/contexts/identity/application/ports/in/RenameUser'
import { UnlockAccount } from '@/contexts/identity/application/ports/in/UnlockAccount'
import { DeleteUser } from '@/contexts/identity/application/ports/in/DeleteUser'

// Driving adapter (tRPC). Mirrors the source `users` router. The platform only
// ships public/protected procedures, so the admin gate (role admin|owner) is
// composed here from protectedProcedure, matching the source adminProcedure.
const isAdminOrOwner = (role: string) => role === 'admin' || role === 'owner'

export const usersController = (deps: {
  listAssignable: ListAssignableUsers
  list: ListUsers
  invite: InviteUser
  changeRole: ChangeUserRole
  setStatus: SetUserStatus
  rename: RenameUser
  unlock: UnlockAccount
  remove: DeleteUser
}) => {
  const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (!isAdminOrOwner(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
    }
    return next({ ctx })
  })

  return router({
    // Any authenticated user may list assignable peers.
    listAssignable: protectedProcedure.query(() => deps.listAssignable.execute()),

    list: adminProcedure.query(() => deps.list.execute()),

    invite: adminProcedure
      .input(z.object({ name: z.string().min(1), email: z.string().email() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.invite.execute({ actorId: ctx.user.id, name: input.name, email: input.email }),
        ),
      ),

    updateRole: adminProcedure
      .input(z.object({ userId: z.string(), role: z.string().min(1) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.changeRole.execute({
            actorId: ctx.user.id,
            actorRole: ctx.user.role,
            userId: input.userId,
            role: input.role,
          }),
        ),
      ),

    updateStatus: adminProcedure
      .input(z.object({ userId: z.string(), status: z.enum(['active', 'inactive']) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.setStatus.execute({
            actorId: ctx.user.id,
            userId: input.userId,
            status: input.status,
          }),
        ),
      ),

    updateName: adminProcedure
      .input(z.object({ userId: z.string(), name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.rename.execute({ actorId: ctx.user.id, userId: input.userId, name: input.name }),
        ),
      ),

    unlockAccount: adminProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.unlock.execute({ actorId: ctx.user.id, email: input.email })),
      ),

    delete: adminProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.remove.execute({ actorId: ctx.user.id, userId: input.userId })),
      ),
  })
}
