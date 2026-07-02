import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. The closed set of reasons a notification is raised. Mirrors the DB enum;
// the domain owns the list so an invalid kind can never reach an aggregate.
export type NotificationKindValue =
  | 'task_assigned'
  | 'task_acknowledged'
  | 'reminder_fired'
  | 'approval_requested'
  | 'approval_decided'

const VALUES: readonly NotificationKindValue[] = [
  'task_assigned',
  'task_acknowledged',
  'reminder_fired',
  'approval_requested',
  'approval_decided',
]

export class NotificationKind {
  private constructor(public readonly value: NotificationKindValue) {}

  static of(raw: string): Result<NotificationKind> {
    if ((VALUES as readonly string[]).includes(raw)) {
      return ok(new NotificationKind(raw as NotificationKindValue))
    }
    return fail(`NotificationKind: unknown kind "${raw}"`)
  }

  equals(other: NotificationKind): boolean {
    return other.value === this.value
  }
}
