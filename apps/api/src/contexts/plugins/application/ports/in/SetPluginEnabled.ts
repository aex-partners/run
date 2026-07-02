import { Result } from '@/shared/kernel/Result'

// Driving port. Source `plugins.setEnabled`: toggles installed <-> disabled.
export interface SetPluginEnabledCommand {
  id: string
  enabled: boolean
}

export interface SetPluginEnabled {
  execute(cmd: SetPluginEnabledCommand): Promise<Result<{ success: true }>>
}
