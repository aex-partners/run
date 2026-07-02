import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { SyncRegistry } from '@/contexts/plugins/application/ports/in/SyncRegistry'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { Plugin, CatalogUpsertProps } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Application service. Upserts the bundled catalog into the plugins table: new
// entries are created `available`; existing rows get refreshed metadata while
// PRESERVING status/config/install info (the aggregate enforces that split).
// Mirrors the source `syncPieceCatalog`.
export class SyncRegistryService implements SyncRegistry {
  constructor(
    private readonly plugins: PluginRepository,
    private readonly registry: PieceRegistry,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<Result<{ synced: number }>> {
    const entries = await this.registry.listCatalog()
    let synced = 0

    for (const entry of entries) {
      const props = this.toUpsertProps(entry)
      const existing = await this.plugins.findById(PluginId.of(entry.id))
      if (existing) {
        existing.applyCatalogMetadata(props)
        await this.plugins.save(existing)
      } else {
        await this.plugins.save(Plugin.fromCatalog(PluginId.of(entry.id), props))
      }
      synced++
    }

    return ok({ synced })
  }

  private toUpsertProps(entry: PieceCatalogEntry): CatalogUpsertProps {
    return {
      name: entry.name,
      description: entry.description,
      version: entry.version,
      category: entry.category,
      pieceName: entry.pieceName,
      authType: entry.authType,
      icon: entry.icon,
      source: entry.source,
      manifest: entry.manifest,
      now: this.clock.now(),
    }
  }
}
