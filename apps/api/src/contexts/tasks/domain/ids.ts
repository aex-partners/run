import { Identifier } from '@/shared/kernel/Identifier'

// Typed identifiers for the tasks context. Wrapping strings stops a TaskLogId
// ever being passed where a TaskId is expected.
export class TaskId extends Identifier {
  static of(value: string): TaskId {
    return new TaskId(value)
  }
}

export class TaskLogId extends Identifier {
  static of(value: string): TaskLogId {
    return new TaskLogId(value)
  }
}

// A task assignment has a composite identity (task + user). The id folds both
// into one opaque string so the aggregate still has a single Identifier.
export class TaskAssigneeId extends Identifier {
  static of(taskId: string, userId: string): TaskAssigneeId {
    return new TaskAssigneeId(`${taskId}::${userId}`)
  }
}
