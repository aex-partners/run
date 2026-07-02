import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Driven port. Loads/saves the Plugin install-lifecycle aggregate. `save` is an
// upsert (catalog sync inserts; install/enable/configure update the same row).
export interface PluginRepository {
  nextId(): PluginId
  findById(id: PluginId): Promise<Plugin | null>
  // INSTALLED plugins with a non-null pieceName — the work list for tool
  // discovery / piece-tool listing.
  findInstalled(): Promise<Plugin[]>
  save(plugin: Plugin): Promise<void>
}
