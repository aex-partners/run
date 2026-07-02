import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import { ChangeUserRoleService } from '@/contexts/identity/application/use-cases/ChangeUserRoleService'

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

const makeUser = (id: string, role: string, email = `${id}@example.com`): User =>
  User.rehydrate({
    id,
    name: 'Name',
    email,
    emailVerified: true,
    image: null,
    role,
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
  const svc = new ChangeUserRoleService(users, audit, events, new FakeClock(T0))
  return { users, audit, events, svc }
}

describe('ChangeUserRoleService', () => {
  it('promotes a user, saves, publishes the event and records an audit row', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('actor-1', 'admin', 'admin@example.com'))
    users.seed(makeUser('target-1', 'user'))

    const r = await svc.execute({ actorId: 'actor-1', actorRole: 'admin', userId: 'target-1', role: 'admin' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    // Target was saved with the new role.
    expect(users.saved).toHaveLength(1)
    expect(users.saved[0]?.role.value).toBe('admin')

    // The role-changed event was published.
    expect(events.published).toHaveLength(1)
    expect(events.published[0]?.name).toBe('identity.UserRoleChanged')

    // Audit row reflects the transition and the actor email.
    expect(audit.records).toHaveLength(1)
    const rec = audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.role_changed')
    expect(rec.actorId).toBe('actor-1')
    expect(rec.actorEmail).toBe('admin@example.com')
    expect(rec.resourceType).toBe('user')
    expect(rec.resourceId).toBe('target-1')
    expect(rec.metadata).toEqual({ from: 'user', to: 'admin' })
  })

  it('records a null actor email when the actor record is missing', async () => {
    const { users, audit, svc } = build()
    users.seed(makeUser('target-1', 'user'))
    const r = await svc.execute({ actorId: 'ghost', actorRole: 'admin', userId: 'target-1', role: 'admin' })
    expect(r.ok).toBe(true)
    expect(audit.records[0]?.actorEmail).toBeNull()
  })

  it('rejects changing your own role and touches nothing', async () => {
    const { users, audit, events, svc } = build()
    users.seed(makeUser('self', 'admin'))
    const r = await svc.execute({ actorId: 'self', actorRole: 'admin', userId: 'self', role: 'owner' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Cannot change your own role')
    expect(users.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
    expect(audit.records).toHaveLength(0)
  })

  it('fails on an empty (invalid) role', async () => {
    const { svc } = build()
    const r = await svc.execute({ actorId: 'actor-1', actorRole: 'admin', userId: 'target-1', role: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('UserRole: role is required')
  })

  it('fails when the target user does not exist', async () => {
    const { svc } = build()
    const r = await svc.execute({ actorId: 'actor-1', actorRole: 'admin', userId: 'missing', role: 'admin' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('User not found')
  })

  it("rejects a non-owner changing another owner's role (domain guard)", async () => {
    const { users, audit, svc } = build()
    users.seed(makeUser('target-owner', 'owner'))
    const r = await svc.execute({ actorId: 'actor-1', actorRole: 'admin', userId: 'target-owner', role: 'user' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe("Only owners can change another owner's role")
    expect(audit.records).toHaveLength(0)
  })

  it('rejects a non-owner promoting someone to owner (domain guard)', async () => {
    const { users, svc } = build()
    users.seed(makeUser('target-1', 'user'))
    const r = await svc.execute({ actorId: 'actor-1', actorRole: 'admin', userId: 'target-1', role: 'owner' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Only owners can promote to owner')
  })

  it('lets an owner actor promote a user to owner', async () => {
    const { users, svc } = build()
    users.seed(makeUser('owner-actor', 'owner', 'owner@example.com'))
    users.seed(makeUser('target-1', 'user'))
    const r = await svc.execute({ actorId: 'owner-actor', actorRole: 'owner', userId: 'target-1', role: 'owner' })
    expect(r.ok).toBe(true)
    expect(users.saved[0]?.role.value).toBe('owner')
  })
})
