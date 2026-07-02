import { describe, it, expect } from 'vitest'
import { CreateReminderService } from '@/contexts/reminders/application/use-cases/CreateReminderService'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { Scheduler } from '@/contexts/reminders/application/ports/out/Scheduler'
import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2026-01-02T00:00:00Z')
const PAST = new Date('2025-12-31T00:00:00Z')

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
  readonly scheduled: { jobId: string; runAt: Date }[] = []
  readonly cancelled: string[] = []
  async schedule(jobId: string, runAt: Date): Promise<void> {
    this.scheduled.push({ jobId, runAt })
  }
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

const setup = () => {
  const reminders = new InMemoryReminderRepo()
  const scheduler = new FakeScheduler()
  const events = new RecordingPublisher()
  const service = new CreateReminderService(reminders, scheduler, events, fixedClock(NOW))
  return { reminders, scheduler, events, service }
}

describe('CreateReminderService', () => {
  it('creates a scheduled reminder, persists it, enqueues the job keyed by id, publishes', async () => {
    const { reminders, scheduler, events, service } = setup()
    const r = await service.execute({
      userId: 'user-1',
      conversationId: 'conv-1',
      message: 'Stand up',
      scheduledFor: FUTURE,
      deliverEmail: true,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.status).toBe('scheduled')
    expect(r.value.scheduledFor).toBe(FUTURE.toISOString())

    const saved = reminders.store.get(r.value.id)
    expect(saved?.status).toBe('scheduled')
    expect(saved?.deliverEmail).toBe(true)

    // jobId == reminder id (one job per reminder).
    expect(scheduler.scheduled).toEqual([{ jobId: r.value.id, runAt: FUTURE }])
    expect(events.events.map((e) => e.name)).toContain('reminders.ReminderScheduled')
  })

  it('returns a failure and schedules nothing when the message is empty', async () => {
    const { scheduler, events, service } = setup()
    const r = await service.execute({
      userId: 'user-1',
      conversationId: null,
      message: '   ',
      scheduledFor: FUTURE,
      deliverEmail: false,
    })
    expect(r.ok).toBe(false)
    expect(scheduler.scheduled).toHaveLength(0)
    expect(events.events).toHaveLength(0)
  })

  it('returns a failure when scheduledFor is in the past', async () => {
    const { scheduler, service } = setup()
    const r = await service.execute({
      userId: 'user-1',
      conversationId: null,
      message: 'too late',
      scheduledFor: PAST,
      deliverEmail: false,
    })
    expect(r.ok).toBe(false)
    expect(scheduler.scheduled).toHaveLength(0)
  })
})
