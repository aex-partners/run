import { Result } from '@/shared/kernel/Result'

// The current authenticated user, or null when unauthenticated. Mirrors the
// shape the source's auth.me returned (ctx.session.user).
export interface SessionUserView {
  id: string
  name: string
  email: string
  role: string
  kind: 'human' | 'bot'
  image: string | null
  emailVerified: boolean
  banned: boolean
}

export interface GetSessionQuery {
  // The id resolved from the session by the SessionGateway, or null when there
  // is no active session.
  userId: string | null
}

export interface GetSession {
  execute(q: GetSessionQuery): Promise<Result<SessionUserView | null>>
}
