import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'
import { ReminderScheduled } from '@/contexts/reminders/domain/events/ReminderScheduled'
import { ReminderFired } from '@/contexts/reminders/domain/events/ReminderFired'
import { ReminderCancelled } from '@/contexts/reminders/domain/events/ReminderCancelled'

interface ReminderProps {
  userId: string
  conversationId: string | null
  message: string
  scheduledFor: Date
  status: ReminderStatus
  firedAt: Date | null
  jobId: string | null
  deliverEmail: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ScheduleReminderInput {
  id: ReminderId
  jobId: string
  userId: string
  conversationId: string | null
  message: string
  scheduledFor: Date
  deliverEmail: boolean
  now: Date
}

export interface RehydrateReminderInput {
  id: ReminderId
  userId: string
  conversationId: string | null
  message: string
  scheduledFor: Date
  status: ReminderStatus
  firedAt: Date | null
  jobId: string | null
  deliverEmail: boolean
  createdAt: Date
  updatedAt: Date
}

// AGGREGATE. A reminder is a scheduled, human-facing nudge that fires once. Its
// lifecycle is a small state machine: scheduled -> fired | cancelled. Every
// transition is PURE — it mutates in-memory state and records an event; all IO
// (persistence, queue, posting) lives in the use cases.
export class Reminder extends AggregateRoot<ReminderId> {
  private constructor(
    id: ReminderId,
    private props: ReminderProps,
  ) {
    super(id)
  }

  // Factory + first transition (schedule). Guards the invariants of a valid new
  // reminder. The jobId is the delayed-job handle the Scheduler will key on.
  static schedule(input: ScheduleReminderInput): Result<Reminder> {
    const message = input.message.trim()
    if (message.length < 1) return fail('Reminder: message is required')
    if (input.scheduledFor.getTime() <= input.now.getTime()) {
      return fail('Reminder: scheduledFor must be in the future')
    }

    const reminder = new Reminder(input.id, {
      userId: input.userId,
      conversationId: input.conversationId,
      message,
      scheduledFor: input.scheduledFor,
      status: 'scheduled',
      firedAt: null,
      jobId: input.jobId,
      deliverEmail: input.deliverEmail,
      createdAt: input.now,
      updatedAt: input.now,
    })
    reminder.addEvent(
      new ReminderScheduled(
        input.id.value,
        input.userId,
        input.conversationId,
        message,
        input.scheduledFor,
        input.deliverEmail,
        input.now,
      ),
    )
    return ok(reminder)
  }

  // Rehydrate from persistence (no events, no re-validation of stored data).
  static rehydrate(input: RehydrateReminderInput): Reminder {
    return new Reminder(input.id, {
      userId: input.userId,
      conversationId: input.conversationId,
      message: input.message,
      scheduledFor: input.scheduledFor,
      status: input.status,
      firedAt: input.firedAt,
      jobId: input.jobId,
      deliverEmail: input.deliverEmail,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
  }

  get userId(): string {
    return this.props.userId
  }

  get conversationId(): string | null {
    return this.props.conversationId
  }

  get message(): string {
    return this.props.message
  }

  get scheduledFor(): Date {
    return this.props.scheduledFor
  }

  get status(): ReminderStatus {
    return this.props.status
  }

  get firedAt(): Date | null {
    return this.props.firedAt
  }

  get jobId(): string | null {
    return this.props.jobId
  }

  get deliverEmail(): boolean {
    return this.props.deliverEmail
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // PURE transition: scheduled -> fired. The caller short-circuits the
  // already-fired case for idempotency; here we still guard the invariant.
  fire(now: Date): Result<void> {
    if (this.props.status !== 'scheduled') {
      return fail(`Reminder: cannot fire a ${this.props.status} reminder`)
    }
    this.props.status = 'fired'
    this.props.firedAt = now
    this.props.updatedAt = now
    this.addEvent(
      new ReminderFired(this.id.value, this.props.userId, this.props.conversationId, this.props.message, now),
    )
    return ok(undefined)
  }

  // PURE transition: scheduled -> cancelled.
  cancel(now: Date): Result<void> {
    if (this.props.status !== 'scheduled') {
      return fail(`Already ${this.props.status}`)
    }
    this.props.status = 'cancelled'
    this.props.updatedAt = now
    this.addEvent(new ReminderCancelled(this.id.value, now))
    return ok(undefined)
  }
}
