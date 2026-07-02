import { SessionGateway, ResolvedSession } from '@/contexts/identity/application/ports/out/SessionGateway'

// The slice of the better-auth instance this adapter needs. Kept structural so
// the adapter does not depend on better-auth's full generic surface; main passes
// the real `auth` instance, whose api.getSession matches this shape.
export interface BetterAuthApi {
  api: {
    getSession(opts: { headers: Headers }): Promise<{ user: { id: string; role?: string | null } } | null>
  }
}

// Real-shaped SessionGateway over better-auth. Resolves a request's session
// (cookie or `Authorization: Bearer <token>`, since the bearer plugin is enabled)
// into the authenticated principal used to build the request context.
export class BetterAuthSessionGateway implements SessionGateway {
  constructor(private readonly auth: BetterAuthApi) {}

  async resolve(headers: Record<string, string | undefined>): Promise<ResolvedSession | null> {
    const h = new Headers()
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) h.set(key, value)
    }
    const session = await this.auth.api.getSession({ headers: h })
    if (!session) return null
    return { userId: session.user.id, role: session.user.role ?? 'user' }
  }
}
