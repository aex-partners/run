import { Identifier } from '@/shared/kernel/Identifier'

// Typed identifiers for the notifications context. Wrapping strings stops a
// UserId ever being passed where a NotificationId is expected.
export class NotificationId extends Identifier {
  static of(value: string): NotificationId {
    return new NotificationId(value)
  }
}

// The recipient. Owned by the identity/auth side of the system; here it is just
// an opaque reference the context scopes every notification and preference to.
export class UserId extends Identifier {
  static of(value: string): UserId {
    return new UserId(value)
  }
}

// Optional link back to the task that produced the notification. Nullable on the
// aggregate; this VO only exists when a notification has one.
export class TaskId extends Identifier {
  static of(value: string): TaskId {
    return new TaskId(value)
  }
}
