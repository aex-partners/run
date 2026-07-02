import { describe, it, expect } from 'vitest'
import { Reminder, ScheduleReminderInput } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'

const NOW = new Date('2026-01-01T00:00:00Z')
const FUTURE = new Date('2026-01-02T00:00:00Z')
const PAST = new Date('2025-12-31T00:00:00Z')

const scheduleInput = (over: Partial<ScheduleReminderInput> = {}): ScheduleReminderInput => ({
  id: ReminderId.of('r1'),
  jobId: 'r1',
  userId: 'user-1',
  conversationId: 'conv-1',
  message: 'Drink water',
  scheduledFor: FUTURE,
  deliverEmail: false,
  now: NOW,
  ...over,
})

const scheduled = (): Reminder => {
  const r = Reminder.schedule(scheduleInput())
  if (!r.ok) throw new Error('must schedule')
  r.value.pullEvents()
  return r.value
}

const inStatus = (status: ReminderStatus): Reminder =>
  Reminder.rehydrate({
    id: ReminderId.of('r1'),
    userId: 'user-1',
    conversationId: 'conv-1',
    message: 'Drink water',
    scheduledFor: FUTURE,
    status,
    firedAt: status === 'fired' ? NOW : null,
    jobId: 'r1',
    deliverEmail: false,
    createdAt: NOW,
    updatedAt: NOW,
  })

describe('Reminder.schedule', () => {
  it('creates a scheduled reminder and records ReminderScheduled', () => {
    const r = Reminder.schedule(scheduleInput())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const reminder = r.value
    expect(reminder.status).toBe('scheduled')
    expect(reminder.message).toBe('Drink water')
    expect(reminder.firedAt).toBeNull()
    expect(reminder.jobId).toBe('r1')
    expect(reminder.createdAt).toEqual(NOW)
    const events = reminder.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('reminders.ReminderScheduled')
  })

  it('trims the message', () => {
    const r = Reminder.schedule(scheduleInput({ message: '  hi  ' }))
    expect(r.ok && r.value.message).toBe('hi')
  })

  it('rejects an empty / whitespace-only message', () => {
    expect(Reminder.schedule(scheduleInput({ message: '' })).ok).toBe(false)
    expect(Reminder.schedule(scheduleInput({ message: '   ' })).ok).toBe(false)
  })

  it('rejects a scheduledFor that is in the past', () => {
    expect(Reminder.schedule(scheduleInput({ scheduledFor: PAST })).ok).toBe(false)
  })

  it('rejects a scheduledFor equal to now (must be strictly future)', () => {
    expect(Reminder.schedule(scheduleInput({ scheduledFor: NOW })).ok).toBe(false)
  })
})

describe('Reminder.fire (scheduled -> fired)', () => {
  it('fires a scheduled reminder, stamps firedAt, records ReminderFired', () => {
    const reminder = scheduled()
    const r = reminder.fire(FUTURE)
    expect(r.ok).toBe(true)
    expect(reminder.status).toBe('fired')
    expect(reminder.firedAt).toEqual(FUTURE)
    expect(reminder.updatedAt).toEqual(FUTURE)
    expect(reminder.pullEvents()[0]?.name).toBe('reminders.ReminderFired')
  })

  it('refuses to fire an already-fired reminder', () => {
    const reminder = inStatus('fired')
    expect(reminder.fire(FUTURE).ok).toBe(false)
  })

  it('refuses to fire a cancelled reminder', () => {
    const reminder = inStatus('cancelled')
    expect(reminder.fire(FUTURE).ok).toBe(false)
  })
})

describe('Reminder.cancel (scheduled -> cancelled)', () => {
  it('cancels a scheduled reminder and records ReminderCancelled', () => {
    const reminder = scheduled()
    const r = reminder.cancel(FUTURE)
    expect(r.ok).toBe(true)
    expect(reminder.status).toBe('cancelled')
    expect(reminder.updatedAt).toEqual(FUTURE)
    expect(reminder.pullEvents()[0]?.name).toBe('reminders.ReminderCancelled')
  })

  it('refuses to cancel a fired reminder (Already fired)', () => {
    const reminder = inStatus('fired')
    const r = reminder.cancel(FUTURE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/fired/)
  })

  it('refuses to cancel an already-cancelled reminder', () => {
    const reminder = inStatus('cancelled')
    expect(reminder.cancel(FUTURE).ok).toBe(false)
  })
})
