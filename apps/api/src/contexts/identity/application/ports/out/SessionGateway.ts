// ACL out-port over better-auth's session resolution. The composition root uses
// it to turn an incoming request (cookie or `Authorization: Bearer <token>`)
// into the authenticated principal that populates the request context. Interface
// only; the concrete adapter wraps `auth.api.getSession`.
export interface ResolvedSession {
  userId: string
  role: string
}

export interface SessionGateway {
  resolve(headers: Record<string, string | undefined>): Promise<ResolvedSession | null>
}
