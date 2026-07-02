import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { InstallPlugin, InstallPluginCommand } from '@/contexts/plugins/application/ports/in/InstallPlugin'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceInstaller } from '@/contexts/plugins/application/ports/out/PieceInstaller'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Application service. The lifecycle decision lives in the aggregate
// (`beginInstall` guards already-installed/installing and missing-piece). Here we
// persist the `installing` transition immediately, then fire-and-forget the
// piece-package install and record `installed`/`error` when it settles —
// mirroring the source `installPlugin` (status flips to installing now; npm runs
// in the background). Depends ONLY on ports.
export class InstallPluginService implements InstallPlugin {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly installer: PieceInstaller,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: InstallPluginCommand): Promise<Result<{ success: true }>> {
    const plugin = await this.plugins.findById(PluginId.of(cmd.id))
    if (!plugin) return fail(`Plugin not found: ${cmd.id}`)

    const begun = plugin.beginInstall(cmd.userId, this.clock.now())
    if (!begun.ok) return fail(begun.error)
    // Already installed or installing: a no-op, exactly like the source early return.
    if (!begun.value.started) return ok({ success: true })

    const pieceName = plugin.pieceName
    if (!pieceName) return fail('Plugin has no piece name')

    await this.plugins.save(plugin)
    await this.events.publish(plugin.pullEvents())

    // Fire-and-forget: the HTTP call returns while the package installs.
    void this.installer
      .install(pieceName)
      .then(async () => {
        plugin.completeInstall(this.clock.now())
        await this.plugins.save(plugin)
        await this.events.publish(plugin.pullEvents())
      })
      .catch(async (err: unknown) => {
        plugin.failInstall(err instanceof Error ? err.message : String(err), this.clock.now())
        await this.plugins.save(plugin)
        await this.events.publish(plugin.pullEvents())
      })

    return ok({ success: true })
  }
}
