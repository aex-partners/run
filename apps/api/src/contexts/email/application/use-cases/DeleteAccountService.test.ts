import { describe, it, expect } from 'vitest'
import { DeleteAccountService } from '@/contexts/email/application/use-cases/DeleteAccountService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeAccountRepo implements EmailAccountRepository {
  private seq = 0
  readonly store = new Map<string, EmailAccount>()
  readonly deleted: EmailAccount[] = []
  nextId(): EmailAccountId {
    this.seq += 1
    return EmailAccountId.of(`acc-${this.seq}`)
  }
  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    return this.store.get(id.value) ?? null
  }
  async accountIdsForUser(): Promise<string[]> {
    return []
  }
  async save(): Promise<void> {}
  async delete(account: EmailAccount): Promise<void> {
    this.deleted.push(account)
    this.store.delete(account.id.value)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedAccount = (repo: FakeAccountRepo, id: string, ownerId = 'owner-1'): EmailAccount => {
  const r = EmailAccount.create(
    EmailAccountId.of(id),
    {
      ownerId,
      displayName: 'Work',
      emailAddress: 'me@work.com',
      smtpHost: 'smtp.work.com',
      smtpPort: 587,
      smtpUser: 'me@work.com',
      smtpPassCipher: 'enc:old-secret',
      smtpSecure: true,
      isShared: false,
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
  const events = new RecordingPublisher()
  const service = new DeleteAccountService(accounts, events, fixedClock(NOW))
  return { accounts, events, service }
}

describe('DeleteAccountService', () => {
  it('fails when the account does not exist', async () => {
    const { accounts, events, service } = setup()
    const res = await service.execute({ actorId: 'owner-1', id: 'missing' })
    expect(res.ok).toBe(false)
    expect(accounts.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects an actor who is not the owner', async () => {
    const { accounts, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'intruder', id: 'a1' })
    expect(res.ok).toBe(false)
    expect(accounts.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('deletes the owned account and publishes EmailAccountDeleted', async () => {
    const { accounts, events, service } = setup()
    const account = seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'owner-1', id: 'a1' })
    expect(res.ok).toBe(true)
    expect(accounts.deleted).toContain(account)
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailAccountDeleted'])
  })
})
