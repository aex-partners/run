import { describe, it, expect } from 'vitest'
import { DeleteLabelService } from '@/contexts/email/application/use-cases/DeleteLabelService'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailAccountId, EmailLabelId } from '@/contexts/email/domain/ids'
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
  readonly store = new Map<string, EmailLabel>()
  readonly deleted: EmailLabel[] = []
  nextId(): EmailLabelId {
    return EmailLabelId.of('lbl-x')
  }
  async findById(id: EmailLabelId): Promise<EmailLabel | null> {
    return this.store.get(id.value) ?? null
  }
  async findByNameInAccounts(): Promise<EmailLabel | null> {
    return null
  }
  async save(): Promise<void> {}
  async delete(label: EmailLabel): Promise<void> {
    this.deleted.push(label)
    this.store.delete(label.id.value)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const seedLabel = (repo: FakeLabelRepo, id: string, accountId: string): EmailLabel => {
  const r = EmailLabel.create(EmailLabelId.of(id), accountId, 'Urgent', '#f00', NOW)
  if (!r.ok) throw new Error(r.error)
  r.value.pullEvents()
  repo.store.set(id, r.value)
  return r.value
}

describe('DeleteLabelService', () => {
  it('fails when the label does not exist', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const events = new RecordingPublisher()
    const service = new DeleteLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'missing' })
    expect(res.ok).toBe(false)
    expect(labels.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('rejects deleting a label outside the caller’s accounts', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    seedLabel(labels, 'lbl-1', 'acc-OTHER')
    const events = new RecordingPublisher()
    const service = new DeleteLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'lbl-1' })
    expect(res.ok).toBe(false)
    expect(labels.deleted).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('deletes a label in the caller’s account and publishes EmailLabelDeleted', async () => {
    const accounts = new FakeAccountRepo({ 'user-1': ['acc-1'] })
    const labels = new FakeLabelRepo()
    const label = seedLabel(labels, 'lbl-1', 'acc-1')
    const events = new RecordingPublisher()
    const service = new DeleteLabelService(accounts, labels, events, fixedClock(NOW))

    const res = await service.execute({ actorId: 'user-1', id: 'lbl-1' })
    expect(res.ok).toBe(true)
    expect(labels.deleted).toContain(label)
    expect(events.events.map((e) => e.name)).toEqual(['email.EmailLabelDeleted'])
  })
})
