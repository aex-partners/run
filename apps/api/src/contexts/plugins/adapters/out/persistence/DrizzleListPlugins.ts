import { Database } from '@/platform/db/client'
import { plugins } from '@/platform/db/schema'
import { JsonObject } from '@/shared/domain/Json'
import { ListPlugins, PluginView } from '@/contexts/plugins/application/ports/in/ListPlugins'
import { PieceRegistry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceAuthProp } from '@/contexts/plugins/domain/PieceAuthProp'

// Driven read-side adapter (CQRS). Answers `plugins.list` with a direct query —
// no aggregate. Returns every plugin row projected to the UI view, enriched with
// the piece's auth field-schema (`authProps`) resolved from the bundled catalog by
// pieceName so the Connect dialog can render a dynamic form.
export class DrizzleListPlugins implements ListPlugins {
  constructor(
    private readonly db: Database,
    private readonly registry: PieceRegistry,
  ) {}

  async execute(): Promise<PluginView[]> {
    const [rows, catalog] = await Promise.all([
      this.db.select().from(plugins),
      this.registry.listCatalog(),
    ])
    const authPropsByPiece = new Map<string, PieceAuthProp[]>()
    for (const entry of catalog) authPropsByPiece.set(entry.pieceName, entry.authProps)
    return rows.map((row) => toView(row, row.pieceName ? authPropsByPiece.get(row.pieceName) : undefined))
  }
}

export function toView(row: typeof plugins.$inferSelect, authProps: PieceAuthProp[] = []): PluginView {
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
    authProps,
    source: row.source,
    sourceUrl: row.sourceUrl,
    status: row.status,
    config: parseConfig(row.config),
    installedAt: row.installedAt,
    installedBy: row.installedBy,
    updatedAt: row.updatedAt,
  }
}

function parseConfig(raw: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as JsonObject) : {}
  } catch {
    return {}
  }
}
