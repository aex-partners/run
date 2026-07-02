import { describe, it, expect } from 'vitest'
import { CancelReminderService } from '@/contexts/reminders/application/use-cases/CancelReminderService'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { Scheduler } from '@/contexts/reminders/application/ports/out/Scheduler'
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

class FakeScheduler implements Scheduler {
  readonly cancelled: string[] = []
  async schedule(): Promise<void> {}
  async cancel(jobId: string): Promise<void> {
    this.cancelled.push(jobId)
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.events.push(...events)
  }
}

const fixedClock = (now: Date): Clock => ({ now: () => now })

const reminderInStatus = (status: ReminderStatus, userId = 'user-1', jobId: string | null = 'job-1'): Reminder =>
  Reminder.rehydrate({
    id: ReminderId.of('rem-1'),
    userId,
    conversationId: 'conv-1',
    message: 'Stand up',
    scheduledFor: FUTURE,
    status,
    firedAt: status === 'fired' ? NOW : null,
    jobId,
    deliverEmail: false,
    createdAt: NOW,
    updatedAt: NOW,
  })

const setup = () => {
  const reminders = new InMemoryReminderRepo()
  const scheduler = new FakeScheduler()
  const events = new RecordingPublisher()
  const service = new CancelReminderService(reminders, scheduler, events, fixedClock(NOW))
  return { reminders, scheduler, events, service }
}

describe('CancelReminderService', () => {
  it('cancels a scheduled reminder, drops the job, persists, publishes', async () => {
    const { reminders, scheduler, events, service } = setup()
    await reminders.save(reminderInStatus('scheduled'))
    const r = await service.execute({ reminderId: 'rem-1', userId: 'user-1' })
    expect(r.ok).toBe(true)
    expect(reminders.store.get('rem-1')?.status).toBe('cancelled')
    expect(scheduler.cancelled).toEqual(['job-1'])
    expect(events.events.map((e) => e.name)).toContain('reminders.ReminderCancelled')
  })

  it('fails with "Reminder not found" when missing', async () => {
    const { service } = setup()
    const r = await service.execute({ reminderId: 'nope', userId: 'user-1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Reminder not found')
  })

  it('fails with "Reminder not found" for a non-owner (scoped to owner)', async () => {
    const { reminders, scheduler, service } = setup()
    await reminders.save(reminderInStatus('scheduled', 'owner'))
    const r = await service.execute({ reminderId: 'rem-1', userId: 'intruder' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Reminder not found')
    // The owner's reminder is untouched and no job dropped.
    expect(reminders.store.get('rem-1')?.status).toBe('scheduled')
    expect(scheduler.cancelled).toHaveLength(0)
  })

  it('fails when the reminder is already fired (cancel transition guarded)', async () => {
    const { reminders, scheduler, service } = setup()
    await reminders.save(reminderInStatus('fired'))
    const r = await service.execute({ reminderId: 'rem-1', userId: 'user-1' })
    expect(r.ok).toBe(false)
    expect(scheduler.cancelled).toHaveLength(0)
  })
})
