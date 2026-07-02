import { describe, it, expect } from 'vitest'
import { Flow } from '@/contexts/automation/domain/Flow'
import { Step } from '@/contexts/automation/domain/Step'
import { FlowDecider } from '@/contexts/automation/domain/FlowDecider'
import { Effect } from '@/contexts/automation/domain/Effect'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'
import { RunState } from '@/contexts/automation/domain/RunState'
import { FlowId } from '@/contexts/automation/domain/ids'

// --- fixtures -------------------------------------------------------------

const flowOf = (entry: string, steps: Step[]): Flow => {
  const r = Flow.create(FlowId.of('flow-1'), 'demo', entry, steps)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

// A small linear flow:  a (piece) -> b (code) -> c (complete)
const linearSteps: Step[] = [
  { id: 'a', type: 'piece', pieceId: 'http', action: 'get', input: { url: '{{trigger.url}}' }, next: 'b' },
  { id: 'b', type: 'code', code: 'return 1', input: { v: '{{a.status}}' }, next: 'c' },
  { id: 'c', type: 'complete', output: '{{b.doubled}}' },
]

// A router flow:  r (router) -> branch goes to ok | otherwise -> bad
const routerSteps: Step[] = [
  {
    id: 'r',
    type: 'router',
    branches: [{ whenVar: 'trigger.kind', equals: 'a', goto: 'ok' }],
    otherwise: 'bad',
  },
  { id: 'ok', type: 'complete', output: 'matched' },
  { id: 'bad', type: 'complete', output: 'fallback' },
]

// Synchronous, deterministic driver that mirrors the imperative shell but with
// a pure `perform` so we can capture the exact event log and rebuilt state.
function driveSync(
  decider: FlowDecider,
  started: RunEvent,
  perform: (e: Effect) => RunEvent,
): { state: RunState; events: RunEvent[] } {
  let state = decider.evolve(decider.initialState, started)
  const events: RunEvent[] = [started]
  let guard = 0
  while (state.status === 'running') {
    if (guard++ > 1000) throw new Error('runaway')
    const effects = decider.decide(state)
    if (effects.length === 0) break
    for (const eff of effects) {
      const ev = perform(eff)
      events.push(ev)
      state = decider.evolve(state, ev)
    }
  }
  return { state, events }
}

// --- decide() per step type ----------------------------------------------

describe('FlowDecider.decide', () => {
  it('piece step -> invokePiece effect with resolved input', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    const state: RunState = {
      status: 'running',
      cursor: 'a',
      vars: { trigger: { url: 'http://x' } },
      output: null,
      error: null,
    }
    const [eff] = d.decide(state)
    expect(eff).toEqual({
      kind: 'invokePiece',
      stepId: 'a',
      pieceId: 'http',
      action: 'get',
      input: { url: 'http://x' },
      next: 'b',
    })
  })

  it('code step -> runCode effect with resolved input', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    const state: RunState = {
      status: 'running',
      cursor: 'b',
      vars: { a: { status: 200 } },
      output: null,
      error: null,
    }
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'runCode', stepId: 'b', code: 'return 1', input: { v: 200 }, next: 'c' })
  })

  it('router step -> route effect, branch selected when condition matches', () => {
    const d = new FlowDecider(flowOf('r', routerSteps))
    const state: RunState = {
      status: 'running',
      cursor: 'r',
      vars: { trigger: { kind: 'a' } },
      output: null,
      error: null,
    }
    expect(d.decide(state)).toEqual([{ kind: 'route', from: 'r', to: 'ok' }])
  })

  it('router step -> route to otherwise when no branch matches', () => {
    const d = new FlowDecider(flowOf('r', routerSteps))
    const state: RunState = {
      status: 'running',
      cursor: 'r',
      vars: { trigger: { kind: 'z' } },
      output: null,
      error: null,
    }
    expect(d.decide(state)).toEqual([{ kind: 'route', from: 'r', to: 'bad' }])
  })

  it('complete step -> finish effect with resolved output', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    const state: RunState = {
      status: 'running',
      cursor: 'c',
      vars: { b: { doubled: 42 } },
      output: null,
      error: null,
    }
    expect(d.decide(state)).toEqual([{ kind: 'finish', output: 42 }])
  })

  it('null cursor -> finish with the accumulated output', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    const state: RunState = { status: 'running', cursor: null, vars: {}, output: { done: true }, error: null }
    expect(d.decide(state)).toEqual([{ kind: 'finish', output: { done: true } }])
  })

  it('unknown cursor -> abort effect', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    const state: RunState = { status: 'running', cursor: 'ghost', vars: {}, output: null, error: null }
    expect(d.decide(state)).toEqual([{ kind: 'abort', stepId: 'ghost', reason: 'step not found' }])
  })

  it('emits no effects in terminal states', () => {
    const d = new FlowDecider(flowOf('a', linearSteps))
    expect(d.decide({ status: 'completed', cursor: null, vars: {}, output: 1, error: null })).toEqual([])
    expect(d.decide({ status: 'failed', cursor: null, vars: {}, output: null, error: 'x' })).toEqual([])
  })
})

