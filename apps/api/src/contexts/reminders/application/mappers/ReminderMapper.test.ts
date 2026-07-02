import { describe, it, expect } from 'vitest'
import { ReminderMapper, ReminderRow } from '@/contexts/reminders/application/mappers/ReminderMapper'
import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'

const SCHEDULED_FOR = new Date('2026-02-01T09:00:00Z')
const CREATED_AT = new Date('2026-01-01T00:00:00Z')
const UPDATED_AT = new Date('2026-01-01T00:30:00Z')
const FIRED_AT = new Date('2026-02-01T09:00:01Z')

interface BuildOpts {
  conversationId?: string | null
  status?: ReminderStatus
  firedAt?: Date | null
  deliverEmail?: boolean
}

// Build a fully-controlled aggregate via rehydrate so every field (including
// terminal statuses) can be exercised without driving the state machine.
const buildReminder = (opts: BuildOpts = {}): Reminder =>
  Reminder.rehydrate({
    id: ReminderId.of('rem-42'),
    userId: 'user-1',
    conversationId: 'conversationId' in opts ? (opts.conversationId ?? null) : 'conv-1',
    message: 'Stand up meeting',
    scheduledFor: SCHEDULED_FOR,
    status: opts.status ?? 'scheduled',
    firedAt: opts.firedAt ?? null,
    jobId: 'job-99',
    deliverEmail: opts.deliverEmail ?? true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  })

const expectSameAggregate = (a: Reminder, b: Reminder) => {
  expect(b.id.value).toBe(a.id.value)
  expect(b.userId).toBe(a.userId)
  expect(b.conversationId).toBe(a.conversationId)
  expect(b.message).toBe(a.message)
  expect(b.scheduledFor.getTime()).toBe(a.scheduledFor.getTime())
  expect(b.status).toBe(a.status)
  expect(b.firedAt?.getTime() ?? null).toBe(a.firedAt?.getTime() ?? null)
  expect(b.jobId).toBe(a.jobId)
  expect(b.deliverEmail).toBe(a.deliverEmail)
  expect(b.createdAt.getTime()).toBe(a.createdAt.getTime())
  expect(b.updatedAt.getTime()).toBe(a.updatedAt.getTime())
}

describe('ReminderMapper', () => {
  it('round-trips every field through toPersistence -> toDomain', () => {
    const original = buildReminder()
    const back = ReminderMapper.toDomain(ReminderMapper.toPersistence(original))
    expectSameAggregate(original, back)
  })

  describe('deliverEmail boolean <-> integer flag', () => {
    it('maps deliverEmail=true to 1 and back to true', () => {
      const original = buildReminder({ deliverEmail: true })
      const row = ReminderMapper.toPersistence(original)
      expect(row.deliverEmail).toBe(1)
      expect(ReminderMapper.toDomain(row).deliverEmail).toBe(true)
    })

    it('maps deliverEmail=false to 0 and back to false', () => {
      const original = buildReminder({ deliverEmail: false })
      const row = ReminderMapper.toPersistence(original)
      expect(row.deliverEmail).toBe(0)
      expect(ReminderMapper.toDomain(row).deliverEmail).toBe(false)
    })
  })

  describe('conversationId', () => {
    it('preserves a set conversationId', () => {
      const original = buildReminder({ conversationId: 'conv-7' })
      const row = ReminderMapper.toPersistence(original)
      expect(row.conversationId).toBe('conv-7')
      expect(ReminderMapper.toDomain(row).conversationId).toBe('conv-7')
    })

    it('preserves a null conversationId', () => {
      const original = buildReminder({ conversationId: null })
      const row = ReminderMapper.toPersistence(original)
      expect(row.conversationId).toBeNull()
      expect(ReminderMapper.toDomain(row).conversationId).toBeNull()
    })
  })

  describe('status variants', () => {
    const cases: ReminderStatus[] = ['scheduled', 'fired', 'cancelled']
    for (const status of cases) {
      it(`round-trips status=${status}`, () => {
        const original = buildReminder({ status })
        const row = ReminderMapper.toPersistence(original)
        expect(row.status).toBe(status)
        expect(ReminderMapper.toDomain(row).status).toBe(status)
      })
    }
  })

  describe('firedAt', () => {
    it('preserves a null firedAt (not yet fired)', () => {
      const original = buildReminder({ status: 'scheduled', firedAt: null })
      const row = ReminderMapper.toPersistence(original)
      expect(row.firedAt).toBeNull()
      expect(ReminderMapper.toDomain(row).firedAt).toBeNull()
    })

    it('preserves a set firedAt (already fired)', () => {
      const original = buildReminder({ status: 'fired', firedAt: FIRED_AT })
      const row = ReminderMapper.toPersistence(original)
      expect(row.firedAt?.getTime()).toBe(FIRED_AT.getTime())
      expect(ReminderMapper.toDomain(row).firedAt?.getTime()).toBe(FIRED_AT.getTime())
    })
  })

  it('produces a row whose shape matches ReminderRow', () => {
    const row: ReminderRow = ReminderMapper.toPersistence(buildReminder())
    expect(row).toEqual({
      id: 'rem-42',
      userId: 'user-1',
      conversationId: 'conv-1',
      message: 'Stand up meeting',
      scheduledFor: SCHEDULED_FOR,
      status: 'scheduled',
      firedAt: null,
      jobId: 'job-99',
      deliverEmail: 1,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    })
  })
})
