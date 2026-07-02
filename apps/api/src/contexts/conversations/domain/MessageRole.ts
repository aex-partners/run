// Who authored a turn. `user` is a human, `ai` an agent, `system` a programmatic
// post (reminders firing, automation notices). Mirrors the source enum.
export type MessageRole = 'user' | 'ai' | 'system'

export const MESSAGE_ROLES: readonly MessageRole[] = ['user', 'ai', 'system']

export const isMessageRole = (v: string): v is MessageRole =>
  (MESSAGE_ROLES as readonly string[]).includes(v)
