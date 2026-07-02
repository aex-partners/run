import { Json } from '@/shared/domain/Json'
import { PluginStoreEntry } from '@/contexts/plugins/domain/PluginStoreEntry'
import { PluginStoreEntryId } from '@/contexts/plugins/domain/ids'
import { PluginStoreScope } from '@/contexts/plugins/domain/PluginStoreScope'

// Persistence row for `plugin_store`, EXCEPT `value` which is the already-parsed
// JSON. The repository adapter owns the string<->Json boundary for the text
// column.
export interface PluginStoreRow {
  id: string
  pluginName: string
  scope: PluginStoreScope
  scopeId: string | null
  key: string
  value: Json
  createdAt: Date
  updatedAt: Date
}

export const PluginStoreMapper = {
  toPersistence(entry: PluginStoreEntry): PluginStoreRow {
    return {
      id: entry.id.value,
      pluginName: entry.pluginName,
      scope: entry.scope,
      scopeId: entry.scopeId,
      key: entry.key,
      value: entry.value,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  },

  toDomain(row: PluginStoreRow): PluginStoreEntry {
    return PluginStoreEntry.rehydrate({
      id: PluginStoreEntryId.of(row.id),
      pluginName: row.pluginName,
      scope: row.scope,
      scopeId: row.scopeId,
      key: row.key,
      value: row.value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
