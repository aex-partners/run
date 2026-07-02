import { Result } from '@/shared/kernel/Result'

// Driving port backing the pin / favorite / mute procedures, which are identical
// toggles over a personal per-member flag. The controller maps each procedure to
// the matching flag; the result echoes the new value under the same key.
export type ConversationFlag = 'pinned' | 'favorite' | 'muted'

export interface ToggleConversationFlagCommand {
  id: string
  userId: string
  flag: ConversationFlag
}

export interface ToggleConversationFlag {
  execute(cmd: ToggleConversationFlagCommand): Promise<Result<{ flag: ConversationFlag; value: boolean }>>
}
