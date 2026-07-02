import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { Json } from '@/shared/domain/Json'
import { RunInferenceService } from '@/contexts/assistant/application/use-cases/RunInferenceService'
import { AgentRuntime, AgentPrompt, AgentTurn, ToolCall } from '@/contexts/assistant/application/ports/out/AgentRuntime'
import { ToolBox, ToolDescriptor } from '@/contexts/assistant/application/ports/out/ToolBox'
import { SpendStore } from '@/contexts/assistant/application/ports/out/SpendStore'

const tool = (name: string, input: Json = {}): ToolCall => ({ id: name, name, input })

class ScriptedRuntime implements AgentRuntime {
  calls: { messages: { role: string; content: string }[]; tools: string[] }[] = []
  constructor(private readonly turns: AgentTurn[]) {}
  async run(prompt: AgentPrompt): Promise<AgentTurn> {
    this.calls.push({ messages: prompt.messages.map((m) => ({ ...m })), tools: [...prompt.tools] })
    return this.turns.shift() ?? { text: 'fallback', toolCalls: [] }
  }
}

class FakeToolBox implements ToolBox {
  executed: { name: string; input: Json }[] = []
  constructor(
    private readonly toolNames: string[] = ['query'],
    private readonly descs?: ToolDescriptor[],
  ) {}
  names(): string[] {
    return this.toolNames
  }
  async execute(name: string, input: Json): Promise<Result<Json>> {
    this.executed.push({ name, input })
    return ok({ done: true })
  }
  descriptors(): ToolDescriptor[] {
    return this.descs ?? []
  }
}

class FakeSpendStore implements SpendStore {
  recorded: { userId: string; cost: number }[] = []
  constructor(private readonly today = 0) {}
  async getTodaySpendUsd(): Promise<number> {
    return this.today
  }
  async recordSpend(userId: string, costUsd: number): Promise<void> {
    this.recorded.push({ userId, cost: costUsd })
  }
}

const fixedClock: Clock = { now: () => new Date('2026-06-29T12:00:00Z') }

// Returns a new, later Date on every call (used to trip the wall-clock guard).
class AdvancingClock implements Clock {
  private t: number
  constructor(startMs: number, private readonly step = 1000) {
    this.t = startMs
  }
  now(): Date {
    const d = new Date(this.t)
    this.t += this.step
    return d
  }
}

