import { PluginStoreEntry } from '@/contexts/plugins/domain/PluginStoreEntry'
import { PluginStoreEntryId } from '@/contexts/plugins/domain/ids'
import { PluginStoreScope } from '@/contexts/plugins/domain/PluginStoreScope'

// Identity of one KV entry: a piece's store is keyed by
// (pluginName, scope, scopeId, key). The flow scope carries a scopeId (the flow
// id); the project scope leaves it null.
export interface PluginStoreRef {
  pluginName: string
  scope: PluginStoreScope
  scopeId: string | null
  key: string
}

// Driven port backing the framework `Store` a piece reads/writes from its action
// & trigger contexts. Mirrors the source `plugin_store` upsert/get/delete.
export interface PluginStoreRepository {
  nextId(): PluginStoreEntryId
  get(ref: PluginStoreRef): Promise<PluginStoreEntry | null>
  put(entry: PluginStoreEntry): Promise<void>
  delete(ref: PluginStoreRef): Promise<void>
}
