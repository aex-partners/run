import { Json, JsonObject } from '@/shared/domain/Json'
import { StepOutput, StepStatus } from '@/contexts/automation/domain/FlowDsl'

// The accumulated step outputs of a run, plus the pure addressing/overlay logic
// ported 1:1 from `flow-engine/execution-context.ts`. Kept as free functions over
// a plain record so the decider can fold it without owning a class.
export type StepStore = Record<string, StepOutput>

// One frame of the loop-nesting path. While inside a loop iteration, step writes
// and lookups are scoped to that iteration (faithful to the source, which keys on
// the FIRST/outermost path entry).
export interface ExecutionPath {
  stepName: string
  iteration: number
}

export const emptySteps = (): StepStore => ({})

// Record a step output. When inside a loop (path non-empty), the source stores it
// under the OUTERMOST path entry's iteration bucket, not the innermost. Ported
// exactly so nested-loop behaviour matches AEX.
export function upsertStep(
  steps: StepStore,
  path: ExecutionPath[],
  name: string,
  output: StepOutput,
): StepStore {
  const next: StepStore = { ...steps }

  if (path.length > 0) {
    const loopStep = path[0]!
    const existingLoop = next[loopStep.stepName]
    if (existingLoop) {
      const iterations = { ...(existingLoop.iterations ?? {}) }
      const iterSteps = { ...(iterations[loopStep.iteration] ?? {}) }
      iterSteps[name] = output
      iterations[loopStep.iteration] = iterSteps
      next[loopStep.stepName] = { ...existingLoop, iterations }
    }
  } else {
    next[name] = output
  }

  return next
}

// Flatten the steps into the variable-resolution state, overlaying loop-scoped
// outputs for each entry in the current path (so "{{loop.item}}" and steps inside
// the loop body resolve). Ported 1:1 from `currentState()`.
export function currentState(steps: StepStore, path: ExecutionPath[]): JsonObject {
  const state: JsonObject = {}

  for (const [name, step] of Object.entries(steps)) {
    state[name] = step.output
  }

  for (const entry of path) {
    const loopStep = steps[entry.stepName]
    const iter = loopStep?.iterations?.[entry.iteration]
    if (iter) {
      for (const [name, step] of Object.entries(iter)) {
        state[name] = step.output
      }
    }
  }

  return state
}

// Begin a loop iteration: set the loop step's live output to
// `{ iterations, index, item }` so the body can read "{{loop.item}}".
// Mirrors the source, which reads the top-level loop step and re-upserts it under
// the (now pushed) iteration path.
export function startLoopIteration(
  steps: StepStore,
  outerPath: ExecutionPath[],
  name: string,
  index: number,
  item: Json,
  total: number,
): StepStore {
  const base = steps[name]
  if (!base) return steps
  const iterations = { ...(base.iterations ?? {}) }
  iterations[index] = {}
  const updated: StepOutput = {
    ...base,
    iterations,
    output: { iterations: total, index, item },
  }
  return upsertStep(steps, [...outerPath, { stepName: name, iteration: index }], name, updated)
}

// Finalize a loop step to SUCCEEDED once every iteration has run.
export function finalizeLoopStep(steps: StepStore, path: ExecutionPath[], name: string): StepStore {
  const base = steps[name]
  if (!base) return steps
  return upsertStep(steps, path, name, { ...base, status: StepStatus.SUCCEEDED })
}
