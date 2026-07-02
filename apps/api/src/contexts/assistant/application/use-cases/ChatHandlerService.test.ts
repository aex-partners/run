import { describe, it, expect } from 'vitest'
import { JsonObject } from '@/shared/domain/Json'
import { ChatHandlerService } from '@/contexts/assistant/application/use-cases/ChatHandlerService'
import { ChatCommand, ChatEvent } from '@/contexts/assistant/application/ports/in/Chat'
import {
  AgentEvent,
  AgentRunRequest,
  ChatAgentRuntime,
} from '@/contexts/assistant/application/ports/out/ChatAgentRuntime'
import { ConversationGateway } from '@/contexts/assistant/application/ports/out/ConversationGateway'
import { AgentDirectory } from '@/contexts/assistant/application/ports/out/AgentDirectory'
import { SessionStore } from '@/contexts/assistant/application/ports/out/SessionStore'
import { SpendStore } from '@/contexts/assistant/application/ports/out/SpendStore'
import { ConfirmationBroker } from '@/contexts/assistant/application/ports/out/ConfirmationBroker'
import { SubagentRunner } from '@/contexts/assistant/application/ports/out/SubagentRunner'
import { AgentConfig, DEFAULT_AGENT_ID, DEFAULT_MODEL } from '@/contexts/assistant/domain/AgentConfig'
import { SubagentDef } from '@/contexts/assistant/domain/Subagents'

// --- Inline fakes for every out-port. No infra, no streaming SDK. ---

// Replays a scripted list of runtime events. Captures the request so we can assert
// how the orchestration configured the runtime (resume id, model, max turns, ...).
class ScriptedRuntime implements ChatAgentRuntime {
  lastReq?: AgentRunRequest
  constructor(private readonly events: AgentEvent[]) {}
  async *stream(req: AgentRunRequest): AsyncIterable<AgentEvent> {
    this.lastReq = req
    for (const ev of this.events) yield ev
  }
}

// Exercises the confirmation gate: calls req.canUseTool for each probe and records
// the verdict, then emits any trailing events so the run can finish cleanly.
class GateProbeRuntime implements ChatAgentRuntime {
  decisions: Array<{ allow: boolean }> = []
  constructor(
    private readonly probes: Array<{ name: string; input: JsonObject; toolUseId: string }>,
    private readonly events: AgentEvent[] = [],
  ) {}
  async *stream(req: AgentRunRequest): AsyncIterable<AgentEvent> {
    for (const p of this.probes) {
      const d = await req.canUseTool(p.name, p.input, { toolUseId: p.toolUseId })
      this.decisions.push({ allow: d.allow })
    }
    for (const ev of this.events) yield ev
  }
}

class ThrowingRuntime implements ChatAgentRuntime {
  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<AgentEvent> {
    throw new Error('runtime exploded')
  }
}

class FakeConversationGateway implements ConversationGateway {
  userMessages: Array<{ conversationId: string; userId: string; content: string }> = []
  assistantMessages: Array<{ conversationId: string; agentId: string | null; agentName: string; content: string }> = []
  systemMessages: Array<{ conversationId: string; content: string }> = []
  async postUserMessage(i: { conversationId: string; userId: string; content: string }): Promise<void> {
    this.userMessages.push(i)
  }
  async postAssistantMessage(i: {
    conversationId: string
    agentId: string | null
    agentName: string
    content: string
  }): Promise<void> {
    this.assistantMessages.push(i)
  }
  async postSystemMessage(i: { conversationId: string; content: string }): Promise<void> {
    this.systemMessages.push(i)
  }
  async history(): Promise<[]> {
    return []
  }
}

class FakeAgentDirectory implements AgentDirectory {
  resolved: Array<{ conversationId: string; userId: string }> = []
  constructor(private readonly config: AgentConfig) {}
  async resolve(conversationId: string, userId: string): Promise<AgentConfig> {
    this.resolved.push({ conversationId, userId })
    return this.config
  }
}

class FakeSessionStore implements SessionStore {
  store = new Map<string, string>()
  saves: Array<{ conversationId: string; sessionId: string; expectedPrevious?: string | null }> = []
  async getSessionId(conversationId: string): Promise<string | null> {
    return this.store.get(conversationId) ?? null
  }
  async saveSessionId(
    conversationId: string,
    sessionId: string,
    expectedPrevious?: string | null,
  ): Promise<boolean> {
    this.saves.push({ conversationId, sessionId, expectedPrevious })
    const cur = this.store.get(conversationId) ?? null
    if (cur !== (expectedPrevious ?? null)) return false
    this.store.set(conversationId, sessionId)
    return true
  }
  async clearSessionId(conversationId: string): Promise<void> {
    this.store.delete(conversationId)
  }
}

