import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { LoginAttempt } from '@/contexts/identity/domain/LoginAttempt'
import { Email } from '@/contexts/identity/domain/Email'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import { RecordLoginAttemptService } from '@/contexts/identity/application/use-cases/RecordLoginAttemptService'
import { CheckLockoutService } from '@/contexts/identity/application/use-cases/CheckLockoutService'
import { ResetLoginAttemptsService } from '@/contexts/identity/application/use-cases/ResetLoginAttemptsService'
import { UnlockAccountService } from '@/contexts/identity/application/use-cases/UnlockAccountService'

// --- Inline fakes -----------------------------------------------------------

class FakeClock implements Clock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

class InMemoryLoginAttemptStore implements LoginAttemptStore {
  private rows = new Map<string, LoginAttempt>()
  async find(email: Email): Promise<LoginAttempt | null> {
    return this.rows.get(email.value) ?? null
  }
  async save(attempt: LoginAttempt): Promise<void> {
    this.rows.set(attempt.id.value, attempt)
  }
  async delete(email: Email): Promise<void> {
    this.rows.delete(email.value)
  }
}

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

class FakeAuditTrail implements AuditTrail {
  records: AuditRecord[] = []
  async record(event: AuditRecord): Promise<void> {
    this.records.push(event)
  }
}

const WINDOW_MS = 15 * 60_000
const T0 = new Date('2026-06-29T12:00:00.000Z')
const EMAIL = 'User@Example.com'

describe('RecordLoginAttempt + CheckLockout integration', () => {
  it('does not lock before the 5th attempt and locks on the 5th', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const record = new RecordLoginAttemptService(store, clock)
    const check = new CheckLockoutService(store, clock)

    for (let i = 0; i < 4; i++) {
      await record.execute({ email: EMAIL })
      clock.advanceMs(1_000)
    }
    const before = await check.execute({ email: EMAIL })
    expect(before.ok && before.value).toBeNull()

    // 5th attempt trips the lock.
    await record.execute({ email: EMAIL })
    const after = await check.execute({ email: EMAIL })
    expect(after.ok).toBe(true)
    if (!after.ok || !after.value) throw new Error('expected lock')
    expect(after.value.windowMinutes).toBe(15)
    expect(typeof after.value.lockedUntil).toBe('string')
    // ISO string parses to a future instant.
    expect(new Date(after.value.lockedUntil).getTime()).toBeGreaterThan(clock.now().getTime())
  })

  it('normalizes the email so casing does not create a separate counter', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const record = new RecordLoginAttemptService(store, clock)
    const check = new CheckLockoutService(store, clock)

    for (let i = 0; i < 5; i++) {
      await record.execute({ email: i % 2 === 0 ? 'user@example.com' : 'USER@EXAMPLE.COM' })
      clock.advanceMs(1_000)
    }
    const r = await check.execute({ email: '  User@Example.com ' })
    expect(r.ok && r.value).not.toBeNull()
  })

  it('clears the lock once the window has elapsed', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const record = new RecordLoginAttemptService(store, clock)
    const check = new CheckLockoutService(store, clock)

    for (let i = 0; i < 5; i++) {
      await record.execute({ email: EMAIL })
      clock.advanceMs(1_000)
    }
    expect((await check.execute({ email: EMAIL })).ok).toBe(true)
    const locked = await check.execute({ email: EMAIL })
    expect(locked.ok && locked.value).not.toBeNull()

    // Jump past the lock expiry.
    clock.advanceMs(WINDOW_MS + 1_000)
    const cleared = await check.execute({ email: EMAIL })
    expect(cleared.ok && cleared.value).toBeNull()
  })
})

