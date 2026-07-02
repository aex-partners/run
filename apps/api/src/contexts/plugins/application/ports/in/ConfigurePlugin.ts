import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Driving port. Source `plugins.configure`: replaces the plugin's config bag.
export interface ConfigurePluginCommand {
  id: string
  config: JsonObject
}

export interface ConfigurePlugin {
  execute(cmd: ConfigurePluginCommand): Promise<Result<{ success: true }>>
}