class FakeSpendStore implements SpendStore {
  recorded: Array<{ userId: string; costUsd: number }> = []
  constructor(private readonly today = 0) {}
  async getTodaySpendUsd(): Promise<number> {
    return this.today
  }
  async recordSpend(userId: string, costUsd: number): Promise<void> {
    this.recorded.push({ userId, costUsd })
  }
}

class FakeConfirmationBroker implements ConfirmationBroker {
  requests: Array<{ toolUseId: string; toolName: string; conversationId: string }> = []
  constructor(private readonly verdict = true) {}
  async request(toolUseId: string, toolName: string, conversationId: string): Promise<boolean> {
    this.requests.push({ toolUseId, toolName, conversationId })
    return this.verdict
  }
  resolve(): boolean {
    return true
  }
  cancelForConversation(): void {}
}

class FakeSubagentRunner implements SubagentRunner {
  definitions(): Record<string, SubagentDef> {
    return {}
  }
}

const defaultAgent: AgentConfig = {
  id: DEFAULT_AGENT_ID,
  name: 'Eric',
  systemPrompt: 'You are Eric.',
  modelId: null,
  toolIds: [],
  skillPrompts: [],
}

interface BuildOpts {
  runtime: ChatAgentRuntime
  agent?: AgentConfig
  today?: number
  verdict?: boolean
  priorSession?: { conversationId: string; sessionId: string }
  dailyBudgetUsd?: number
}

function build(opts: BuildOpts) {
  const conversations = new FakeConversationGateway()
  const agents = new FakeAgentDirectory(opts.agent ?? defaultAgent)
  const sessions = new FakeSessionStore()
  if (opts.priorSession) sessions.store.set(opts.priorSession.conversationId, opts.priorSession.sessionId)
  const spend = new FakeSpendStore(opts.today ?? 0)
  const confirmations = new FakeConfirmationBroker(opts.verdict ?? true)
  const subagents = new FakeSubagentRunner()
  const svc = new ChatHandlerService(
    opts.runtime,
    conversations,
    agents,
    sessions,
    spend,
    confirmations,
    subagents,
    opts.dailyBudgetUsd !== undefined ? { dailyBudgetUsd: opts.dailyBudgetUsd } : {},
  )
  return { svc, conversations, agents, sessions, spend, confirmations }
}

async function collect(stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = []
  for await (const ev of stream) out.push(ev)
  return out
}

const cmd: ChatCommand = { conversationId: 'conv-1', userId: 'user-1', prompt: 'hi' }

