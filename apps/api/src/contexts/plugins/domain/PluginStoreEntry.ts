import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Json } from '@/shared/domain/Json'
import { PluginStoreEntryId } from '@/contexts/plugins/domain/ids'
import { PluginStoreScope } from '@/contexts/plugins/domain/PluginStoreScope'

interface PluginStoreEntryProps {
  pluginName: string
  scope: PluginStoreScope
  scopeId: string | null
  key: string
  value: Json
  createdAt: Date
  updatedAt: Date
}

export interface CreatePluginStoreEntryProps {
  id: PluginStoreEntryId
  pluginName: string
  scope: PluginStoreScope
  scopeId: string | null
  key: string
  value: Json
  now: Date
}

export interface RehydratePluginStoreEntryProps {
  id: PluginStoreEntryId
  pluginName: string
  scope: PluginStoreScope
  scopeId: string | null
  key: string
  value: Json
  createdAt: Date
  updatedAt: Date
}

// AGGREGATE. A single key/value entry in a piece's store, scoped to a project or
// a flow. Pieces read/write this from their action & trigger contexts (the
// `Store` the framework hands them). The KV is just data — the only rule is that
// identity is `(pluginName, scope, scopeId, key)`, owned by the repository.
export class PluginStoreEntry extends AggregateRoot<PluginStoreEntryId> {
  private constructor(
    id: PluginStoreEntryId,
    private props: PluginStoreEntryProps,
  ) {
    super(id)
  }

  static create(input: CreatePluginStoreEntryProps): PluginStoreEntry {
    return new PluginStoreEntry(input.id, {
      pluginName: input.pluginName,
      scope: input.scope,
      scopeId: input.scopeId,
      key: input.key,
      value: input.value,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  static rehydrate(input: RehydratePluginStoreEntryProps): PluginStoreEntry {
    return new PluginStoreEntry(input.id, {
      pluginName: input.pluginName,
      scope: input.scope,
      scopeId: input.scopeId,
      key: input.key,
      value: input.value,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
  }

  get pluginName(): string {
    return this.props.pluginName
  }
  get scope(): PluginStoreScope {
    return this.props.scope
  }
  get scopeId(): string | null {
    return this.props.scopeId
  }
  get key(): string {
    return this.props.key
  }
  get value(): Json {
    return this.props.value
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // PURE. Overwrite the stored value (an upsert's update half).
  setValue(value: Json, now: Date): void {
    this.props.value = value
    this.props.updatedAt = now
  }
}
