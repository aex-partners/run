import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { plugins } from '@/platform/db/schema'
import { JsonObject } from '@/shared/domain/Json'
import { PluginRepository } from '@/contexts/plugins/application/ports/out/PluginRepository'
import { PluginMapper, PluginRow } from '@/contexts/plugins/application/mappers/PluginMapper'
import { Plugin } from '@/contexts/plugins/domain/Plugin'
import { PluginId } from '@/contexts/plugins/domain/ids'

// Driven adapter. Stores the Plugin aggregate in the `plugins` table. Owns the
// text<->JsonObject boundary for the `config` column (the aggregate holds the
// parsed object). `save` is an upsert so catalog sync (insert) and the lifecycle
// transitions (update) share one path.
export class DrizzlePluginRepository implements PluginRepository {
  constructor(private readonly db: Database) {}

  nextId(): PluginId {
    return PluginId.of(randomUUID())
  }

  async findById(id: PluginId): Promise<Plugin | null> {
    const [row] = await this.db.select().from(plugins).where(eq(plugins.id, id.value)).limit(1)
    if (!row) return null
    return PluginMapper.toDomain(this.toRow(row))
  }

  async findInstalled(): Promise<Plugin[]> {
    const rows = await this.db.select().from(plugins).where(eq(plugins.status, 'installed'))
    return rows.map((row) => PluginMapper.toDomain(this.toRow(row)))
  }

  async save(plugin: Plugin): Promise<void> {
    const row = PluginMapper.toPersistence(plugin)
    const config = JSON.stringify(row.config)
    await this.db
      .insert(plugins)
      .values({
        id: row.id,
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
        config,
        installedAt: row.installedAt,
        installedBy: row.installedBy,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: plugins.id,
        set: {
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
          config,
          installedAt: row.installedAt,
          installedBy: row.installedBy,
          updatedAt: row.updatedAt,
        },
      })
  }

  private toRow(row: typeof plugins.$inferSelect): PluginRow {
    return {
      id: row.id,
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
      config: parseConfig(row.config),
      installedAt: row.installedAt,
      installedBy: row.installedBy,
      updatedAt: row.updatedAt,
    }
  }
}

// Tolerant read of the text `config` column: parse JSON, fall back to `{}`.
function parseConfig(raw: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as JsonObject) : {}
  } catch {
    return {}
  }
}
