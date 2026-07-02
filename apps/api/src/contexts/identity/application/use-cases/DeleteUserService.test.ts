import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import { DeleteUserService } from '@/contexts/identity/application/use-cases/DeleteUserService'

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
  deleted: UserId[] = []
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
  async delete(id: UserId): Promise<void> {
    this.deleted.push(id)
    this.byId.delete(id.value)
  }
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
    name: 'Name',
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
  const svc = new DeleteUserService(users, audit, events, new FakeClock(T0))
  return { users, audit, events, svc }
}

describe('DeleteUserService', () => {
  it('deletes the target, publishes the event and records an audit row', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('actor-1', 'admin@example.com'))
    users.seed(makeUser('target-1'))

    const r = await svc.execute({ actorId: 'actor-1', userId: 'target-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    // Target id was handed to the repository delete.
    expect(users.deleted).toHaveLength(1)
    expect(users.deleted[0]?.value).toBe('target-1')

    // A UserDeleted event was published.
    expect(events.published).toHaveLength(1)
    expect(events.published[0]?.name).toBe('identity.UserDeleted')

    // Audit row reflects the action and the actor email.
    expect(audit.records).toHaveLength(1)
    const rec = audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.deleted')
    expect(rec.actorId).toBe('actor-1')
    expect(rec.actorEmail).toBe('admin@example.com')
    expect(rec.resourceType).toBe('user')
    expect(rec.resourceId).toBe('target-1')
  })

  it('records a null actor email when the actor lookup misses (actor deleted alongside)', async () => {
    const { users, audit, svc } = build()
    // actorId only exists as the target here, so the post-delete actor lookup misses.
    users.seed(makeUser('target-1'))
    const r = await svc.execute({ actorId: 'ghost', userId: 'target-1' })
    expect(r.ok).toBe(true)
    expect(audit.records[0]?.actorEmail).toBeNull()
  })

  it('rejects deleting yourself and touches nothing', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('self'))
    const r = await svc.execute({ actorId: 'self', userId: 'self' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Cannot delete yourself')
    expect(users.deleted).toHaveLength(0)
    expect(events.published).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })

  it('fails when the target user does not exist', async () => {
    const { users, audit, svc } = build()
    const r = await svc.execute({ actorId: 'actor-1', userId: 'missing' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User not found')
    expect(users.deleted).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })
})
