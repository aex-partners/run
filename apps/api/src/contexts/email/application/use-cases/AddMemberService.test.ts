import { describe, it, expect } from 'vitest'
import { AddMemberService } from '@/contexts/email/application/use-cases/AddMemberService'
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
  readonly saved: MailAccountMember[] = []
  async find(): Promise<MailAccountMember | null> {
    return null
  }
  async save(member: MailAccountMember): Promise<void> {
    this.saved.push(member)
  }
  async delete(): Promise<void> {}
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedAccount = (repo: FakeAccountRepo, id: string, ownerId: string, isShared: boolean): EmailAccount => {
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
      isShared,
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
  const service = new AddMemberService(accounts, members, events, fixedClock(NOW))
  return { accounts, members, events, service }
}

describe('AddMemberService', () => {
  it('fails when the account does not exist', async () => {
    const { members, events, service } = setup()
    const res = await service.execute({ actorId: 'owner-1', accountId: 'missing', userId: 'bob', canSend: true })
    expect(res.ok).toBe(false)
    expect(members.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects a non-owner actor', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1', true)
    const res = await service.execute({ actorId: 'intruder', accountId: 'a1', userId: 'bob', canSend: true })
    expect(res.ok).toBe(false)
    expect(members.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects adding a member to a non-shared account', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1', false)
    const res = await service.execute({ actorId: 'owner-1', accountId: 'a1', userId: 'bob', canSend: true })
    expect(res.ok).toBe(false)
    expect(members.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('grants membership, saving with the requested canSend and publishing MailMemberAdded', async () => {
    const { accounts, members, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1', true)
    const res = await service.execute({ actorId: 'owner-1', accountId: 'a1', userId: 'bob', canSend: false })
    expect(res.ok).toBe(true)
    expect(members.saved).toHaveLength(1)
    expect(members.saved[0].userId).toBe('bob')
    expect(members.saved[0].accountId).toBe('a1')
    expect(members.saved[0].canSend).toBe(false)
    expect(events.events.map((e) => e.name)).toEqual(['email.MailMemberAdded'])
  })
})
