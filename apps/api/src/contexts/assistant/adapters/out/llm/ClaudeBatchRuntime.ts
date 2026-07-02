import { query, createSdkMcpServer, tool, type CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { Json } from '@/shared/domain/Json'
import { AgentRuntime, AgentPrompt, AgentTurn, ToolCall } from '@/contexts/assistant/application/ports/out/AgentRuntime'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { DEFAULT_MODEL } from '@/contexts/assistant/domain/AgentConfig'

const MCP_SERVER = 'aex'

export interface ClaudeBatchOptions {
  model?: string
  workspaceDir?: string
}

// REAL non-streaming driven adapter for the per-turn `AgentRuntime` port — the
// batch twin of the streaming ClaudeAgentRuntime. Wraps @anthropic-ai/claude-agent-sdk
// `query()` and reuses the SAME `aex` MCP server built from the ToolBox ACL, so the
// model sees the exact same tool catalog + descriptions as the chat path.
//
// CONTRACT (the important bit): `AgentRuntime.run()` is ONE model turn. Its
// consumers (SendMessageService, RunInferenceService) own the tool loop — they
// execute the returned tool calls via the ToolBox ACL, gate them with the domain
// MutationBudget, and feed the results back on the next run() call. So this adapter
// must return PENDING tool calls, not run them itself. It therefore registers the
// MCP tools (for advertisement/descriptions) but denies execution via canUseTool
// and caps the turn at maxTurns: 1 — the model proposes; the use case disposes.
// Executing here instead would double-run every tool and bypass the budget gate.
export class ClaudeBatchRuntime implements AgentRuntime {
  private readonly model: string
  private readonly workspaceDir: string | undefined

  constructor(
    private readonly toolBox: ToolBox,
    opts: ClaudeBatchOptions = {},
  ) {
    this.model = opts.model ?? DEFAULT_MODEL
    this.workspaceDir = opts.workspaceDir
  }

  async run(prompt: AgentPrompt): Promise<AgentTurn> {
    const { system, body } = this.splitSystem(prompt.messages)

    // Deny execution: this adapter only surfaces what the model WANTS to call; the
    // use case executes it through the ToolBox ACL and feeds the result back.
    const canUseTool: CanUseTool = async () => ({
      behavior: 'deny',
      message: 'Tool execution is owned by the orchestrator, not this batch runtime.',
    })

    // The SDK Options type is broad/partly internal; build a loose bag and let
    // `query` validate — the one place the SDK shape leaks (mirrors ClaudeAgentRuntime).
    const options: Record<string, unknown> = {
      model: this.model,
      mcpServers: { [MCP_SERVER]: this.buildMcpServer() },
      allowedTools: this.allowList(prompt.tools),
      canUseTool,
      maxTurns: 1,
      includePartialMessages: false,
    }
    if (system) options.systemPrompt = system
    if (this.workspaceDir) options.cwd = this.workspaceDir

    let text = ''
    const toolCalls: ToolCall[] = []

    // Run the single turn to completion, collecting the assistant text and the
    // tool_use blocks the model emitted (captured before canUseTool denies them).
    for await (const raw of query({ prompt: body, options: options as never })) {
      const message = raw as Record<string, any>
      if (message.type !== 'assistant') continue

      const content = message.message?.content ?? message.content
      if (!Array.isArray(content)) continue

      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          text += block.text
        }
        if (block.type === 'tool_use') {
          toolCalls.push({
            id: (block.id as string) ?? '',
            name: (block.name as string).replace(/^mcp__aex__/, ''),
            input: (block.input ?? {}) as Json,
          })
        }
      }
    }

    // text === null signals a pure tool turn (mirrors StubAgentRuntime); a non-empty
    // string is the model's answer for this turn.
    return { text: text.length > 0 ? text : null, toolCalls }
  }

  // The leading { role: 'system' } message becomes the SDK system param (caveat #2);
  // everything else is rendered into the query prompt. The AgentRuntime port is
  // stateless per call (it receives the full history each time), so we render the
  // transcript rather than thread an SDK session.
  private splitSystem(messages: AgentPrompt['messages']): { system: string | undefined; body: string } {
    const first = messages[0]
    if (first && first.role === 'system') {
      return { system: first.content, body: this.renderPrompt(messages.slice(1)) }
    }
    return { system: undefined, body: this.renderPrompt(messages) }
  }

  private renderPrompt(messages: AgentPrompt['messages']): string {
    const only = messages[0]
    if (messages.length === 1 && only && only.role === 'user') return only.content
    return messages
      .map((m) => {
        const label = m.role === 'tool' ? 'Tool result' : m.role === 'assistant' ? 'Assistant' : 'User'
        return `${label}: ${m.content}`
      })
      .join('\n\n')
  }

  // Advertise every ToolBox tool (registered under the `aex` MCP server) plus any
  // SDK built-ins the caller listed by bare name. Execution is gated by canUseTool.
  private allowList(tools: readonly string[]): string[] {
    const builtins = tools.filter((t) => t.startsWith('mcp__') === false && /^[A-Z]/.test(t))
    return [`mcp__${MCP_SERVER}__*`, ...builtins]
  }

  // Identical MCP catalog to ClaudeAgentRuntime: names + descriptions from the
  // ToolBox ACL, each tool a single passthrough `params` object. The handlers are
  // present for parity but are never reached here (canUseTool denies before run).
  private buildMcpServer() {
    const descriptors =
      this.toolBox.descriptors?.() ?? this.toolBox.names().map((name) => ({ name, description: name }))

    const tools = descriptors.map((d) =>
      tool(
        d.name,
        `${d.description}\n\nPass this tool's arguments as a JSON object in the "params" field.`,
        { params: z.record(z.unknown()).optional() },
        async (args: { params?: Record<string, unknown> }) => {
          const result = await this.toolBox.execute(d.name, (args.params ?? {}) as Json)
          const payload: Json = result.ok ? result.value : { error: result.error }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
            isError: !result.ok,
          }
        },
      ),
    )

    return createSdkMcpServer({ name: MCP_SERVER, version: '1.0.0', tools })
  }
}
