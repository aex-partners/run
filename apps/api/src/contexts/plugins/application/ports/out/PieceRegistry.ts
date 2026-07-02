import { Json } from '@/shared/domain/Json'
import { PieceMetadata } from '@/contexts/plugins/domain/PieceMetadata'
import { PieceAuthProp } from '@/contexts/plugins/domain/PieceAuthProp'
import { PluginSource } from '@/contexts/plugins/domain/PluginSource'

// One entry of the bundled piece catalog, projected to the fields the registry
// sync needs plus the verbatim `raw` JSON the `catalog` procedure returns. The
// adapter owns the catalog schema and computes `manifest` (the stringified entry
// when it declares tools). Mirrors the source `PieceCatalogEntry`.
export interface PieceCatalogEntry {
  id: string
  name: string
  description: string | null
  version: string
  category: string | null
  pieceName: string
  authType: string | null
  // The auth field-schema a LOCAL piece declares (catalog `auth.props`), so the
  // Connect dialog can render a dynamic form. Empty for pieces without it.
  authProps: PieceAuthProp[]
  icon: string | null
  source: PluginSource
  manifest: string | null
  raw: Json
}

// Driven port: load piece metadata from the framework/registry. `loadMetadata`
// dynamically resolves an installed piece package and projects it onto the pure
// domain model (source `piece-loader.ts` + the metadata read in `piece-tools.ts`).
// `listCatalog` reads the bundled catalog (source `piece-registry.ts`).
export interface PieceRegistry {
  loadMetadata(pieceName: string): Promise<PieceMetadata | null>
  listCatalog(): Promise<PieceCatalogEntry[]>
}
