import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail, AuditRecord } from '@/contexts/identity/application/ports/out/AuditTrail'
import {
  VerificationStore,
  IssueResetTokenInput,
} from '@/contexts/identity/application/ports/out/VerificationStore'
import { ConversationGateway } from '@/contexts/identity/application/ports/out/ConversationGateway'
import { InviteNotifier, SendInviteInput } from '@/contexts/identity/application/ports/out/InviteNotifier'
import { InviteUserService } from '@/contexts/identity/application/use-cases/InviteUserService'

// --- Inline fakes -----------------------------------------------------------

class FakeClock implements Clock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current
  }
}

class FakeUserRepository implements UserRepository {
  private byId = new Map<string, User>()
  private existing = new Set<string>()
  generatedId = 'new-user-id'
  saved: User[] = []
  seed(user: User): void {
    this.byId.set(user.id.value, user)
  }
  registerExisting(email: string): void {
    this.existing.add(email)
  }
  nextId(): UserId {
    return UserId.of(this.generatedId)
  }
  async findById(id: UserId): Promise<User | null> {
    return this.byId.get(id.value) ?? null
  }
  async findByEmail(): Promise<User | null> {
    return null
  }
  async existsByEmail(email: Email): Promise<boolean> {
    return this.existing.has(email.value)
  }
  async save(user: User): Promise<void> {
    this.saved.push(user)
    this.byId.set(user.id.value, user)
  }
  async delete(): Promise<void> {}
}

class FakeVerificationStore implements VerificationStore {
  issued: IssueResetTokenInput[] = []
  async issueResetToken(input: IssueResetTokenInput): Promise<{ token: string }> {
    this.issued.push(input)
    return { token: 'reset-token-123' }
  }
}

class FakeConversationGateway implements ConversationGateway {
  dms: Array<{ inviterId: string; inviteeId: string }> = []
  erics: string[] = []
  async ensureDm(inviterId: string, inviteeId: string): Promise<void> {
    this.dms.push({ inviterId, inviteeId })
  }
  async ensureEric(userId: string): Promise<void> {
    this.erics.push(userId)
  }
}

class FakeInviteNotifier implements InviteNotifier {
  calls: SendInviteInput[] = []
  constructor(private sent: boolean) {}
  async sendInvite(input: SendInviteInput): Promise<{ sent: boolean }> {
    this.calls.push(input)
    return { sent: this.sent }
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
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

const makeActor = (): User =>
  User.rehydrate({
    id: 'actor-1',
    name: 'Inviter Adams',
    email: 'inviter@example.com',
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
  })

const build = (notifierSent = true) => {
  const users = new FakeUserRepository()
  const verifications = new FakeVerificationStore()
  const conversations = new FakeConversationGateway()
  const notifier = new FakeInviteNotifier(notifierSent)
  const audit = new FakeAuditTrail()
  const events = new FakeEventPublisher()
  const svc = new InviteUserService(
    users,
    verifications,
    conversations,
    notifier,
    audit,
    events,
    new FakeClock(T0),
  )
  return { users, verifications, conversations, notifier, audit, events, svc }
}

describe('InviteUserService', () => {
  it('creates the account, mints a token, seeds chat, emails, and audits (happy path)', async () => {
    const ctx = build(true)
    ctx.users.seed(makeActor())

    const r = await ctx.svc.execute({ actorId: 'actor-1', name: 'New User', email: 'New.User@Example.com' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ id: 'new-user-id', email: 'new.user@example.com', emailSent: true })

    // Saved a verified, password-less user with the normalized email.
    expect(ctx.users.saved).toHaveLength(1)
    const saved = ctx.users.saved[0]
    if (!saved) throw new Error('expected a saved user')
    expect(saved.id.value).toBe('new-user-id')
    expect(saved.name).toBe('New User')
    expect(saved.email.value).toBe('new.user@example.com')
    expect(saved.emailVerified).toBe(true)

    // Published the UserInvited event.
    expect(ctx.events.published).toHaveLength(1)
    expect(ctx.events.published[0]?.name).toBe('identity.UserInvited')

    // Reset token issued for the new user with the 7-day window.
    expect(ctx.verifications.issued).toHaveLength(1)
    const issued = ctx.verifications.issued[0]
    if (!issued) throw new Error('expected an issued token')
    expect(issued.userId).toBe('new-user-id')
    expect(issued.expiresAt.getTime()).toBe(T0.getTime() + INVITE_TOKEN_TTL_MS)

    // Chat space seeded: DM (inviter<->invitee) + Eric conversation.
    expect(ctx.conversations.dms).toEqual([{ inviterId: 'actor-1', inviteeId: 'new-user-id' }])
    expect(ctx.conversations.erics).toEqual(['new-user-id'])

    // Notifier received the link payload with the inviter name + bare token.
    expect(ctx.notifier.calls).toHaveLength(1)
    expect(ctx.notifier.calls[0]).toEqual({
      to: 'new.user@example.com',
      name: 'New User',
      inviterName: 'Inviter Adams',
      token: 'reset-token-123',
    })

    // Audit row.
    expect(ctx.audit.records).toHaveLength(1)
    const rec = ctx.audit.records[0]
    if (!rec) throw new Error('expected an audit record')
    expect(rec.action).toBe('user.invited')
    expect(rec.actorId).toBe('actor-1')
    expect(rec.actorEmail).toBe('inviter@example.com')
    expect(rec.resourceId).toBe('new-user-id')
    expect(rec.metadata).toEqual({ email: 'new.user@example.com', name: 'New User' })
  })

  it('reports emailSent=false and a blank inviter name when the actor is unknown / mail not dispatched', async () => {
    const ctx = build(false)
    const r = await ctx.svc.execute({ actorId: 'ghost', name: 'New User', email: 'new@example.com' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.emailSent).toBe(false)
    expect(ctx.notifier.calls[0]?.inviterName).toBe('')
    expect(ctx.audit.records[0]?.actorEmail).toBeNull()
  })

  it('fails on an invalid email and side-effects never run', async () => {
    const ctx = build()
    const r = await ctx.svc.execute({ actorId: 'actor-1', name: 'New User', email: 'not-an-email' })
    expect(r.ok).toBe(false)
    expect(ctx.users.saved).toHaveLength(0)
    expect(ctx.verifications.issued).toHaveLength(0)
    expect(ctx.notifier.calls).toHaveLength(0)
    expect(ctx.audit.records).toHaveLength(0)
  })

  it('rejects a duplicate email before creating anything', async () => {
    const ctx = build()
    ctx.users.registerExisting('taken@example.com')
    const r = await ctx.svc.execute({ actorId: 'actor-1', name: 'New User', email: 'Taken@Example.com' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('A user with that email already exists')
    expect(ctx.users.saved).toHaveLength(0)
    expect(ctx.notifier.calls).toHaveLength(0)
  })

  it('fails on an invalid (empty) name after the uniqueness check, without sending or auditing', async () => {
    const ctx = build()
    ctx.users.seed(makeActor())
    const r = await ctx.svc.execute({ actorId: 'actor-1', name: '   ', email: 'new@example.com' })
    expect(r.ok).toBe(false)
    expect(ctx.users.saved).toHaveLength(0)
    expect(ctx.verifications.issued).toHaveLength(0)
    expect(ctx.conversations.dms).toHaveLength(0)
    expect(ctx.notifier.calls).toHaveLength(0)
    expect(ctx.audit.records).toHaveLength(0)
  })
})
