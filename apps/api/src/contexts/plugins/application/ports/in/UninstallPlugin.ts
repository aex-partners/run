import { Result } from '@/shared/kernel/Result'

// Driving port. Source `plugins.uninstall`: removes the piece package
// (best-effort) and resets the plugin to `available`.
export interface UninstallPluginCommand {
  id: string
}

export interface UninstallPlugin {
  execute(cmd: UninstallPluginCommand): Promise<Result<{ success: true }>>
}
