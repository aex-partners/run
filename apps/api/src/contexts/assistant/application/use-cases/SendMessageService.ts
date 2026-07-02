import { Result, ok, fail } from '@/shared/kernel/Result'
import { SendMessage, SendMessageCommand } from '@/contexts/assistant/application/ports/in/SendMessage'
import { ConversationRepository } from '@/contexts/assistant/application/ports/out/ConversationRepository'
import { AgentRuntime } from '@/contexts/assistant/application/ports/out/AgentRuntime'
import { ToolBox } from '@/contexts/assistant/application/ports/out/ToolBox'
import { Conversation } from '@/contexts/assistant/domain/Conversation'
import { ConversationId } from '@/contexts/assistant/domain/ids'

const MAX_TURNS = 8 // tool-loop guard

// The AI tool loop is the SAME shape as the flow interpreter: decide the next
// action (the LLM proposes), perform it through a port (execute the tool via the
// ACL ToolBox), feed the result back, repeat until the model answers in text.
// The decision is the model's; the orchestration and IO confinement are ours.
export class SendMessageService implements SendMessage {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly agent: AgentRuntime,
    private readonly tools: ToolBox,
  ) {}

  async execute(cmd: SendMessageCommand): Promise<Result<{ reply: string; toolsUsed: string[] }>> {
    const conversation =
      (await this.conversations.findById(ConversationId.of(cmd.conversationId))) ??
      Conversation.start(ConversationId.of(cmd.conversationId))

    conversation.append('user', cmd.text)
    const toolsUsed: string[] = []

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const result = await this.agent.run({
        messages: conversation.messages().map((m) => ({ role: m.role, content: m.content })),
        tools: this.tools.names(),
      })

      if (result.toolCalls.length === 0) {
        const reply = result.text ?? ''
        conversation.append('assistant', reply)
        await this.conversations.save(conversation)
        return ok({ reply, toolsUsed })
      }

      for (const call of result.toolCalls) {
        toolsUsed.push(call.name)
        const out = await this.tools.execute(call.name, call.input)
        conversation.append(
          'tool',
          out.ok ? `${call.name} -> ${JSON.stringify(out.value)}` : `${call.name} ERROR: ${out.error}`,
        )
      }
    }

    return fail('SendMessage: tool loop did not converge')
  }
}
