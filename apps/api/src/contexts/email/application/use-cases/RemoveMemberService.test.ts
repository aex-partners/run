import { describe, it, expect } from 'vitest'
import { RemoveMemberService } from '@/contexts/email/application/use-cases/RemoveMemberService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeAccountRepo implements EmailAccountRepository {
  readonly store = new Map<string, EmailAccount>()
  nextId(): EmailAccountId {
    return EmailAccountId.of('acc-x')
  }
  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    return this.store.get(id.value) ?? null
  }
  async accountIdsForUser(): Promise<string[]> {
    return []
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeMemberRepo implements MailMemberRepository {
  readonly store = new Map<string, MailAccountMember>()
  readonly deleted: MailAccountMember[] = []
  private key(accountId: string, userId: string): string {
    return `${accountId}:${userId}`
  }
  seed(member: MailAccountMember): void {
    this.store.set(this.key(member.accountId, member.userId), member)
  }
  async find(accountId: string, userId: string): Promise<MailAccountMember | null> {
    return this.store.get(this.key(accountId, userId)) ?? null
  }
  async save(): Promise<void> {}
  async delete(member: MailAccountMember): Promise<void> {
    this.deleted.push(member)
    this.store.delete(this.key(member.accountId, member.userId))
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedAccount = (repo: FakeAccountRepo, id: string, ownerId: string): EmailAccount => {
  const r = EmailAccount.create(
    EmailAccountId.of(id),
    {
      ownerId,
      displayName: 'Work',
      emailAddress: 'me@work.com',
      smtpHost: 'smtp.work.com',
      smtpPort: 587,
      smtpUser: 'me@work.com',
      smtpPassCipher: 'enc:secret',
      smtpSecure: true,
      isShared: true,
    },
    NOW,
  )
  if (!r.ok) throw new Error(r.error)
  r.value.pullEvents()
  repo.store.set(id, r.value)
  return r.value
}

const setup = () => {
  const accounts = new FakeAccountRepo()
  const members = new FakeMemberRepo()
  const events = new RecordingPublisher()
  const service = new RemoveMemberService(accounts, members, events, fixedClock(NOW))
  return { accounts, members, events, service }
}

describe('RemoveMemberService', () => {
  it('fails when the account does not exist', async () => {
    const { members, events, service } = setup()
    const res = await service.execute({ actorId: 'owner-1', accountId: 'missing', userId: 'bob' })
    expect(res.ok).toBe(false)
    expect(members.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects a non-owner actor', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'intruder', accountId: 'a1', userId: 'bob' })
    expect(res.ok).toBe(false)
    expect(members.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('refuses to remove the owner from their own account', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'owner-1', accountId: 'a1', userId: 'owner-1' })
    expect(res.ok).toBe(false)
    expect(members.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('removes an existing member and publishes MailMemberRemoved', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const member = MailAccountMember.create('a1', 'bob', true, NOW)
    member.pullEvents()
    members.seed(member)

    const res = await service.execute({ actorId: 'owner-1', accountId: 'a1', userId: 'bob' })
    expect(res.ok).toBe(true)
    expect(members.deleted).toContain(member)
    expect(events.events.map((e) => e.name)).toEqual(['email.MailMemberRemoved'])
  })

  it('succeeds as a no-op when the member is not present', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'owner-1', accountId: 'a1', userId: 'ghost' })
    expect(res.ok).toBe(true)
    expect(members.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
