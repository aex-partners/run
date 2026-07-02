import { describe, it, expect } from 'vitest'
import { FlowDecider } from '@/contexts/automation/domain/engine/FlowDecider'
import { RunState } from '@/contexts/automation/domain/engine/RunState'
import { Effect } from '@/contexts/automation/domain/engine/Effect'
import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'
import {
  ActionType,
  TriggerType,
  StepStatus,
  FlowTrigger,
  FlowAction,
  PieceAction,
  CodeAction,
  LoopAction,
  RouterAction,
} from '@/contexts/automation/domain/FlowDsl'
import { Json } from '@/shared/domain/Json'

// --- DSL builders ---------------------------------------------------------

const piece = (
  name: string,
  input: Record<string, Json> = {},
  over: Partial<PieceAction['settings'] & { skip: boolean }> = {},
  nextAction?: FlowAction,
): PieceAction => {
  const { skip, ...settings } = over
  return {
    name,
    displayName: name,
    valid: true,
    skip,
    type: ActionType.PIECE,
    settings: { pieceName: 'http', pieceVersion: '1.0.0', actionName: 'get', input, ...settings },
    nextAction,
  }
}

const codeAct = (
  name: string,
  input: Record<string, Json> = {},
  nextAction?: FlowAction,
  over: Partial<CodeAction['settings']> = {},
): CodeAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.CODE,
  settings: { sourceCode: 'return 1', input, ...over },
  nextAction,
})

const loop = (name: string, items: string, body?: FlowAction, nextAction?: FlowAction): LoopAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.LOOP_ON_ITEMS,
  settings: { items },
  firstLoopAction: body,
  nextAction,
})

const router = (
  name: string,
  branches: RouterAction['settings']['branches'],
  children: (FlowAction | undefined)[],
  executionType: RouterAction['settings']['executionType'] = 'EXECUTE_FIRST_MATCH',
  nextAction?: FlowAction,
): RouterAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.ROUTER,
  settings: { branches, executionType },
  children,
  nextAction,
})

const trigger = (nextAction?: FlowAction, input: Record<string, Json> = {}): FlowTrigger => ({
  name: 'trigger',
  displayName: 'Trigger',
  type: TriggerType.WEBHOOK,
  valid: true,
  settings: { input },
  nextAction,
})

// Deterministic synchronous driver (a pure stand-in for the imperative shell).
function driveSync(
  d: FlowDecider,
  started: RunEvent,
  triggerOutput: Json,
): { state: RunState; events: RunEvent[] } {
  const perform = (e: Effect): RunEvent => {
    switch (e.kind) {
      case 'invokePiece':
        return { type: 'stepSucceeded', name: e.name, atype: ActionType.PIECE, input: e.input, output: { ok: true, from: e.name }, duration: 10, path: e.path }
      case 'runCode':
        return { type: 'stepSucceeded', name: e.name, atype: ActionType.CODE, input: e.input, output: { ran: e.name }, duration: 5, path: e.path }
      case 'skip':
        return { type: 'stepSkipped', name: e.name, atype: e.atype, path: e.path }
      case 'enterLoop':
        return { type: 'loopEntered', name: e.name, itemsExpr: e.itemsExpr, items: e.items, hasBody: e.hasBody, path: e.path }
      case 'iterate':
        return { type: 'loopIterationStarted', name: e.name, index: e.index, item: e.item, total: e.total, path: e.path }
      case 'finalizeLoop':
        return { type: 'loopFinalized', name: e.name, path: e.path }
      case 'enterRouter':
        return { type: 'routerEntered', name: e.name, input: e.input, branchResults: e.branchResults, selected: e.selected, path: e.path }
      case 'finish':
        return { type: 'finished' }
    }
  }

  let state = d.evolve(d.initialState, started)
  const events: RunEvent[] = [started]
  let guard = 0
  while (state.status === 'running') {
    if (guard++ > 5000) throw new Error('runaway')
    const effects = d.decide(state)
    if (effects.length === 0) break
    for (const eff of effects) {
      const ev = perform(eff)
      events.push(ev)
      state = d.evolve(state, ev)
    }
  }
  void triggerOutput
  return { state, events }
}