// --- evolve() folds each fact --------------------------------------------

describe('FlowDecider.evolve', () => {
  const d = new FlowDecider(flowOf('a', linearSteps))

  it('started -> running at entry, seeds trigger var', () => {
    const s = d.evolve(d.initialState, { type: 'started', input: { url: 'u' } })
    expect(s).toEqual({
      status: 'running',
      cursor: 'a',
      vars: { trigger: { url: 'u' } },
      output: null,
      error: null,
    })
  })

  it('stepSucceeded -> records output under stepId and advances cursor', () => {
    const base: RunState = { status: 'running', cursor: 'a', vars: { trigger: {} }, output: null, error: null }
    const s = d.evolve(base, { type: 'stepSucceeded', stepId: 'a', output: { status: 200 }, next: 'b' })
    expect(s.vars).toEqual({ trigger: {}, a: { status: 200 } })
    expect(s.output).toEqual({ status: 200 })
    expect(s.cursor).toBe('b')
  })

  it('routed -> moves the cursor only', () => {
    const base: RunState = { status: 'running', cursor: 'r', vars: { x: 1 }, output: null, error: null }
    const s = d.evolve(base, { type: 'routed', from: 'r', to: 'ok' })
    expect(s).toEqual({ ...base, cursor: 'ok' })
  })

  it('finished -> completed terminal', () => {
    const base: RunState = { status: 'running', cursor: 'c', vars: {}, output: null, error: null }
    const s = d.evolve(base, { type: 'finished', output: 7 })
    expect(s.status).toBe('completed')
    expect(s.output).toBe(7)
    expect(s.cursor).toBeNull()
  })

  it('failed -> failed terminal with reason', () => {
    const base: RunState = { status: 'running', cursor: 'a', vars: {}, output: null, error: null }
    const s = d.evolve(base, { type: 'failed', stepId: 'a', reason: 'boom' })
    expect(s.status).toBe('failed')
    expect(s.error).toBe('boom')
    expect(s.cursor).toBeNull()
  })
})

// --- replay determinism ---------------------------------------------------

describe('FlowDecider replay determinism', () => {
  const perform = (e: Effect): RunEvent => {
    switch (e.kind) {
      case 'invokePiece':
        return { type: 'stepSucceeded', stepId: e.stepId, output: { status: 200 }, next: e.next }
      case 'runCode':
        return { type: 'stepSucceeded', stepId: e.stepId, output: { doubled: 2 }, next: e.next }
      case 'route':
        return { type: 'routed', from: e.from, to: e.to }
      case 'finish':
        return { type: 'finished', output: e.output }
      case 'abort':
        return { type: 'failed', stepId: e.stepId, reason: e.reason }
    }
  }

  it('a live linear run equals the state rebuilt purely from its events', () => {
    const flow = flowOf('a', linearSteps)
    const live = driveSync(new FlowDecider(flow), { type: 'started', input: { url: 'u' } }, perform)

    expect(live.state.status).toBe('completed')
    expect(live.state.output).toBe(2)
    expect(live.events.map((e) => e.type)).toEqual([
      'started',
      'stepSucceeded',
      'stepSucceeded',
      'finished',
    ])

    // Rebuild from a fresh decider folding ONLY the events.
    const replay = new FlowDecider(flow)
    let rebuilt = replay.initialState
    for (const ev of live.events) rebuilt = replay.evolve(rebuilt, ev)
    expect(rebuilt).toEqual(live.state)
  })

  it('a live router run replays identically and selects the branch', () => {
    const flow = flowOf('r', routerSteps)
    const live = driveSync(new FlowDecider(flow), { type: 'started', input: { kind: 'a' } }, perform)
    expect(live.state.status).toBe('completed')
    expect(live.state.output).toBe('matched')
    expect(live.events.map((e) => e.type)).toEqual(['started', 'routed', 'finished'])

    const replay = new FlowDecider(flow)
    let rebuilt = replay.initialState
    for (const ev of live.events) rebuilt = replay.evolve(rebuilt, ev)
    expect(rebuilt).toEqual(live.state)
  })
})
