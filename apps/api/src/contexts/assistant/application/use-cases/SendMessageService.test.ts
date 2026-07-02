import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { Json } from '@/shared/domain/Json'
import { SendMessageService } from '@/contexts/assistant/application/use-cases/SendMessageService'
import { AgentRuntime, AgentPrompt, AgentTurn, ToolCall } from '@/contexts/assistant/application/ports/out/AgentRuntime'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { ConversationRepository } from '@/contexts/assistant/application/ports/out/ConversationRepository'
import { Conversation } from '@/contexts/assistant/domain/Conversation'
import { ConversationId } from '@/contexts/assistant/domain/ids'

const tool = (name: string, input: Json = {}): ToolCall => ({ id: name, name, input })

// Replays a scripted sequence of turns; snapshots the prompt at call time (the
// service mutates the message array across turns, so a live reference would lie).
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
    private readonly result: Result<Json> = ok({ rows: [] }),
  ) {}
  names(): string[] {
    return this.toolNames
  }
  async execute(name: string, input: Json): Promise<Result<Json>> {
    this.executed.push({ name, input })
    return this.result
  }
}

class FakeConversationRepo implements ConversationRepository {
  saved: Conversation | null = null
  constructor(private readonly existing: Conversation | null = null) {}
  async findById(): Promise<Conversation | null> {
    return this.existing
  }
  async save(c: Conversation): Promise<void> {
    this.saved = c
  }
}

describe('SendMessageService', () => {
  it('drives the loop: executes a tool, feeds the result back, returns the final text', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('query', { entity: 'order' })] },
      { text: 'You have 3 orders.', toolCalls: [] },
    ])
    const tools = new FakeToolBox(['query'], ok({ count: 3 }))
    const repo = new FakeConversationRepo()
    const svc = new SendMessageService(repo, runtime, tools)

    const res = await svc.execute({ conversationId: 'c1', text: 'how many orders?' })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.reply).toBe('You have 3 orders.')
    expect(res.value.toolsUsed).toEqual(['query'])

    // Tool was actually executed via the ToolBox.
    expect(tools.executed).toEqual([{ name: 'query', input: { entity: 'order' } }])

    // The second model turn saw the tool result fed back as a tool message.
    expect(runtime.calls[1].messages.some((m) => m.role === 'tool' && m.content.includes('query ->'))).toBe(true)

    // Final conversation persisted with the assistant reply.
    expect(repo.saved).not.toBeNull()
    const roles = repo.saved!.messages().map((m) => m.role)
    expect(roles).toEqual(['user', 'tool', 'assistant'])
  })

  it('passes the toolbox names to the runtime', async () => {
    const runtime = new ScriptedRuntime([{ text: 'hi', toolCalls: [] }])
    const tools = new FakeToolBox(['query', 'list_entities'])
    const svc = new SendMessageService(new FakeConversationRepo(), runtime, tools)

    await svc.execute({ conversationId: 'c1', text: 'hello' })

    expect(runtime.calls[0].tools).toEqual(['query', 'list_entities'])
  })

  it('continues an existing conversation loaded from the repository', async () => {
    const existing = Conversation.start(ConversationId.of('c1'))
    existing.append('user', 'earlier question')
    existing.append('assistant', 'earlier answer')
    const runtime = new ScriptedRuntime([{ text: 'follow-up answer', toolCalls: [] }])
    const repo = new FakeConversationRepo(existing)
    const svc = new SendMessageService(repo, runtime, new FakeToolBox())

    const res = await svc.execute({ conversationId: 'c1', text: 'follow up' })

    expect(res.ok).toBe(true)
    // The prior history was carried into the model call.
    expect(runtime.calls[0].messages.map((m) => m.content)).toContain('earlier answer')
  })

  it('records the error string when a tool fails but keeps looping', async () => {
    const runtime = new ScriptedRuntime([
      { text: null, toolCalls: [tool('query')] },
      { text: 'done despite failure', toolCalls: [] },
    ])
    const failingTools: ToolBox = {
      names: () => ['query'],
      execute: async () => ({ ok: false as const, error: 'boom' }),
    }
    const svc = new SendMessageService(new FakeConversationRepo(), runtime, failingTools)

    const res = await svc.execute({ conversationId: 'c1', text: 'x' })

    expect(res.ok).toBe(true)
    expect(runtime.calls[1].messages.some((m) => m.content.includes('query ERROR: boom'))).toBe(true)
  })

  it('fails when the tool loop never converges', async () => {
    // Always asks for a tool; the MAX_TURNS guard eventually gives up.
    const neverEnding: AgentTurn[] = Array.from({ length: 20 }, () => ({
      text: null,
      toolCalls: [tool('query')],
    }))
    const runtime = new ScriptedRuntime(neverEnding)
    const svc = new SendMessageService(new FakeConversationRepo(), runtime, new FakeToolBox())

    const res = await svc.execute({ conversationId: 'c1', text: 'loop forever' })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('did not converge')
  })
})
