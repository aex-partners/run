import { JsonObject } from '@/shared/domain/Json'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'
import { PluginSource } from '@/contexts/plugins/domain/PluginSource'
import { PieceAuthProp } from '@/contexts/plugins/domain/PieceAuthProp'

// Read side (CQRS). The plugin row as the UI consumes it. Mirrors `plugins.list`
// (the full row) and `plugins.getById` (one row), so a single view serves both.
export interface PluginView {
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
  // The piece's auth field-schema, resolved from the bundled catalog by pieceName
  // so the Connect dialog can render a dynamic form. Empty when the piece declares
  // no props (or is not in the catalog).
  authProps: PieceAuthProp[]
  source: PluginSource
  sourceUrl: string | null
  status: PluginStatus
  config: JsonObject
  installedAt: Date | null
  installedBy: string | null
  updatedAt: Date
}

// Driving (read) port for `plugins.list`.
export interface ListPlugins {
  execute(): Promise<PluginView[]>
}
