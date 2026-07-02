import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { UserId } from '@/contexts/notifications/domain/ids'

// AGGREGATE. Per-user digest settings, keyed by the user. It holds the PURE
// digest idempotency logic: it computes the lower bound of the unread window for
// the next digest and advances that bound after a send. An absent row is modelled
// as createDefault (enabled, never sent), so the "missing row = default-enabled"
// rule lives here in the domain rather than being re-derived by every caller.
export class NotificationPreferences extends AggregateRoot<UserId> {
  // First-run window: when a user has never received a digest there is no stamp
  // to bound from, so the first digest looks back only this far instead of
  // dumping the entire backlog.
  static readonly FIRST_RUN_WINDOW_MS = 24 * 60 * 60 * 1000

  private constructor(
    userId: UserId,
    private _emailDigest: boolean,
    private _lastDigestSentAt: Date | null,
    private _updatedAt: Date,
  ) {
    super(userId)
  }

  // The shape a user gets before any row is written: digests on, never sent.
  static createDefault(userId: UserId, now: Date): NotificationPreferences {
    return new NotificationPreferences(userId, true, null, now)
  }

  static rehydrate(
    userId: UserId,
    emailDigest: boolean,
    lastDigestSentAt: Date | null,
    updatedAt: Date,
  ): NotificationPreferences {
    return new NotificationPreferences(userId, emailDigest, lastDigestSentAt, updatedAt)
  }

  get emailDigest(): boolean {
    return this._emailDigest
  }

  get lastDigestSentAt(): Date | null {
    return this._lastDigestSentAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  isDigestEnabled(): boolean {
    return this._emailDigest
  }

  setEmailDigest(value: boolean, now: Date): void {
    this._emailDigest = value
    this._updatedAt = now
  }

  // PURE. Lower bound (exclusive) of the unread window for the next digest. Only
  // notifications created strictly after this instant are included. With no prior
  // stamp it is bounded to FIRST_RUN_WINDOW_MS before `now`.
  digestWindowStart(now: Date): Date {
    return this._lastDigestSentAt ?? new Date(now.getTime() - NotificationPreferences.FIRST_RUN_WINDOW_MS)
  }

  // PURE state transition. Advances the window so the items just sent are never
  // re-sent on a later (or retried/overlapping) run — this is what makes the
  // digest idempotent at the BullMQ level.
  markDigestSent(now: Date): void {
    this._lastDigestSentAt = now
    this._updatedAt = now
  }
}
