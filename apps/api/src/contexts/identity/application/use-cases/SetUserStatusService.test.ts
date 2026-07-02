import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import { SetUserStatusService } from '@/contexts/identity/application/use-cases/SetUserStatusService'

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

class FakeAuditTrail implements AuditTrail {
  records: AuditRecord[] = []
  async record(event: AuditRecord): Promise<void> {
    this.records.push(event)
  }
}

class FakeEventPublisher implements EventPublisher {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

const T0 = new Date('2026-06-29T12:00:00.000Z')

const makeUser = (id: string, banned = false, email = `${id}@example.com`): User =>
  User.rehydrate({
    id,
    name: 'Name',
    email,
    emailVerified: true,
    image: null,
    role: 'user',
    kind: 'human',
    banned,
    banReason: banned ? 'spam' : null,
    banExpires: null,
    twoFactorEnabled: false,
    createdAt: T0,
    updatedAt: T0,
  })

const build = () => {
  const users = new FakeUserRepository()
  const audit = new FakeAuditTrail()
  const events = new FakeEventPublisher()
  const svc = new SetUserStatusService(users, audit, events, new FakeClock(T0))
  return { users, audit, events, svc }
}

describe('SetUserStatusService', () => {
  it('deactivates (bans) a user, saves, publishes and audits', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('actor-1', false, 'admin@example.com'))
    users.seed(makeUser('target-1'))

    const r = await svc.execute({ actorId: 'actor-1', userId: 'target-1', status: 'inactive' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    expect(users.saved).toHaveLength(1)
    expect(users.saved[0]?.banned).toBe(true)
    expect(users.saved[0]?.status).toBe('inactive')

    expect(events.published).toHaveLength(1)
    expect(events.published[0]?.name).toBe('identity.UserStatusChanged')

    expect(audit.records).toHaveLength(1)
    const rec = audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.status_changed')
    expect(rec.actorId).toBe('actor-1')
    expect(rec.actorEmail).toBe('admin@example.com')
    expect(rec.resourceId).toBe('target-1')
    expect(rec.metadata).toEqual({ status: 'inactive' })
  })

  it('reactivates a banned user and clears the ban reason', async () => {
    const { users, svc } = build()
    users.seed(makeUser('actor-1', false, 'admin@example.com'))
    users.seed(makeUser('target-1', true))

    const r = await svc.execute({ actorId: 'actor-1', userId: 'target-1', status: 'active' })
    expect(r.ok).toBe(true)
    const saved = users.saved[0]
    if (!saved) throw new Error('expected a saved user')
    expect(saved.banned).toBe(false)
    expect(saved.banReason).toBeNull()
    expect(saved.status).toBe('active')
  })

  it('rejects changing your own status and touches nothing', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('self'))
    const r = await svc.execute({ actorId: 'self', userId: 'self', status: 'inactive' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Cannot change your own status')
    expect(users.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })

  it('fails when the target user does not exist', async () => {
    const { svc } = build()
    const r = await svc.execute({ actorId: 'actor-1', userId: 'missing', status: 'inactive' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User not found')
  })

  it('records a null actor email when the actor record is missing', async () => {
    const { users, audit, svc } = build()
    users.seed(makeUser('target-1'))
    const r = await svc.execute({ actorId: 'ghost', userId: 'target-1', status: 'inactive' })
    expect(r.ok).toBe(true)
    expect(audit.records[0]?.actorEmail).toBeNull()
  })
})
