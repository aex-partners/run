import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. The execution strategy of an AI task: `inference` runs the agentic loop
// (model in the loop, budget-enforced); `structured` runs a single named tool
// deterministically (no model). Mirrors the DB enum.
export type TaskTypeValue = 'inference' | 'structured'

const VALUES: readonly TaskTypeValue[] = ['inference', 'structured']

export class TaskType {
  private constructor(public readonly value: TaskTypeValue) {}

  static of(raw: string): Result<TaskType> {
    if ((VALUES as readonly string[]).includes(raw)) return ok(new TaskType(raw as TaskTypeValue))
    return fail(`TaskType: unknown type "${raw}"`)
  }

  static inference(): TaskType {
    return new TaskType('inference')
  }

  static structured(): TaskType {
    return new TaskType('structured')
  }

  equals(other: TaskType): boolean {
    return other.value === this.value
  }
}
