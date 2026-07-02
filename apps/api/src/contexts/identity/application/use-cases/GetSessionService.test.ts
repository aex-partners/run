import { describe, it, expect } from 'vitest'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { GetSessionService } from '@/contexts/identity/application/use-cases/GetSessionService'

// --- Inline fakes -----------------------------------------------------------

class FakeUserRepository implements UserRepository {
  private byId = new Map<string, User>()
  seed(user: User): void {
    this.byId.set(user.id.value, user)
  }
  nextId(): UserId {
    return UserId.of('generated')
  }
  async findById(id: UserId): Promise<User | null> {
    return this.byId.get(id.value) ?? null
  }
  async findByEmail(): Promise<User | null> {
    return null
  }
  async existsByEmail(): Promise<boolean> {
    return false
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

const T0 = new Date('2026-06-29T12:00:00.000Z')

const makeUser = (over: Partial<Parameters<typeof User.rehydrate>[0]> = {}): User =>
  User.rehydrate({
    id: 'u-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    emailVerified: true,
    image: null,
    role: 'admin',
    kind: 'human',
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  })

describe('GetSessionService', () => {
  it('returns null when there is no session id', async () => {
    const svc = new GetSessionService(new FakeUserRepository())
    const r = await svc.execute({ userId: null })
    expect(r.ok).toBe(true)
    expect(r.ok && r.value).toBeNull()
  })

  it('treats an empty-string id as no session', async () => {
    const svc = new GetSessionService(new FakeUserRepository())
    const r = await svc.execute({ userId: '' })
    expect(r.ok && r.value).toBeNull()
  })

  it('returns null when the session id resolves to no user', async () => {
    const svc = new GetSessionService(new FakeUserRepository())
    const r = await svc.execute({ userId: 'missing' })
    expect(r.ok && r.value).toBeNull()
  })

  it('projects the full session view for an existing user', async () => {
    const users = new FakeUserRepository()
    users.seed(makeUser({ image: 'https://cdn/x.png' }))
    const svc = new GetSessionService(users)
    const r = await svc.execute({ userId: 'u-1' })
    expect(r.ok).toBe(true)
    if (!r.ok || !r.value) throw new Error('expected a session view')
    expect(r.value).toEqual({
      id: 'u-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'admin',
      kind: 'human',
      image: 'https://cdn/x.png',
      emailVerified: true,
      banned: false,
    })
  })

  it('reflects a banned / unverified bot account verbatim', async () => {
    const users = new FakeUserRepository()
    users.seed(makeUser({ kind: 'bot', banned: true, emailVerified: false, role: 'user' }))
    const svc = new GetSessionService(users)
    const r = await svc.execute({ userId: 'u-1' })
    if (!r.ok || !r.value) throw new Error('expected a session view')
    expect(r.value.kind).toBe('bot')
    expect(r.value.banned).toBe(true)
    expect(r.value.emailVerified).toBe(false)
    expect(r.value.image).toBeNull()
  })
})
