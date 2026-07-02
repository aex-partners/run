import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Database } from '@/platform/db/client'
import { Env } from '@/platform/config/env'
import * as schema from '@/platform/db/schema'

// Real better-auth instance. The drizzle adapter maps better-auth's models
// (user/session/account/verification) onto our plural tables. Email/password is
// enabled with cookie sessions. The instance is built once in main and shared by:
//  - the Fastify auth handler route (`toNodeHandler(auth)`),
//  - the tRPC AppContext builder (`auth.api.getSession`),
//  - identity's BetterAuthSessionGateway adapter.
//
// `role`/`kind` are surfaced as additional user fields so the session carries the
// role used by protected/admin procedures.
export function makeAuth(db: Database, env: Env) {
  return betterAuth({
    // The adapter's `DB` type is intentionally loose; our postgres-js Database
    // satisfies it structurally.
    database: drizzleAdapter(db as never, {
      provider: 'pg',
      // Explicit model -> table map (our tables are plural). Avoids the
      // double-pluralization usePlural caused ("users" -> "userss").
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        kind: { type: 'string', required: false, defaultValue: 'human', input: false },
      },
    },
  })
}

export type Auth = ReturnType<typeof makeAuth>

// The session shape the app reads. better-auth returns a richer object; this is
// the slice the AppContext + identity SessionGateway need.
export interface AuthSessionUser {
  id: string
  email: string
  role: string
}

// Resolve the current user from request headers, normalized to { id, email, role }.
export async function resolveSessionUser(
  auth: Auth,
  headers: Headers,
): Promise<AuthSessionUser | null> {
  const session = await auth.api.getSession({ headers })
  if (!session?.user) return null
  const user = session.user as { id: string; email: string; role?: string | null }
  return { id: user.id, email: user.email, role: user.role ?? 'user' }
}