describe('CheckLockoutService', () => {
  it('returns null when no attempt row exists', async () => {
    const svc = new CheckLockoutService(new InMemoryLoginAttemptStore(), new FakeClock(new Date(T0)))
    const r = await svc.execute({ email: EMAIL })
    expect(r.ok && r.value).toBeNull()
  })

  it('fails for an invalid email', async () => {
    const svc = new CheckLockoutService(new InMemoryLoginAttemptStore(), new FakeClock(new Date(T0)))
    const r = await svc.execute({ email: 'not-an-email' })
    expect(r.ok).toBe(false)
  })

  it('returns null when a stored attempt exists but is not currently locked', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const attempt = LoginAttempt.fresh(Email.fromTrusted('user@example.com'))
    attempt.register(clock.now())
    await store.save(attempt)
    const svc = new CheckLockoutService(store, clock)
    expect((await svc.execute({ email: EMAIL })).ok).toBe(true)
    const r = await svc.execute({ email: EMAIL })
    expect(r.ok && r.value).toBeNull()
  })
})

describe('ResetLoginAttemptsService', () => {
  it('clears accumulated lockout state', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const record = new RecordLoginAttemptService(store, clock)
    const check = new CheckLockoutService(store, clock)
    const reset = new ResetLoginAttemptsService(store)

    for (let i = 0; i < 5; i++) {
      await record.execute({ email: EMAIL })
      clock.advanceMs(1_000)
    }
    const locked = await check.execute({ email: EMAIL })
    expect(locked.ok && locked.value).not.toBeNull()

    const r = await reset.execute({ email: EMAIL })
    expect(r.ok).toBe(true)
    const after = await check.execute({ email: EMAIL })
    expect(after.ok && after.value).toBeNull() // row gone
  })

  it('fails for an invalid email', async () => {
    const reset = new ResetLoginAttemptsService(new InMemoryLoginAttemptStore())
    expect((await reset.execute({ email: 'bad' })).ok).toBe(false)
  })
})

describe('UnlockAccountService', () => {
  const buildActor = (): User => {
    const r = User.invite(UserId.of('admin-1'), 'Admin', Email.fromTrusted('admin@example.com'), T0)
    if (!r.ok) throw new Error(r.error)
    return r.value
  }

  it('clears the lock and records an audit row with the actor email', async () => {
    const store = new InMemoryLoginAttemptStore()
    const clock = new FakeClock(new Date(T0))
    const record = new RecordLoginAttemptService(store, clock)
    const check = new CheckLockoutService(store, clock)
    const users = new FakeUserRepository()
    users.seed(buildActor())
    const audit = new FakeAuditTrail()
    const unlock = new UnlockAccountService(store, users, audit)

    for (let i = 0; i < 5; i++) {
      await record.execute({ email: EMAIL })
      clock.advanceMs(1_000)
    }

    const r = await unlock.execute({ actorId: 'admin-1', email: EMAIL })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ success: true })

    // Lock is gone.
    const after = await check.execute({ email: EMAIL })
    expect(after.ok && after.value).toBeNull()

    // Audit row reflects the action.
    expect(audit.records).toHaveLength(1)
    const rec = audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.unlocked')
    expect(rec.actorId).toBe('admin-1')
    expect(rec.actorEmail).toBe('admin@example.com')
    expect(rec.resourceId).toBeNull()
    expect(rec.metadata).toEqual({ email: 'user@example.com' })
  })

  it('records a null actor email when the actor is unknown', async () => {
    const store = new InMemoryLoginAttemptStore()
    const audit = new FakeAuditTrail()
    const unlock = new UnlockAccountService(store, new FakeUserRepository(), audit)
    const r = await unlock.execute({ actorId: 'ghost', email: EMAIL })
    expect(r.ok).toBe(true)
    expect(audit.records[0]?.actorEmail).toBeNull()
  })

  it('fails for an invalid email and records nothing', async () => {
    const audit = new FakeAuditTrail()
    const unlock = new UnlockAccountService(
      new InMemoryLoginAttemptStore(),
      new FakeUserRepository(),
      audit,
    )
    const r = await unlock.execute({ actorId: 'admin-1', email: 'nope' })
    expect(r.ok).toBe(false)
    expect(audit.records).toHaveLength(0)
  })
})
