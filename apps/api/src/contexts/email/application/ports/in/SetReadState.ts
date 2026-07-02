import { Result } from '@/shared/kernel/Result'

// Driving port behind emails.markRead / markUnread. One use case, the controller
// supplies the target read state.
export interface SetReadStateCommand {
  actorId: string
  ids: string[]
  read: boolean
}

export interface SetReadState {
  execute(cmd: SetReadStateCommand): Promise<Result<{ success: true }>>
}