const startedFor = (out: Json): RunEvent => ({ type: 'started', triggerName: 'trigger', triggerOutput: out })

// --- decide() -------------------------------------------------------------

describe('engine FlowDecider.decide', () => {
  it('piece action frame -> invokePiece effect with resolved input', () => {
    const d = new FlowDecider(trigger(piece('step_1', { to: '{{trigger.name}}' })))
    const state = d.evolve(d.initialState, startedFor({ name: 'Ada' }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({
      kind: 'invokePiece',
      name: 'step_1',
      pieceName: 'http',
      actionName: 'get',
      input: { to: 'Ada' },
      continueOnFailure: false,
      path: [],
    })
  })

  it('code action frame -> runCode effect', () => {
    const d = new FlowDecider(trigger(codeAct('step_1', { v: '{{trigger.n}}' })))
    const state = d.evolve(d.initialState, startedFor({ n: 9 }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'runCode', name: 'step_1', sourceCode: 'return 1', input: { v: 9 } })
  })

  it('skip flag -> skip effect (no IO)', () => {
    const d = new FlowDecider(trigger(piece('step_1', {}, { skip: true })))
    const state = d.evolve(d.initialState, startedFor({}))
    expect(d.decide(state)).toEqual([{ kind: 'skip', name: 'step_1', atype: ActionType.PIECE, path: [] }])
  })

  it('continueOnFailure flag is threaded into the effect', () => {
    const p = piece('step_1', {}, { errorHandlingOptions: { continueOnFailure: { value: true } } })
    const d = new FlowDecider(trigger(p))
    const state = d.evolve(d.initialState, startedFor({}))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'invokePiece', continueOnFailure: true })
  })

  it('loop action frame -> enterLoop with resolved items', () => {
    const d = new FlowDecider(trigger(loop('lp', '{{trigger.list}}', codeAct('inner'))))
    const state = d.evolve(d.initialState, startedFor({ list: ['x', 'y'] }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'enterLoop', name: 'lp', items: ['x', 'y'], hasBody: true })
  })

  it('router frame -> enterRouter, EXECUTE_FIRST_MATCH stops at first match', () => {
    const r = router(
      'rt',
      [
        { branchName: 'A', branchType: 'CONDITION', conditions: [{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: '{{trigger.kind}}', secondValue: 'a' }] },
        { branchName: 'fb', branchType: 'FALLBACK' },
      ],
      [piece('in_a'), codeAct('in_fb')],
    )
    const d = new FlowDecider(trigger(r))
    const state = d.evolve(d.initialState, startedFor({ kind: 'a' }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({
      kind: 'enterRouter',
      name: 'rt',
      selected: [0],
      branchResults: [{ branchName: 'A', branchIndex: 0, evaluation: true }],
    })
  })

  it('router fallback is selected when no condition matches', () => {
    const r = router(
      'rt',
      [
        { branchName: 'A', branchType: 'CONDITION', conditions: [{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: '{{trigger.kind}}', secondValue: 'a' }] },
        { branchName: 'fb', branchType: 'FALLBACK' },
      ],
      [piece('in_a'), codeAct('in_fb')],
    )
    const d = new FlowDecider(trigger(r))
    const state = d.evolve(d.initialState, startedFor({ kind: 'z' }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'enterRouter', selected: [1] })
  })

  it('router EXECUTE_ALL_MATCH selects every matching branch', () => {
    const r = router(
      'rt',
      [
        { branchName: 'A', branchType: 'CONDITION', conditions: [{ operator: 'EXISTS', firstValue: '{{trigger.kind}}' }] },
        { branchName: 'B', branchType: 'CONDITION', conditions: [{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: '{{trigger.kind}}', secondValue: 'a' }] },
      ],
      [piece('in_a'), codeAct('in_b')],
      'EXECUTE_ALL_MATCH',
    )
    const d = new FlowDecider(trigger(r))
    const state = d.evolve(d.initialState, startedFor({ kind: 'a' }))
    const [eff] = d.decide(state)
    expect(eff).toMatchObject({ kind: 'enterRouter', selected: [0, 1] })
  })

  it('empty stack -> finish; terminal status -> no effects', () => {
    const d = new FlowDecider(trigger())
    const running: RunState = { status: 'running', steps: {}, stack: [], error: null, duration: 0 }
    expect(d.decide(running)).toEqual([{ kind: 'finish' }])
    expect(d.decide({ ...running, status: 'succeeded' })).toEqual([])
    expect(d.decide({ ...running, status: 'failed' })).toEqual([])
  })
})

// --- evolve() -------------------------------------------------------------

describe('engine FlowDecider.evolve', () => {
  it('started seeds the trigger step and schedules the action chain', () => {
    const d = new FlowDecider(trigger(piece('step_1', {}, {}, codeAct('step_2'))))
    const s = d.evolve(d.initialState, startedFor({ hello: 1 }))
    expect(s.status).toBe('running')
    expect(s.steps.trigger).toMatchObject({ status: StepStatus.SUCCEEDED, output: { hello: 1 } })
    expect(s.stack.map((f) => (f.kind === 'action' ? f.action.name : f.kind))).toEqual(['step_1', 'step_2'])
  })

  it('stepSucceeded records output, pops the frame and accumulates duration', () => {
    const d = new FlowDecider(trigger(piece('step_1')))
    let s = d.evolve(d.initialState, startedFor({}))
    s = d.evolve(s, { type: 'stepSucceeded', name: 'step_1', atype: ActionType.PIECE, input: {}, output: { ok: true }, duration: 12, path: [] })
    expect(s.steps.step_1).toMatchObject({ status: StepStatus.SUCCEEDED, output: { ok: true } })
    expect(s.stack).toHaveLength(0)
    expect(s.duration).toBe(12)
  })

  it('stepFailed without continue stops the run and clears the stack', () => {
    const d = new FlowDecider(trigger(piece('step_1', {}, {}, codeAct('step_2'))))
    let s = d.evolve(d.initialState, startedFor({}))
    s = d.evolve(s, { type: 'stepFailed', name: 'step_1', atype: ActionType.PIECE, input: {}, output: null, duration: 4, errorMessage: 'boom', continued: false, path: [] })
    expect(s.status).toBe('failed')
    expect(s.error).toBe('boom')
    expect(s.stack).toHaveLength(0)
  })

  it('stepFailed with continued keeps running and pops only the failed frame', () => {
    const d = new FlowDecider(trigger(piece('step_1', {}, {}, codeAct('step_2'))))
    let s = d.evolve(d.initialState, startedFor({}))
    s = d.evolve(s, { type: 'stepFailed', name: 'step_1', atype: ActionType.PIECE, input: {}, output: { error: 'boom' }, duration: 4, errorMessage: 'boom', continued: true, path: [] })
    expect(s.status).toBe('running')
    expect(s.stack.map((f) => (f.kind === 'action' ? f.action.name : f.kind))).toEqual(['step_2'])
  })

  it('routerEntered schedules only the selected branch children', () => {
    const r = router(
      'rt',
      [
        { branchName: 'A', branchType: 'CONDITION', conditions: [{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: '{{trigger.kind}}', secondValue: 'a' }] },
        { branchName: 'fb', branchType: 'FALLBACK' },
      ],
      [piece('in_a'), codeAct('in_fb')],
    )
    const d = new FlowDecider(trigger(r))
    let s = d.evolve(d.initialState, startedFor({ kind: 'a' }))
    s = d.evolve(s, { type: 'routerEntered', name: 'rt', input: { branches: ['A', 'fb'] }, branchResults: [{ branchName: 'A', branchIndex: 0, evaluation: true }], selected: [0], path: [] })
    expect(s.stack.map((f) => (f.kind === 'action' ? f.action.name : f.kind))).toEqual(['in_a'])
    expect(s.steps.rt).toMatchObject({ type: ActionType.ROUTER, status: StepStatus.SUCCEEDED })
  })

  it('loopEntered expands per-iteration frames plus a finalize frame', () => {
    const d = new FlowDecider(trigger(loop('lp', '{{trigger.list}}', codeAct('inner'))))
    let s = d.evolve(d.initialState, startedFor({ list: ['x', 'y'] }))
    s = d.evolve(s, { type: 'loopEntered', name: 'lp', itemsExpr: '{{trigger.list}}', items: ['x', 'y'], hasBody: true, path: [] })
    const shape = s.stack.map((f) => (f.kind === 'action' ? `action:${f.action.name}` : f.kind))
    expect(shape).toEqual(['loopIterate', 'action:inner', 'loopIterate', 'action:inner', 'finalizeLoop'])
  })
})

// --- replay determinism ---------------------------------------------------

describe('engine FlowDecider replay determinism', () => {
  const replay = (t: FlowTrigger, events: RunEvent[]): RunState => {
    const d = new FlowDecider(t)
    let s = d.initialState
    for (const ev of events) s = d.evolve(s, ev)
    return s
  }

  it('a linear run rebuilt from its events matches the live run', () => {
    const t = trigger(piece('step_1', { to: '{{trigger.name}}' }, {}, codeAct('step_2', { v: '{{step_1.from}}' })))
    const live = driveSync(new FlowDecider(t), startedFor({ name: 'Ada' }), { name: 'Ada' })

    expect(live.state.status).toBe('succeeded')
    expect(live.events.map((e) => e.type)).toEqual(['started', 'stepSucceeded', 'stepSucceeded', 'finished'])
    expect(live.state.steps.step_1).toMatchObject({ status: StepStatus.SUCCEEDED })
    expect(live.state.duration).toBe(15) // 10 (piece) + 5 (code)

    expect(replay(t, live.events)).toEqual(live.state)
  })

  it('a router run runs only the selected branch and replays identically', () => {
    const r = router(
      'rt',
      [
        { branchName: 'A', branchType: 'CONDITION', conditions: [{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: '{{trigger.kind}}', secondValue: 'a' }] },
        { branchName: 'fb', branchType: 'FALLBACK' },
      ],
      [piece('in_a'), codeAct('in_fb')],
    )
    const t = trigger(r)
    const live = driveSync(new FlowDecider(t), startedFor({ kind: 'a' }), { kind: 'a' })

    expect(live.state.status).toBe('succeeded')
    expect(live.state.steps.in_a).toBeDefined()
    expect(live.state.steps.in_fb).toBeUndefined()
    expect(replay(t, live.events)).toEqual(live.state)
  })

  it('a loop run executes every iteration and replays identically', () => {
    const t = trigger(loop('lp', '{{trigger.list}}', codeAct('inner')))
    const live = driveSync(new FlowDecider(t), startedFor({ list: ['x', 'y'] }), { list: ['x', 'y'] })

    expect(live.state.status).toBe('succeeded')
    expect(live.events.map((e) => e.type)).toEqual([
      'started',
      'loopEntered',
      'loopIterationStarted',
      'stepSucceeded',
      'loopIterationStarted',
      'stepSucceeded',
      'loopFinalized',
      'finished',
    ])
    const lp = live.state.steps.lp
    expect(lp?.status).toBe(StepStatus.SUCCEEDED)
    expect(Object.keys(lp?.iterations ?? {})).toEqual(['0', '1'])
    expect(replay(t, live.events)).toEqual(live.state)
  })
})
