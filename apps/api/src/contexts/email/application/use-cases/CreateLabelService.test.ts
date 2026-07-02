import { describe, it, expect } from 'vitest'
import { CreateLabelService } from '@/contexts/email/application/use-cases/CreateLabelService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailAccountId, EmailLabelId } from '@/contexts/email/domain/ids'
import { DEFAULT_LABEL_COLOR } from '@/contexts/email/domain/Label'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const fixedClock = (now: Date): Clock => ({ now: () => now })

class FakeAccountRepo implements EmailAccountRepository {
  constructor(private readonly idsByUser: Record<string, string[]> = {}) {}
  nextId(): EmailAccountId {
    return EmailAccountId.of('acc-x')
  }
  async findById(): Promise<EmailAccount | null> {
    return null
  }
  async accountIdsForUser(userId: string): Promise<string[]> {
    return [...(this.idsByUser[userId] ?? [])]
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeLabelRepo implements EmailLabelRepository {
  private seq = 0
  readonly saved: EmailLabel[] = []
  nextId(): EmailLabelId {
    this.seq += 1
    return EmailLabelId.of(`lbl-${this.seq}`)
  }
  async findById(): Promise<EmailLabel | null> {
    return null
  }
  async findByNameInAccounts(): Promise<EmailLabel | null> {
    return null
  }
  async save(label: EmailLabel): Promise<void> {
    this.saved.push(label)
  }
  async delete(): Promise<void> {}
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

describe('CreateLabelService', () => {
  it('fails when the account is not one of the caller’s accounts', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const events = new RecordingPublisher()
    const service = new CreateLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', accountId: 'acc-OTHER', name: 'Urgent', color: '#f00' })
    expect(res.ok).toBe(false)
    expect(labels.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('creates the label, saves it and publishes EmailLabelCreated', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const events = new RecordingPublisher()
    const service = new CreateLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', accountId: 'acc-1', name: 'Urgent', color: '#f00' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual({ id: 'lbl-1', accountId: 'acc-1', name: 'Urgent', color: '#f00' })
    expect(labels.saved).toHaveLength(1)
    expect(labels.saved[0].name).toBe('Urgent')
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailLabelCreated'])
  })

  it('defaults to grey when no colour is supplied', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const service = new CreateLabelService(accounts, labels, new RecordingPublisher(), fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', accountId: 'acc-1', name: 'Plain', color: '' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value.color).toBe(DEFAULT_LABEL_COLOR)
  })

  it('fails the label guard when the name is blank without saving or publishing', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const events = new RecordingPublisher()
    const service = new CreateLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', accountId: 'acc-1', name: '   ', color: '#f00' })
    expect(res.ok).toBe(false)
    expect(labels.saved).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })
})