describe('RunInferenceService', () => {
  it('executes a read-only tool, feeds the result back, returns the final text', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('query', { entity: 'order' })] },
      { text: 'Final answer.', toolCalls: [] },
    ])
    const tools = new FakeToolBox(['query'])
    const svc = new RunInferenceService(runtime, tools, fixedClock)

    const res = await svc.execute({ prompt: 'run it' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.text).toBe('Final answer.')
    expect(res.value.toolCalls).toEqual([{ name: 'query', input: { entity: 'order' } }])
    expect(tools.executed).toHaveLength(1)
    expect(runtime.calls[1].messages.some((m) => m.role === 'tool' && m.content.includes('query ->'))).toBe(true)
  })

  it('seeds a leading system turn from systemPrompt', async () => {
    const runtime = new ScriptedRuntime([{ text: 'ok', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(), fixedClock)

    await svc.execute({ prompt: 'hi', systemPrompt: 'be terse' })

    const first = runtime.calls[0].messages
    expect(first[0]).toEqual({ role: 'system', content: 'be terse' })
    expect(first[1]).toEqual({ role: 'user', content: 'hi' })
  })

  it('uses an explicit allowedTools override instead of the toolbox names', async () => {
    const runtime = new ScriptedRuntime([{ text: 'ok', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(['query']), fixedClock)

    await svc.execute({ prompt: 'hi', allowedTools: ['custom_tool'] })

    expect(runtime.calls[0].tools).toEqual(['custom_tool'])
  })

  it('charges mutating tools and denies once the mutation budget is spent', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('create_entity', { n: 1 }), tool('create_entity', { n: 2 })] },
      { text: 'wrapped up', toolCalls: [] },
    ])
    const tools = new FakeToolBox(['create_entity'])
    const svc = new RunInferenceService(runtime, tools, fixedClock)

    const res = await svc.execute({ prompt: 'create two', maxMutations: 1 })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    // Only the first mutating call executed; the second was denied.
    expect(tools.executed).toHaveLength(1)
    expect(res.value.toolCalls).toHaveLength(1)
    expect(runtime.calls[1].messages.some((m) => m.content.includes('DENIED'))).toBe(true)
  })

  it('denies delete_record in unattended runs regardless of maxMutations', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('delete_record', { id: 'x' })] },
      { text: 'cannot delete', toolCalls: [] },
    ])
    const tools = new FakeToolBox(['delete_record'])
    const svc = new RunInferenceService(runtime, tools, fixedClock)

    const res = await svc.execute({ prompt: 'delete it', maxMutations: 99 })

    expect(res.ok).toBe(true)
    expect(tools.executed).toHaveLength(0)
    expect(runtime.calls[1].messages.some((m) => m.content.includes('delete_record is disabled'))).toBe(true)
  })

  it('uses a read-only descriptor hint so a dynamic tool runs under a zero mutation budget', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('piece_read_thing')] },
      { text: 'read done', toolCalls: [] },
    ])
    const tools = new FakeToolBox(
      ['piece_read_thing'],
      [{ name: 'piece_read_thing', description: 'reads', readOnly: true }],
    )
    const svc = new RunInferenceService(runtime, tools, fixedClock)

    const res = await svc.execute({ prompt: 'read', maxMutations: 0 })

    expect(res.ok).toBe(true)
    expect(tools.executed).toHaveLength(1)
  })

  it('fails safe: without a hint an unknown tool is mutating and denied under a zero budget', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('piece_unknown_thing')] },
      { text: 'denied path', toolCalls: [] },
    ])
    const tools = new FakeToolBox(['piece_unknown_thing']) // no descriptors
    const svc = new RunInferenceService(runtime, tools, fixedClock)

    const res = await svc.execute({ prompt: 'do', maxMutations: 0 })

    expect(res.ok).toBe(true)
    expect(tools.executed).toHaveLength(0)
  })

  it('blocks the run when the daily spend cap is exceeded', async () => {
    const runtime = new ScriptedRuntime([{ text: 'should not run', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(), fixedClock, new FakeSpendStore(10), {
      dailyBudgetUsd: 5,
    })

    const res = await svc.execute({ prompt: 'x', budgetKey: 'user-1' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('Daily AI spend limit reached')
    expect(runtime.calls).toHaveLength(0)
  })

  it('proceeds when under the daily spend cap', async () => {
    const runtime = new ScriptedRuntime([{ text: 'within budget', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(), fixedClock, new FakeSpendStore(1), {
      dailyBudgetUsd: 5,
    })

    const res = await svc.execute({ prompt: 'x', budgetKey: 'user-1' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.text).toBe('within budget')
  })

  it('skips the spend check when no budgetKey is supplied', async () => {
    const runtime = new ScriptedRuntime([{ text: 'ran anyway', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(), fixedClock, new FakeSpendStore(999), {
      dailyBudgetUsd: 5,
    })

    const res = await svc.execute({ prompt: 'x' }) // no budgetKey

    expect(res.ok).toBe(true)
  })

  it('aborts when the wall-clock budget is exceeded before converging', async () => {
    const runtime = new ScriptedRuntime([{ text: 'too slow', toolCalls: [] }])
    const svc = new RunInferenceService(runtime, new FakeToolBox(), new AdvancingClock(0), undefined, {
      maxDurationMs: 0,
    })

    const res = await svc.execute({ prompt: 'x' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('wall-clock budget exceeded')
    expect(runtime.calls).toHaveLength(0)
  })

  it('fails when the tool loop does not converge within maxTurns', async () => {
    const runtime = new ScriptedRuntime(
      Array.from({ length: 5 }, () => ({ text: null, toolCalls: [tool('query')] })),
    )
    const svc = new RunInferenceService(runtime, new FakeToolBox(['query']), fixedClock, undefined, {
      maxTurns: 2,
    })

    const res = await svc.execute({ prompt: 'loop' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('did not converge')
  })
})
