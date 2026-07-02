// Assembles every context's controller into the single root tRPC AppRouter the
// frontend consumes. Controllers that already return a tRPC `router({...})` are
// mounted directly; controllers that return a plain handler-object (the ported
// AEX style) are wrapped here into protected procedures, injecting the acting
// user from the session.
import { z } from 'zod'
import { router, mergeRouters, publicProcedure, protectedProcedure } from '@/platform/http/trpc'
import { Container } from '@/main/container'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlainHandlers = Record<string, (...args: any[]) => unknown>

// Wrap a plain handler-object into a tRPC sub-router. Each handler becomes a
// mutation with a passthrough (`z.any()`) input.
//   - 'user'    : the handler expects the acting user inside its input object;
//                 we inject it under the common aliases (server-authoritative).
//   - 'userArg' : the handler takes (input, userId) as two args (knowledge).
//   - 'public'  : unauthenticated; no user injected.
function wrapPlain(handlers: PlainHandlers, mode: 'user' | 'userArg' | 'public' = 'user') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const procedures: Record<string, any> = {}
  for (const [name, fn] of Object.entries(handlers)) {
    if (mode === 'public') {
      procedures[name] = publicProcedure
        .input(z.any())
        .mutation(({ input }) => fn((input ?? {}) as Record<string, unknown>))
      continue
    }
    procedures[name] = protectedProcedure.input(z.any()).mutation(({ input, ctx }) => {
      const i = (input ?? {}) as Record<string, unknown>
      const userId = ctx.user.id
      if (mode === 'userArg') return fn(i, userId)
      // server-authoritative: the acting-user aliases override anything the
      // client sent (so userId/createdBy/etc. can't be spoofed).
      return fn({
        ...i,
        userId,
        createdBy: userId,
        requestedBy: userId,
        actorId: userId,
        actorUserId: userId,
        triggeredBy: userId,
      })
    })
  }
  return router(procedures)
}

export function appRouter(container: Container) {
  const t = container.trpcControllers
  const p = container.plainControllers
  const pub = container.publicControllers

  return router({
    // All context controllers are native typed tRPC routers, mounted top-level to
    // match the AEX router contract the frontend consumes.
    conversations: t.conversations,
    messages: t.messages,
    emails: t.emails,
    files: t.files,
    settings: t.settings,
    auditLog: t.auditLog,
    geocode: t.geocode,
    agents: t.agents,
    auth: t.auth,
    users: t.users,
    profile: t.profile,
    // AEX's entities router merges entity + record procedures (no name collision).
    entities: mergeRouters(p.entities, p.records),
    viewPreferences: p.views,
    tasks: p.tasks,
    flows: p.flows,
    plugins: p.plugins,
    credentials: p.credentials,
    forms: p.forms,
    reminders: p.reminders,
    notifications: p.notifications,
    knowledge: p.knowledge,
    skills: p.skills,
    assistant: p.assistant,
    payments: p.payments,
    fiscal: p.fiscal,
    bling: p.bling,
    // PublicFormController stays a plain public handler map.
    publicForms: wrapPlain(pub.publicForms, 'public'),
  })
}

export type AppRouter = ReturnType<typeof appRouter>
