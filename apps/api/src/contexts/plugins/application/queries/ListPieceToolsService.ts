import { ListPieceTools, PieceToolView } from '@/contexts/plugins/application/ports/in/ListPieceTools'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'

// Read-side query. Source `plugins.listPieceTools`: for every INSTALLED plugin,
// load its piece and list each action as a UI tool entry. A piece that fails to
// load is skipped (not installed yet / load error), mirroring the source's
// swallow. Tool name is the unsanitized `${pieceName}:${actionName}`.
export class ListPieceToolsService implements ListPieceTools {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly registry: PieceRegistry,
  ) {}

  async execute(): Promise<PieceToolView[]> {
    const installed = await this.plugins.findInstalled()
    const tools: PieceToolView[] = []

    for (const plugin of installed) {
      const pieceName = plugin.pieceName
      if (!pieceName) continue

      const meta = await this.registry.loadMetadata(pieceName)
      if (!meta) continue

      const logo = plugin.icon && (plugin.icon.startsWith('http') || plugin.icon.startsWith('/')) ? plugin.icon : null

      for (const action of meta.actions) {
        tools.push({
          name: `${pieceName}:${action.name}`,
          displayName: action.displayName ?? action.name,
          description: action.description ?? '',
          pluginName: plugin.name,
          pluginDisplayName: plugin.name,
          pluginLogoUrl: logo,
        })
      }
    }

    return tools
  }
}
