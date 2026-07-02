import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UninstallPlugin, UninstallPluginCommand } from '@/contexts/plugins/application/ports/in/UninstallPlugin'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceInstaller } from '@/contexts/plugins/application/ports/out/PieceInstaller'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Application service. Removes the piece package (BEST-EFFORT: a failed npm
// uninstall is swallowed, mirroring the source) then resets the aggregate to
// `available`. Missing id is a silent no-op.
export class UninstallPluginService implements UninstallPlugin {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly installer: PieceInstaller,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UninstallPluginCommand): Promise<Result<{ success: true }>> {
    const plugin = await this.plugins.findById(PluginId.of(cmd.id))
    if (!plugin) return ok({ success: true })

    if (plugin.pieceName) {
      try {
        await this.installer.uninstall(plugin.pieceName)
      } catch {
        // Best-effort: the package may already be gone; reset the row regardless.
      }
    }

    plugin.uninstall(this.clock.now())
    await this.plugins.save(plugin)
    await this.events.publish(plugin.pullEvents())
    return ok({ success: true })
  }
}
