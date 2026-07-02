import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. The semantic type of a task. `task` is plain work, `reminder` is a
// human-facing nudge surfaced (not AI-executed), `approval` requires a decision.
// Mirrors the DB enum; the domain owns the list so an invalid kind can never
// reach an aggregate.
export type TaskKindValue = 'task' | 'reminder' | 'approval'

const VALUES: readonly TaskKindValue[] = ['task', 'reminder', 'approval']

export class TaskKind {
  private constructor(public readonly value: TaskKindValue) {}

  static of(raw: string): Result<TaskKind> {
    if ((VALUES as readonly string[]).includes(raw)) return ok(new TaskKind(raw as TaskKindValue))
    return fail(`TaskKind: unknown kind "${raw}"`)
  }

  static task(): TaskKind {
    return new TaskKind('task')
  }

  equals(other: TaskKind): boolean {
    return other.value === this.value
  }
}
