import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. Who runs the task: `ai` (the budgeted agentic runner) or `human`
// (surfaced on the board, never auto-executed). Mirrors the DB enum.
export type TaskExecutorValue = 'ai' | 'human'

const VALUES: readonly TaskExecutorValue[] = ['ai', 'human']

export class TaskExecutor {
  private constructor(public readonly value: TaskExecutorValue) {}

  static of(raw: string): Result<TaskExecutor> {
    if ((VALUES as readonly string[]).includes(raw)) return ok(new TaskExecutor(raw as TaskExecutorValue))
    return fail(`TaskExecutor: unknown executor "${raw}"`)
  }

  static ai(): TaskExecutor {
    return new TaskExecutor('ai')
  }

  static human(): TaskExecutor {
    return new TaskExecutor('human')
  }

  equals(other: TaskExecutor): boolean {
    return other.value === this.value
  }
}
