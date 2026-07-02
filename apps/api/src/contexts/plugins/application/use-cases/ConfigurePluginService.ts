import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ConfigurePlugin, ConfigurePluginCommand } from '@/contexts/plugins/application/ports/in/ConfigurePlugin'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Application service. Replaces the plugin's config bag (source `configurePlugin`).
// Missing id is a silent no-op (the source update simply matches zero rows).
export class ConfigurePluginService implements ConfigurePlugin {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ConfigurePluginCommand): Promise<Result<{ success: true }>> {
    const plugin = await this.plugins.findById(PluginId.of(cmd.id))
    if (!plugin) return ok({ success: true })

    plugin.configure(cmd.config, this.clock.now())
    await this.plugins.save(plugin)
    await this.events.publish(plugin.pullEvents())
    return ok({ success: true })
  }
}
