import { Result } from '@/shared/kernel/Result'

// Driving port. Source `plugins.install`: flips the plugin to `installing` and
// drives the piece-package install. `userId` is the authenticated installer.
export interface InstallPluginCommand {
  id: string
  userId: string
}

export interface InstallPlugin {
  execute(cmd: InstallPluginCommand): Promise<Result<{ success: true }>>
}
