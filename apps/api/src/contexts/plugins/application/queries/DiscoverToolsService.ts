import { DiscoverTools } from '@/contexts/plugins/application/ports/in/DiscoverTools'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceToolset, PieceToolDescriptor, InstalledPiece } from '@/contexts/plugins/domain/PieceToolset'

// Read-side query behind the DiscoverTools in-port (consumed by assistant /
// automation via an ACL). Source `ai/piece-tools.ts` (buildPieceTools): collect
// every INSTALLED piece's metadata, then derive the de-duplicated tool list with
// the PURE PieceToolset rules (classify / sanitize / dedupe / JSON-Schema). A
// piece that fails to load is skipped.
export class DiscoverToolsService implements DiscoverTools {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly registry: PieceRegistry,
  ) {}

  async execute(): Promise<PieceToolDescriptor[]> {
    const installed = await this.plugins.findInstalled()
    const pieces: InstalledPiece[] = []

    for (const plugin of installed) {
      const pieceName = plugin.pieceName
      if (!pieceName) continue

      const meta = await this.registry.loadMetadata(pieceName)
      if (!meta) continue

      const logo = plugin.icon && (plugin.icon.startsWith('http') || plugin.icon.startsWith('/')) ? plugin.icon : null
      pieces.push({ pluginName: plugin.name, pluginLogoUrl: logo, meta })
    }

    return PieceToolset.buildToolDescriptors(pieces)
  }
}
