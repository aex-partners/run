import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { UpdateProfileService } from '@/contexts/identity/application/use-cases/UpdateProfileService'

// --- Inline fakes -----------------------------------------------------------

class FakeClock implements Clock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current
  }
}

class FakeUserRepository implements UserRepository {
  private byId = new Map<string, User>()
  saved: User[] = []
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
  async save(user: User): Promise<void> {
    this.saved.push(user)
    this.byId.set(user.id.value, user)
  }
  async delete(): Promise<void> {}
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const T0 = new Date('2026-06-29T12:00:00.000Z')
const LONG_NAME = 'x'.repeat(101)

const makeUser = (id: string): User =>
  User.rehydrate({
    id,
    name: 'Old Name',
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role: 'user',
    kind: 'human',
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    createdAt: T0,
    updatedAt: T0,
  })

const build = () => {
  const users = new FakeUserRepository()
  const events = new FakeEventPublisher()
  const svc = new UpdateProfileService(users, events, new FakeClock(T0))
  return { users, events, svc }
}

describe('UpdateProfileService', () => {
  it('renames the caller, saves and publishes (no audit on self-service)', async () => {
    const { users, events, svc } = build()
    users.seed(makeUser('me'))

    const r = await svc.execute({ userId: 'me', name: '  Fresh Name  ' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    expect(users.saved).toHaveLength(1)
    expect(users.saved[0]?.name).toBe('Fresh Name')

    expect(events.published).toHaveLength(1)
    expect(events.published[0]?.name).toBe('identity.UserRenamed')
  })

  it('fails when the caller no longer exists', async () => {
    const { users, events, svc } = build()
    const r = await svc.execute({ userId: 'missing', name: 'Fresh Name' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User not found')
    expect(users.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('fails on an empty name', async () => {
    const { users, events, svc } = build()
    users.seed(makeUser('me'))
    const r = await svc.execute({ userId: 'me', name: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User: name is required')
    expect(users.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })

  it('fails on a name longer than the max length', async () => {
    const { svc, users } = build()
    users.seed(makeUser('me'))
    const r = await svc.execute({ userId: 'me', name: LONG_NAME })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User: name must be at most 100 characters')
  })
})