describe('ChatHandlerService', () => {
  it('runs a full turn: posts both turns, streams events, records spend, claims the session', async () => {
    const runtime = new ScriptedRuntime([
      { type: 'session_init', sessionId: 'sess-1' },
      { type: 'text_delta', delta: 'Hello ' },
      { type: 'text_delta', delta: 'world' },
      { type: 'result', sessionId: 'sess-1', totalCostUsd: 0.02, numTurns: 1 },
    ])
    const { svc, conversations, agents, sessions, spend } = build({ runtime })

    const events = await collect(svc.execute(cmd))

    // Human turn persisted first.
    expect(conversations.userMessages).toEqual([{ conversationId: 'conv-1', userId: 'user-1', content: 'hi' }])
    expect(agents.resolved).toEqual([{ conversationId: 'conv-1', userId: 'user-1' }])

    // session_init carries the resolved agent name.
    expect(events[0]).toEqual({ type: 'session_init', sessionId: 'sess-1', agentName: 'Eric' })
    // Deltas forwarded verbatim.
    expect(events.filter((e) => e.type === 'text_delta')).toEqual([
      { type: 'text_delta', delta: 'Hello ' },
      { type: 'text_delta', delta: 'world' },
    ])
    // Result forwarded.
    expect(events.some((e) => e.type === 'result')).toBe(true)

    // Spend charged from the result cost.
    expect(spend.recorded).toEqual([{ userId: 'user-1', costUsd: 0.02 }])

    // Assistant answer persisted, trimmed, agentId null for the built-in agent.
    expect(conversations.assistantMessages).toEqual([
      { conversationId: 'conv-1', agentId: null, agentName: 'Eric', content: 'Hello world' },
    ])

    // Session claimed (no prior) with expectedPrevious null.
    expect(sessions.saves[0]).toEqual({ conversationId: 'conv-1', sessionId: 'sess-1', expectedPrevious: null })
    expect(await sessions.getSessionId('conv-1')).toBe('sess-1')
  })

  it('configures the runtime request from the agent and resumes a prior session', async () => {
    const agent: AgentConfig = { ...defaultAgent, id: 'agent-x', name: 'Sales', modelId: 'claude-opus-9' }
    const runtime = new ScriptedRuntime([
      { type: 'session_init', sessionId: 'prior' },
      { type: 'text_delta', delta: 'ok' },
      { type: 'result', sessionId: 'prior' },
    ])
    const { svc, conversations } = build({
      runtime,
      agent,
      priorSession: { conversationId: 'conv-1', sessionId: 'prior' },
    })

    await collect(svc.execute(cmd))

    expect(runtime.lastReq?.resumeSessionId).toBe('prior')
    expect(runtime.lastReq?.model).toBe('claude-opus-9')
    expect(runtime.lastReq?.maxTurns).toBe(15)
    expect(runtime.lastReq?.prompt).toBe('hi')
    // Non-default agent persists its id on the answer.
    expect(conversations.assistantMessages[0]?.agentId).toBe('agent-x')
    expect(conversations.assistantMessages[0]?.agentName).toBe('Sales')
  })

  it('falls back to the default model when the agent has none', async () => {
    const runtime = new ScriptedRuntime([{ type: 'result', sessionId: 's' }])
    const { svc } = build({ runtime })
    await collect(svc.execute(cmd))
    expect(runtime.lastReq?.model).toBe(DEFAULT_MODEL)
  })

  it('blocks the turn when the daily budget is exceeded, before touching anything', async () => {
    const runtime = new ScriptedRuntime([{ type: 'text_delta', delta: 'should not run' }])
    const { svc, conversations, agents, spend } = build({ runtime, today: 5, dailyBudgetUsd: 5 })

    const events = await collect(svc.execute(cmd))

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('error')
    if (events[0]?.type === 'error') expect(events[0].message).toContain('Daily AI spend limit reached')
    expect(conversations.userMessages).toHaveLength(0)
    expect(agents.resolved).toHaveLength(0)
    expect(spend.recorded).toHaveLength(0)
  })

  it('drops the accumulated answer on text_reset (stale-session retry)', async () => {
    const runtime = new ScriptedRuntime([
      { type: 'session_init', sessionId: 's' },
      { type: 'text_delta', delta: 'stale answer' },
      { type: 'text_reset', reason: 'session expired' },
      { type: 'text_delta', delta: 'fresh answer' },
      { type: 'result', sessionId: 's' },
    ])
    const { svc, conversations } = build({ runtime })

    await collect(svc.execute(cmd))

    expect(conversations.assistantMessages).toEqual([
      { conversationId: 'conv-1', agentId: null, agentName: 'Eric', content: 'fresh answer' },
    ])
  })

  it('does not persist an empty answer and does not record zero-cost spend', async () => {
    const runtime = new ScriptedRuntime([
      { type: 'session_init', sessionId: 's' },
      { type: 'text_delta', delta: '   ' },
      { type: 'result', sessionId: 's', totalCostUsd: 0 },
    ])
    const { svc, conversations, spend } = build({ runtime })

    await collect(svc.execute(cmd))

    expect(conversations.assistantMessages).toHaveLength(0)
    expect(spend.recorded).toHaveLength(0)
  })

  it('auto-allows read-only tools and gates mutating tools on human confirmation', async () => {
    const runtime = new GateProbeRuntime(
      [
        { name: 'query', input: { sql: 'select 1' }, toolUseId: 'tu-read' },
        { name: 'delete_record', input: { id: 'x' }, toolUseId: 'tu-mut' },
      ],
      [{ type: 'result', sessionId: 's' }],
    )
    const { svc, confirmations } = build({ runtime, verdict: true })

    const events = await collect(svc.execute(cmd))

    // read-only allowed without asking; mutating asked and approved.
    expect(runtime.decisions).toEqual([{ allow: true }, { allow: true }])
    expect(confirmations.requests).toEqual([
      { toolUseId: 'tu-mut', toolName: 'delete_record', conversationId: 'conv-1' },
    ])
    // Exactly one confirmation prompt surfaced to the consumer (for the mutating tool).
    const prompts = events.filter((e) => e.type === 'tool_confirmation_required')
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toMatchObject({ toolUseId: 'tu-mut', toolName: 'delete_record' })
  })

  it('rejects a mutating tool when the human declines confirmation', async () => {
    const runtime = new GateProbeRuntime(
      [{ name: 'delete_record', input: {}, toolUseId: 'tu-mut' }],
      [{ type: 'result', sessionId: 's' }],
    )
    const { svc } = build({ runtime, verdict: false })

    await collect(svc.execute(cmd))

    expect(runtime.decisions).toEqual([{ allow: false }])
  })

  it('emits an error event when the runtime throws', async () => {
    const { svc } = build({ runtime: new ThrowingRuntime() })

    const events = await collect(svc.execute(cmd))

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'error', message: 'runtime exploded' })
  })
})
