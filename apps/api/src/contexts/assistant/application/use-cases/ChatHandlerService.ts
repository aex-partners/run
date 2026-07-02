import { Chat, ChatCommand, ChatEvent, ResolveConfirmationCommand } from '@/contexts/assistant/application/ports/in/Chat'
import { ChatAgentRuntime, ToolGate } from '@/contexts/assistant/application/ports/out/ChatAgentRuntime'
import { ConversationGateway } from '@/contexts/assistant/application/ports/out/ConversationGateway'
import { AgentDirectory } from '@/contexts/assistant/application/ports/out/AgentDirectory'
import { SessionStore } from '@/contexts/assistant/application/ports/out/SessionStore'
import { SpendStore } from '@/contexts/assistant/application/ports/out/SpendStore'
import { ConfirmationBroker } from '@/contexts/assistant/application/ports/out/ConfirmationBroker'
import { SubagentRunner } from '@/contexts/assistant/application/ports/out/SubagentRunner'
import { Budget } from '@/contexts/assistant/domain/Budget'
import { classifyTool, normalizeToolName, DEFAULT_ALLOWED_TOOLS } from '@/contexts/assistant/domain/ToolClass'
import { requiresConfirmation } from '@/contexts/assistant/domain/ConfirmationPolicy'
import { DEFAULT_AGENT_ID, DEFAULT_MODEL } from '@/contexts/assistant/domain/AgentConfig'
import { EventChannel } from '@/contexts/assistant/application/use-cases/EventChannel'

const MAX_TURNS = 15 // SDK tool-loop guard, ported from chat-handler.ts

export interface ChatHandlerOptions {
  dailyBudgetUsd?: number
}

// The REAL chat orchestration — the imperative shell around the streaming runtime.
// Same decide -> confirm -> execute -> feed-back shape as SendMessageService, but
// the LLM owns the inner loop (via the SDK) and we surround it with the cross-
// cutting concerns the demo stub omits: a daily spend cap (pure Budget VO),
// human-in-the-loop confirmation of mutating tools (pure ConfirmationPolicy +
// ConfirmationBroker), session resume, and persisting both turns through the
// conversations ACL. Every decision is pure; all IO is behind a port.
export class ChatHandlerService implements Chat {
  private readonly budget: Budget

  constructor(
    private readonly runtime: ChatAgentRuntime,
    private readonly conversations: ConversationGateway,
    private readonly agents: AgentDirectory,
    private readonly sessions: SessionStore,
    private readonly spend: SpendStore,
    private readonly confirmations: ConfirmationBroker,
    private readonly subagents: SubagentRunner,
    opts: ChatHandlerOptions = {},
  ) {
    this.budget = Budget.daily(opts.dailyBudgetUsd ?? 5)
  }

  execute(cmd: ChatCommand): AsyncIterable<ChatEvent> {
    const channel = new EventChannel<ChatEvent>()
    // Fire the orchestration; it pushes to the channel and closes it when done.
    // We don't await it — the caller consumes the channel as the run progresses.
    void this.run(cmd, channel)
    return channel.stream()
  }

  resolveConfirmation(cmd: ResolveConfirmationCommand): boolean {
    return this.confirmations.resolve(cmd.toolUseId, cmd.allowed, cmd.conversationId)
  }

  cancel(conversationId: string): void {
    this.confirmations.cancelForConversation(conversationId)
  }

  private async run(cmd: ChatCommand, channel: EventChannel<ChatEvent>): Promise<void> {
    try {
      // 1. Daily per-user spend cap. Pure Budget VO decides; we just read the total.
      const spent = await this.spend.getTodaySpendUsd(cmd.userId)
      if (this.budget.isExceeded(spent)) {
        channel.push({ type: 'error', message: this.budget.exceededMessage(spent) })
        return
      }

      // 2. Persist the human turn through the conversations ACL.
      await this.conversations.postUserMessage({
        conversationId: cmd.conversationId,
        userId: cmd.userId,
        content: cmd.prompt,
      })

      // 3. Resolve the agent (system prompt, model, tools) and the resumable session.
      const agent = await this.agents.resolve(cmd.conversationId, cmd.userId)
      const priorSessionId = await this.sessions.getSessionId(cmd.conversationId)

      // 4. The confirmation gate: read-only auto-allows, mutating asks the human.
      const gate: ToolGate = async (toolName, input, { toolUseId }) => {
        const cls = classifyTool(toolName)
        if (!requiresConfirmation(cls)) return { allow: true }
        const bare = normalizeToolName(toolName)
        channel.push({
          type: 'tool_confirmation_required',
          toolUseId,
          toolName: bare,
          input,
          description: `Execute ${bare}?`,
        })
        const allowed = await this.confirmations.request(toolUseId, toolName, cmd.conversationId)
        return allowed ? { allow: true } : { allow: false, message: 'User rejected this action.' }
      }

      // 5. Run the streaming agent, mapping runtime events to chat events while
      //    accumulating the final answer and tracking the session id.
      let finalText = ''
      let currentSession = priorSessionId

      for await (const ev of this.runtime.stream({
        prompt: cmd.prompt,
        systemPrompt: agent.systemPrompt,
        model: agent.modelId ?? DEFAULT_MODEL,
        allowedTools: DEFAULT_ALLOWED_TOOLS,
        resumeSessionId: priorSessionId,
        subagents: this.subagents.definitions(),
        maxTurns: MAX_TURNS,
        canUseTool: gate,
      })) {
        switch (ev.type) {
          case 'session_init': {
            // expectedPrevious=null: only claim the session when still empty, so a
            // concurrent turn that already claimed this conversation wins.
            if (!currentSession) {
              const saved = await this.sessions.saveSessionId(cmd.conversationId, ev.sessionId, null)
              if (saved) currentSession = ev.sessionId
            }
            channel.push({ type: 'session_init', sessionId: ev.sessionId, agentName: agent.name })
            break
          }
          case 'text_delta': {
            finalText += ev.delta
            channel.push(ev)
            break
          }
          case 'text_reset': {
            // A stale-session retry restarted the answer; drop what we accumulated.
            finalText = ''
            channel.push(ev)
            break
          }
          case 'result': {
            currentSession = ev.sessionId || currentSession
            if (ev.totalCostUsd && ev.totalCostUsd > 0) {
              this.spend.recordSpend(cmd.userId, ev.totalCostUsd).catch(() => {})
            }
            channel.push(ev)
            break
          }
          default:
            channel.push(ev)
        }
      }

      // 6. Persist the session id if it changed (CAS against the prior value).
      if (currentSession && currentSession !== priorSessionId) {
        await this.sessions.saveSessionId(cmd.conversationId, currentSession, priorSessionId)
      }

      // 7. Persist the agent's answer through the conversations ACL.
      const answer = finalText.trim()
      if (answer) {
        await this.conversations.postAssistantMessage({
          conversationId: cmd.conversationId,
          agentId: agent.id === DEFAULT_AGENT_ID ? null : agent.id,
          agentName: agent.name,
          content: answer,
        })
      }
    } catch (err) {
      channel.push({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      channel.close()
    }
  }
}
