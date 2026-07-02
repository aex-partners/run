import { describe, it, expect } from 'vitest'
import { FireReminderService } from '@/contexts/reminders/application/use-cases/FireReminderService'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import {
  ConversationPoster,
  ConversationPosterRequest,
} from '@/contexts/reminders/application/ports/out/ConversationPoster'
import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2026-01-02T00:00:00Z')

class InMemoryReminderRepo implements ReminderRepository {
  private seq = 0
  readonly store = new Map<string, Reminder>()
  nextId(): ReminderId {
    this.seq += 1
    return ReminderId.of(`rem-${this.seq}`)
  }
  async findById(id: ReminderId): Promise<Reminder | null> {
    return this.store.get(id.value) ?? null
  }
  async save(reminder: Reminder): Promise<void> {
    this.store.set(reminder.id.value, reminder)
  }
}

class RecordingPoster implements ConversationPoster {
  readonly posts: ConversationPosterRequest[] = []
  async post(request: ConversationPosterRequest): Promise<void> {
    this.posts.push(request)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const reminderInStatus = (status: ReminderStatus, conversationId: string | null = 'conv-1'): Reminder =>
  Reminder.rehydrate({
    id: ReminderId.of('rem-1'),
    userId: 'user-1',
    conversationId,
    message: 'Stand up',
    scheduledFor: FUTURE,
    status,
    firedAt: status === 'fired' ? NOW : null,
    jobId: 'rem-1',
    deliverEmail: false,
    createdAt: NOW,
    updatedAt: NOW,
  })

const setup = () => {
  const reminders = new InMemoryReminderRepo()
  const poster = new RecordingPoster()
  const events = new RecordingPublisher()
  const service = new FireReminderService(reminders, poster, events, fixedClock(NOW))
  return { reminders, poster, events, service }
}

describe('FireReminderService', () => {
  it('posts the reminder into the conversation, marks fired, persists, publishes', async () => {
    const { reminders, poster, events, service } = setup()
    await reminders.save(reminderInStatus('scheduled'))
    const r = await service.execute({ reminderId: 'rem-1' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.fired).toBe(true)
    expect(reminders.store.get('rem-1')?.status).toBe('fired')
    expect(poster.posts).toEqual([
      { conversationId: 'conv-1', userId: 'user-1', content: 'Reminder: Stand up' },
    ])
    expect(events.events.map((e) => e.name)).toContain('reminders.ReminderFired')
  })

  it('still fires (no post) when the reminder has no conversation', async () => {
    const { reminders, poster, service } = setup()
    await reminders.save(reminderInStatus('scheduled', null))
    const r = await service.execute({ reminderId: 'rem-1' })
    expect(r.ok && r.value.fired).toBe(true)
    expect(reminders.store.get('rem-1')?.status).toBe('fired')
    expect(poster.posts).toHaveLength(0)
  })

  it('is a no-op (fired:false) for a missing reminder', async () => {
    const { poster, service } = setup()
    const r = await service.execute({ reminderId: 'nope' })
    expect(r.ok && r.value.fired).toBe(false)
    expect(poster.posts).toHaveLength(0)
  })

  it('is idempotent: a no-op (fired:false) for an already-fired reminder, no re-post', async () => {
    const { reminders, poster, events, service } = setup()
    await reminders.save(reminderInStatus('fired'))
    const r = await service.execute({ reminderId: 'rem-1' })
    expect(r.ok && r.value.fired).toBe(false)
    expect(poster.posts).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('is a no-op for a cancelled reminder', async () => {
    const { reminders, poster, service } = setup()
    await reminders.save(reminderInStatus('cancelled'))
    const r = await service.execute({ reminderId: 'rem-1' })
    expect(r.ok && r.value.fired).toBe(false)
    expect(poster.posts).toHaveLength(0)
  })
})
