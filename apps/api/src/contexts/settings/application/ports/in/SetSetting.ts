import { Result } from '@/shared/kernel/Result'

// Driving port (admin). Upserts a single setting and records an audit event.
export interface SetSettingCommand {
  key: string
  value: unknown
  actorId: string
  actorEmail?: string | null
}

export interface SetSetting {
  execute(cmd: SetSettingCommand): Promise<Result<{ success: true }>>
}
