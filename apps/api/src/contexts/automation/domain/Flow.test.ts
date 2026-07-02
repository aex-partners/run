import { describe, it, expect } from 'vitest'
import { Flow } from '@/contexts/automation/domain/Flow'
import { Step } from '@/contexts/automation/domain/Step'
import { FlowId } from '@/contexts/automation/domain/ids'

const id = FlowId.of('flow-1')

describe('Flow.create graph validation', () => {
  it('accepts a well-formed graph and resolves steps by id', () => {
    const steps: Step[] = [
      { id: 'a', type: 'piece', pieceId: 'http', action: 'get', input: {}, next: 'b' },
      { id: 'b', type: 'complete', output: null },
    ]
    const r = Flow.create(id, 'ok', 'a', steps)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.entryStepId).toBe('a')
    expect(r.value.getStep('a')?.type).toBe('piece')
    expect(r.value.getStep('missing')).toBeNull()
  })

  it('rejects a duplicate step id', () => {
    const steps: Step[] = [
      { id: 'a', type: 'complete', output: 1 },
      { id: 'a', type: 'complete', output: 2 },
    ]
    const r = Flow.create(id, 'dup', 'a', steps)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('duplicate step id')
  })

  it('rejects a missing entry step', () => {
    const steps: Step[] = [{ id: 'a', type: 'complete', output: 1 }]
    const r = Flow.create(id, 'no-entry', 'ghost', steps)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entry step')
  })

  it('rejects a piece "next" that points to an unknown step', () => {
    const steps: Step[] = [{ id: 'a', type: 'piece', pieceId: 'p', action: 'x', input: {}, next: 'nope' }]
    const r = Flow.create(id, 'bad-next', 'a', steps)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('unknown step "nope"')
  })

  it('rejects a router branch "goto" that points to an unknown step', () => {
    const steps: Step[] = [
      { id: 'r', type: 'router', branches: [{ whenVar: 'x', equals: 1, goto: 'ghost' }], otherwise: null },
    ]
    const r = Flow.create(id, 'bad-goto', 'r', steps)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('unknown step "ghost"')
  })

  it('rejects a router "otherwise" that points to an unknown step', () => {
    const steps: Step[] = [
      { id: 'r', type: 'router', branches: [], otherwise: 'ghost' },
    ]
    const r = Flow.create(id, 'bad-otherwise', 'r', steps)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('unknown step "ghost"')
  })

  it('allows null jump targets (terminal next / otherwise)', () => {
    const steps: Step[] = [
      { id: 'a', type: 'piece', pieceId: 'p', action: 'x', input: {}, next: null },
      { id: 'r', type: 'router', branches: [], otherwise: null },
    ]
    const r = Flow.create(id, 'terminal', 'a', steps)
    expect(r.ok).toBe(true)
  })
})
