import { randomUUID } from 'node:crypto'
import { and, eq, isNull, SQL } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { pluginStore } from '@/platform/db/schema'
import { Json } from '@/shared/domain/Json'
import {
  PluginStoreRepository,
  PluginStoreRef,
} from '@/contexts/plugins/application/ports/out/PluginStoreRepository'
import { PluginStoreMapper } from '@/contexts/plugins/application/mappers/PluginStoreMapper'
import { PluginStoreEntry } from '@/contexts/plugins/domain/PluginStoreEntry'
import { PluginStoreEntryId } from '@/contexts/plugins/domain/ids'

// Driven adapter backing the framework `Store` a piece reads/writes. Identity is
// (pluginName, scope, scopeId, key). Owns the text<->Json boundary for the
// `value` column. Mirrors the source `context-factory` store upsert/get/delete.
export class DrizzlePluginStoreRepository implements PluginStoreRepository {
  constructor(private readonly db: Database) {}

  nextId(): PluginStoreEntryId {
    return PluginStoreEntryId.of(randomUUID())
  }

  async get(ref: PluginStoreRef): Promise<PluginStoreEntry | null> {
    const [row] = await this.db.select().from(pluginStore).where(this.match(ref)).limit(1)
    if (!row) return null
    return PluginStoreMapper.toDomain({
      id: row.id,
      pluginName: row.pluginName,
      scope: row.scope,
      scopeId: row.scopeId,
      key: row.key,
      value: parseValue(row.value),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  async put(entry: PluginStoreEntry): Promise<void> {
    const row = PluginStoreMapper.toPersistence(entry)
    const value = JSON.stringify(row.value)
    const existing = await this.db
      .select({ id: pluginStore.id })
      .from(pluginStore)
      .where(this.match(row))
      .limit(1)

    const found = existing[0]
    if (found) {
      await this.db
        .update(pluginStore)
        .set({ value, updatedAt: row.updatedAt })
        .where(eq(pluginStore.id, found.id))
    } else {
      await this.db.insert(pluginStore).values({
        id: row.id,
        pluginName: row.pluginName,
        scope: row.scope,
        scopeId: row.scopeId,
        key: row.key,
        value,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    }
  }

  async delete(ref: PluginStoreRef): Promise<void> {
    await this.db.delete(pluginStore).where(this.match(ref))
  }

  private match(ref: PluginStoreRef): SQL | undefined {
    return and(
      eq(pluginStore.pluginName, ref.pluginName),
      eq(pluginStore.scope, ref.scope),
      ref.scopeId === null ? isNull(pluginStore.scopeId) : eq(pluginStore.scopeId, ref.scopeId),
      eq(pluginStore.key, ref.key),
    )
  }
}

function parseValue(raw: string): Json {
  try {
    return JSON.parse(raw) as Json
  } catch {
    return null
  }
}
