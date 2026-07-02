import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { CheckSetupComplete } from '@/contexts/settings/application/ports/in/CheckSetupComplete'
import { GetSetting } from '@/contexts/settings/application/ports/in/GetSetting'
import { SetSetting } from '@/contexts/settings/application/ports/in/SetSetting'
import { CompleteSetup } from '@/contexts/settings/application/ports/in/CompleteSetup'

// Admin/owner guard, mirroring AEX's adminProcedure.
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx })
})

// Driving adapter (tRPC). Validates input, calls in-ports, unwraps Result into a
// response or a tRPC error. Wire the returned router under `settings`.
//
// Note: AEX's settings.set audits with the actor's email, but the hexagon's
// AppContext only carries { id, role }. actorEmail is therefore left to the audit
// bridge / a future AppContext.email field; actorId is passed through here.
export const settingsController = (deps: {
  checkSetupComplete: CheckSetupComplete
  getSetting: GetSetting
  setSetting: SetSetting
  completeSetup: CompleteSetup
}) =>
  router({
    isSetupComplete: publicProcedure.query(() => deps.checkSetupComplete.execute()),

    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => deps.getSetting.execute(input)),

    set: adminProcedure
      .input(z.object({ key: z.string(), value: z.unknown() }))
      .mutation(async ({ ctx, input }) =>
        unwrap(
          await deps.setSetting.execute({
            key: input.key,
            value: input.value,
            actorId: ctx.user.id,
          }),
        ),
      ),

    completeSetup: protectedProcedure
      .input(
        z.object({
          orgName: z.string(),
          orgLogo: z.string().optional(),
          website: z.string().optional(),
          niche: z.string().optional(),
          subNiche: z.string().optional(),
          country: z.string().optional(),
          language: z.string().optional(),
          timezone: z.string().optional(),
          currencies: z.array(z.string()).optional(),
          invites: z.array(z.string()).optional(),
          onboardingPath: z.string().nullable().optional(),
          selectedRoutines: z.array(z.string()).optional(),
          emailProvider: z.enum(['smtp']).nullable().optional(),
          smtpHost: z.string().optional(),
          smtpPort: z.string().optional(),
          smtpUser: z.string().optional(),
          smtpPass: z.string().optional(),
          smtpFrom: z.string().optional(),
          smtpSecure: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.completeSetup.execute({ ...input, actorUserId: ctx.user.id })),
      ),
  })
