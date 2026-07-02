import { describe, it, expect } from 'vitest'
import { UpdateAccountService } from '@/contexts/email/application/use-cases/UpdateAccountService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

const fakeCipher: Cipher = {
  encrypt: (s) => 'enc:' + s,
  decrypt: (s) => (s === null ? null : s.replace('enc:', '')),
}

class FakeAccountRepo implements EmailAccountRepository {
  private seq = 0
  readonly store = new Map<string, EmailAccount>()
  readonly saved: EmailAccount[] = []
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
  async save(account: EmailAccount): Promise<void> {
    this.saved.push(account)
    this.store.set(account.id.value, account)
  }
  async delete(): Promise<void> {}
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
  const service = new UpdateAccountService(accounts, fakeCipher, events, fixedClock(NOW))
  return { accounts, events, service }
}

describe('UpdateAccountService', () => {
  it('fails when the account does not exist', async () => {
    const { accounts, events, service } = setup()
    const res = await service.execute({ actorId: 'owner-1', id: 'missing', displayName: 'New' })
    expect(res.ok).toBe(false)
    expect(accounts.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects an actor who is not the owner', async () => {
    const { accounts, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'intruder', id: 'a1', displayName: 'New' })
    expect(res.ok).toBe(false)
    expect(accounts.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('updates fields, re-encrypts a supplied password, saves and publishes EmailAccountUpdated', async () => {
    const { accounts, events, service } = setup()
    const account = seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({
      actorId: 'owner-1',
      id: 'a1',
      displayName: 'Renamed',
      smtpPass: 'new-secret',
    })
    expect(res.ok).toBe(true)
    expect(account.displayName).toBe('Renamed')
    expect(account.smtpPassCipher).toBe('enc:new-secret')
    expect(accounts.saved).toContain(account)
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailAccountUpdated'])
  })

  it('leaves the stored ciphertext untouched when no password is supplied', async () => {
    const { accounts, service } = setup()
    const account = seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'owner-1', id: 'a1', displayName: 'Renamed' })
    expect(res.ok).toBe(true)
    expect(account.smtpPassCipher).toBe('enc:old-secret')
  })

  it('fails the update guard (smtp port out of range) without saving or publishing', async () => {
    const { accounts, events, service } = setup()
    seedAccount(accounts, 'a1', 'owner-1')
    const res = await service.execute({ actorId: 'owner-1', id: 'a1', smtpPort: 99999 })
    expect(res.ok).toBe(false)
    expect(accounts.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
