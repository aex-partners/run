// A conversation is one of three kinds:
//   dm      - a 1:1 direct message, deduplicated by the unordered user pair.
//   channel - a named multi-member group.
//   ai      - a private conversation backed by an AI agent (e.g. Eric).
export type ConversationType = 'dm' | 'channel' | 'ai'

export const CONVERSATION_TYPES: readonly ConversationType[] = ['dm', 'channel', 'ai']

export const isConversationType = (v: string): v is ConversationType =>
  (CONVERSATION_TYPES as readonly string[]).includes(v)
