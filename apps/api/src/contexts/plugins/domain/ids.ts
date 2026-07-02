import { Identifier } from '@/shared/kernel/Identifier'

// Identity of an installed/available plugin row (the install-lifecycle aggregate).
export class PluginId extends Identifier {
  static of(value: string): PluginId {
    return new PluginId(value)
  }
}

// Identity of a single plugin-store KV entry (project/flow scoped).
export class PluginStoreEntryId extends Identifier {
  static of(value: string): PluginStoreEntryId {
    return new PluginStoreEntryId(value)
  }
}
