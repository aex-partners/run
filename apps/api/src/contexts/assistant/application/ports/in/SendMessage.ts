import { Result } from '@/shared/kernel/Result'

export interface SendMessageCommand {
  conversationId: string
  text: string
}

export interface SendMessage {
  execute(cmd: SendMessageCommand): Promise<Result<{ reply: string; toolsUsed: string[] }>>
}
