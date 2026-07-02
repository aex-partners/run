// VO. A single turn in a conversation.
export type Role = 'user' | 'assistant' | 'tool'

export class Message {
  constructor(
    public readonly role: Role,
    public readonly content: string,
  ) {}
}
