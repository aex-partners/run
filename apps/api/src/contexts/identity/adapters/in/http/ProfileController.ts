import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { UpdateProfile } from '@/contexts/identity/application/ports/in/UpdateProfile'

// Driving adapter (tRPC). Mirrors the source `profile` router: self-service name
// change scoped to ctx.user.id, no target id param.
export const profileController = (deps: { updateProfile: UpdateProfile }) =>
  router({
    updateName: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.updateProfile.execute({ userId: ctx.user.id, name: input.name })),
      ),
  })
