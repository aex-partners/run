import { query, createSdkMcpServer, tool, type CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { Json, JsonObject } from '@/shared/domain/Json'
import {
  ChatAgentRuntime,
  AgentEvent,
  AgentRunRequest,
} from '@/contexts/assistant/application/ports/out/ChatAgentRuntime'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { SubagentDef } from '@/contexts/assistant/domain/Subagents'

const MCP_SERVER = 'aex'

// REAL driven adapter for the streaming LLM port. Wraps @anthropic-ai/claude-agent-sdk
// `query()`. The SDK owns the inner tool loop; this adapter:
//   - builds ONE SDK MCP server ("aex") whose tools are the assistant's ToolBox ACL
//     (so the AI reaches every other context's in-port without importing it),
//   - translates the use case's ToolGate into the SDK's canUseTool (confirmation),
//   - maps the SDK's streamed messages into our transport-agnostic AgentEvents,
//   - handles the stale-session retry (resume a session the runtime no longer has).
//
// Tool input fidelity: the ToolBox ACL carries names + descriptions, not per-param
// schemas, so each tool is registered with a single passthrough `params` object.
// The LLM is told (via the description) to place the tool arguments there; the
// handler forwards them verbatim to ToolBox.execute. A future richer ToolBox
// descriptor (JSON schema per tool) can replace the passthrough without touching
// the port or the use case.
export class ClaudeAgentRuntime implements ChatAgentRuntime {
  constructor(
    private readonly toolBox: ToolBox,
    private readonly workspaceDir?: string,
  ) {}

  async *stream(req: AgentRunRequest): AsyncGenerator<AgentEvent> {
    const mcpServer = this.buildMcpServer()

    const canUseTool: CanUseTool = async (toolName, input, options) => {
      const decision = await req.canUseTool(toolName, input as JsonObject, { toolUseId: options.toolUseID })
      return decision.allow
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: decision.message }
    }

    // The SDK's Options type is broad and partly internal; we build it as a loose
    // bag and let `query` validate. This is the one place the SDK shape leaks.
    const options: Record<string, unknown> = {
      systemPrompt: req.systemPrompt,
      model: req.model,
      mcpServers: { [MCP_SERVER]: mcpServer },
      allowedTools: [...req.allowedTools],
      agents: this.buildAgents(req.subagents),
      canUseTool,
      maxTurns: req.maxTurns,
      includePartialMessages: true,
      thinking: { type: 'adaptive' },
    }
    if (this.workspaceDir) options.cwd = this.workspaceDir
    if (req.resumeSessionId) options.resume = req.resumeSessionId

    yield* this.runWithRetry(req, options, !!req.resumeSessionId)
  }

  private async *runWithRetry(
    req: AgentRunRequest,
    options: Record<string, unknown>,
    hadResume: boolean,
  ): AsyncGenerator<AgentEvent> {
    try {
      yield* this.mapAttempt(query({ prompt: req.prompt, options: options as never }))
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (!(hadResume && msg.includes('No conversation found with session ID'))) {
        throw err
      }
      // Stale session (container redeployed and wiped its session store): drop
      // resume and retry, telling the consumer to reset what it accumulated.
      delete options.resume
      yield { type: 'text_reset', reason: 'stale-session-retry' }
      yield* this.mapAttempt(query({ prompt: req.prompt, options: options as never }))
    }
  }

  // Maps one SDK query stream into AgentEvents. Ported from chat-handler.ts's main
  // `for await` loop. Per-attempt state is local so a retry starts clean.
  private async *mapAttempt(stream: AsyncIterable<unknown>): AsyncGenerator<AgentEvent> {
    let textFromStreaming = false
    const streamingToolInputs = new Map<string, { name: string; json: string }>()
    const sentToolIds = new Set<string>()

    for await (const raw of stream) {
      // SDK messages are a wide discriminated union; the source navigates them
      // structurally, so we mirror that with a loose view.
      const message = raw as Record<string, any>


      // Session init
      if (message.type === 'system' && message.subtype === 'init') {
        yield { type: 'session_init', sessionId: message.session_id as string }
        continue
      }

      // Streaming deltas
      if (message.type === 'stream_event') {
        const event = message.event
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          textFromStreaming = true
          yield { type: 'text_delta', delta: event.delta.text }
        }
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'thinking_delta') {
          yield { type: 'thinking_delta', delta: event.delta.thinking }
        }
        if (event?.type === 'content_block_start' && event?.content_block?.type === 'tool_use') {
          const toolId = event.content_block.id as string
          const toolName = (event.content_block.name as string).replace(/^mcp__aex__/, '')
          streamingToolInputs.set(toolId, { name: toolName, json: '' })
        }
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'input_json_delta') {
          for (const [id, data] of streamingToolInputs) {
            if (!sentToolIds.has(id)) {
              data.json += event.delta.partial_json ?? ''
              break
            }
          }
        }
        if (event?.type === 'content_block_stop') {
          for (const [id, data] of streamingToolInputs) {
            if (!sentToolIds.has(id)) {
              let parsedInput: JsonObject = {}
              try {
                parsedInput = JSON.parse(data.json || '{}') as JsonObject
              } catch {
                /* empty */
              }
              sentToolIds.add(id)
              yield { type: 'tool_start', toolUseId: id, toolName: data.name, input: parsedInput }
              break
            }
          }
        }
        continue
      }

      // Complete assistant message (non-streaming fallback)
      if (message.type === 'assistant') {
        const content = message.message?.content ?? message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text && !textFromStreaming) {
              yield { type: 'text_delta', delta: block.text }
            }
            if (block.type === 'tool_use' && !sentToolIds.has(block.id)) {
              sentToolIds.add(block.id)
              yield {
                type: 'tool_start',
                toolUseId: block.id,
                toolName: (block.name as string).replace(/^mcp__aex__/, ''),
                input: (block.input ?? {}) as JsonObject,
              }
            }
          }
        }
        continue
      }

      // Tool results (the SDK delivers them as user-role messages)
      if (message.type === 'user') {
        const content = message.message?.content ?? message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              yield {
                type: 'tool_result',
                toolUseId: block.tool_use_id,
                result: (block.content ?? null) as Json,
                isError: block.is_error ?? false,
              }
            }
          }
        }
        continue
      }

      // Tool result delivered directly
      if (message.type === 'tool_result') {
        yield {
          type: 'tool_result',
          toolUseId: message.tool_use_id ?? message.id ?? '',
          result: (message.content ?? message.output ?? null) as Json,
          isError: message.is_error ?? false,
        }
        continue
      }

      // Final result
      if (message.type === 'result') {
        yield {
          type: 'result',
          sessionId: (message.session_id as string) ?? '',
          totalCostUsd: message.total_cost_usd,
          numTurns: message.num_turns,
        }
      }
    }
  }

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

  private buildAgents(defs: Record<string, SubagentDef>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [name, d] of Object.entries(defs)) {
      out[name] = { description: d.description, prompt: d.prompt, tools: d.tools, model: d.model }
    }
    return out
  }
}
