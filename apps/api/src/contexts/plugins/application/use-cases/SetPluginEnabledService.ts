import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SetPluginEnabled, SetPluginEnabledCommand } from '@/contexts/plugins/application/ports/in/SetPluginEnabled'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Application service. Toggles installed <-> disabled. The guard
// ("can't toggle a plugin that isn't installed") lives in the aggregate's
// `setEnabled`. Mirrors the source `setPluginStatus`.
export class SetPluginEnabledService implements SetPluginEnabled {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SetPluginEnabledCommand): Promise<Result<{ success: true }>> {
    const plugin = await this.plugins.findById(PluginId.of(cmd.id))
    if (!plugin) return fail(`Plugin not found: ${cmd.id}`)

    const toggled = plugin.setEnabled(cmd.enabled, this.clock.now())
    if (!toggled.ok) return fail(toggled.error)

    await this.plugins.save(plugin)
    await this.events.publish(plugin.pullEvents())
    return ok({ success: true })
  }
}
