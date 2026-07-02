import { JsonObject } from '@/shared/domain/Json'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'
import { PluginSource } from '@/contexts/plugins/domain/PluginSource'

// Persistence row: the on-disk shape of the `plugins` table, EXCEPT `config`
// which is the already-parsed JSON object. The repository adapter owns the
// string<->JsonObject boundary for the text column, so the mapper stays pure.
export interface PluginRow {
  id: string
  name: string
  description: string | null
  version: string
  author: string | null
  icon: string | null
  category: string | null
  manifest: string | null
  pieceName: string | null
  authType: string | null
  source: PluginSource
  sourceUrl: string | null
  status: PluginStatus
  config: JsonObject
  installedAt: Date | null
  installedBy: string | null
  updatedAt: Date
}

export const PluginMapper = {
  toPersistence(plugin: Plugin): PluginRow {
    return {
      id: plugin.id.value,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      author: plugin.author,
      icon: plugin.icon,
      category: plugin.category,
      manifest: plugin.manifest,
      pieceName: plugin.pieceName,
      authType: plugin.authType,
      source: plugin.source,
      sourceUrl: plugin.sourceUrl,
      status: plugin.status,
      config: plugin.config,
      installedAt: plugin.installedAt,
      installedBy: plugin.installedBy,
      updatedAt: plugin.updatedAt,
    }
  },

  toDomain(row: PluginRow): Plugin {
    return Plugin.rehydrate({
      id: PluginId.of(row.id),
      name: row.name,
      description: row.description,
      version: row.version,
      author: row.author,
      icon: row.icon,
      category: row.category,
      manifest: row.manifest,
      pieceName: row.pieceName,
      authType: row.authType,
      source: row.source,
      sourceUrl: row.sourceUrl,
      status: row.status,
      config: row.config,
      installedAt: row.installedAt,
      installedBy: row.installedBy,
      updatedAt: row.updatedAt,
    })
  },
}
