import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import { RenameUserService } from '@/contexts/identity/application/use-cases/RenameUserService'

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

const makeUser = (id: string, email = `${id}@example.com`): User =>
  User.rehydrate({
    id,
    name: 'Old Name',
    email,
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
  const audit = new FakeAuditTrail()
  const events = new FakeEventPublisher()
  const svc = new RenameUserService(users, audit, events, new FakeClock(T0))
  return { users, audit, events, svc }
}

describe('RenameUserService', () => {
  it('renames the target, saves, publishes and audits', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('actor-1', 'admin@example.com'))
    users.seed(makeUser('target-1'))

    const r = await svc.execute({ actorId: 'actor-1', userId: 'target-1', name: '  New Name  ' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    // Saved with the trimmed name.
    expect(users.saved).toHaveLength(1)
    expect(users.saved[0]?.name).toBe('New Name')

    expect(events.published).toHaveLength(1)
    expect(events.published[0]?.name).toBe('identity.UserRenamed')

    expect(audit.records).toHaveLength(1)
    const rec = audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.renamed')
    expect(rec.actorId).toBe('actor-1')
    expect(rec.actorEmail).toBe('admin@example.com')
    expect(rec.resourceId).toBe('target-1')
    // Audit records the raw command name (not trimmed by the service).
    expect(rec.metadata).toEqual({ name: '  New Name  ' })
  })

  it('fails when the target user does not exist', async () => {
    const { users, audit, svc } = build()
    const r = await svc.execute({ actorId: 'actor-1', userId: 'missing', name: 'New Name' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User not found')
    expect(users.saved).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })

  it('fails on an empty name and records nothing', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('target-1'))
    const r = await svc.execute({ actorId: 'actor-1', userId: 'target-1', name: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User: name is required')
    expect(users.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })

  it('records a null actor email when the actor record is missing', async () => {
    const { users, audit, svc } = build()
    users.seed(makeUser('target-1'))
    const r = await svc.execute({ actorId: 'ghost', userId: 'target-1', name: 'New Name' })
    expect(r.ok).toBe(true)
    expect(audit.records[0]?.actorEmail).toBeNull()
  })
})
