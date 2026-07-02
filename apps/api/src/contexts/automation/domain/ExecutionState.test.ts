import { describe, it, expect } from 'vitest'
import {
  StepStore,
  emptySteps,
  upsertStep,
  currentState,
  startLoopIteration,
  finalizeLoopStep,
} from '@/contexts/automation/domain/ExecutionState'
import { ActionType, StepStatus, StepOutput } from '@/contexts/automation/domain/FlowDsl'

const out = (output: unknown): StepOutput => ({
  type: ActionType.CODE,
  status: StepStatus.SUCCEEDED,
  input: null,
  output: output as StepOutput['output'],
  duration: 1,
})

describe('ExecutionState top-level addressing', () => {
  it('upsertStep with empty path writes at the top level', () => {
    const steps = upsertStep(emptySteps(), [], 'a', out({ status: 200 }))
    expect(currentState(steps, [])).toEqual({ a: { status: 200 } })
  })

  it('upsertStep is immutable (returns a new store)', () => {
    const before = emptySteps()
    const after = upsertStep(before, [], 'a', out(1))
    expect(before).toEqual({})
    expect(after).not.toBe(before)
  })

  it('writing into a non-existent loop is a no-op', () => {
    const steps = upsertStep(emptySteps(), [{ stepName: 'ghost', iteration: 0 }], 'x', out(1))
    expect(steps).toEqual({})
  })
})

describe('ExecutionState loop scoping', () => {
  const loop: StepOutput = {
    type: ActionType.LOOP_ON_ITEMS,
    status: StepStatus.RUNNING,
    input: { items: '{{trigger.list}}' },
    output: { iterations: 2 },
    duration: 0,
    iterations: {},
  }

  it('startLoopIteration exposes {{loop.item}} to the body via currentState', () => {
    let steps: StepStore = { myloop: loop }
    steps = startLoopIteration(steps, [], 'myloop', 0, 'item0', 2)

    const scoped = currentState(steps, [{ stepName: 'myloop', iteration: 0 }])
    expect(scoped.myloop).toEqual({ iterations: 2, index: 0, item: 'item0' })
  })

  it('body step outputs are scoped to their iteration', () => {
    let steps: StepStore = { myloop: loop }
    steps = startLoopIteration(steps, [], 'myloop', 0, 'item0', 2)
    steps = upsertStep(steps, [{ stepName: 'myloop', iteration: 0 }], 'body', out({ r: 'a' }))

    // Inside iteration 0 the body is visible.
    const inIter0 = currentState(steps, [{ stepName: 'myloop', iteration: 0 }])
    expect(inIter0.body).toEqual({ r: 'a' })

    // Outside the loop scope the iteration-local body is NOT overlaid.
    const outside = currentState(steps, [])
    expect(outside.body).toBeUndefined()
  })

  it('finalizeLoopStep flips the loop step to SUCCEEDED', () => {
    let steps: StepStore = { myloop: { ...loop } }
    steps = finalizeLoopStep(steps, [], 'myloop')
    expect(steps.myloop!.status).toBe(StepStatus.SUCCEEDED)
  })

  it('finalizing a missing loop is a no-op', () => {
    const steps = finalizeLoopStep(emptySteps(), [], 'ghost')
    expect(steps).toEqual({})
  })
})
