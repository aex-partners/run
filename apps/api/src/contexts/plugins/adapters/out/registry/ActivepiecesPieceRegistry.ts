import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PropertyType } from '@activepieces/pieces-framework'
import { Json } from '@/shared/domain/Json'
import { PieceRegistry, PieceCatalogEntry } from '@/contexts/plugins/application/ports/out/PieceRegistry'
import { PieceMetadata, PieceAction, PieceTrigger, PieceProperty } from '@/contexts/plugins/domain/PieceMetadata'
import { PiecePropertyType } from '@/contexts/plugins/domain/PiecePropertyType'
import { PieceAuthProp, PieceAuthPropOption, toPieceAuthPropType } from '@/contexts/plugins/domain/PieceAuthProp'
import { PluginSource } from '@/contexts/plugins/domain/PluginSource'
import {
  loadFrameworkPiece,
  LoadedPiece,
  LoadedAction,
  LoadedTrigger,
} from '@/contexts/plugins/adapters/out/framework/loadFrameworkPiece'

// Driven adapter implementing the PieceRegistry out-port over the ActivePieces
// framework. `loadMetadata` dynamically resolves an installed `@activepieces/
// piece-*` package (via the shared `loadFrameworkPiece` loader) and projects its
// actions/triggers/props onto the PURE domain metadata model. `listCatalog` reads
// the bundled piece-catalog.json. Mirrors the source `piece-loader.ts` +
// `piece-registry.ts`.
const CATALOG_PATH = process.env.PIECE_CATALOG_PATH || join(process.cwd(), 'data', 'piece-catalog.json')

const PROPERTY_TYPES = new Set<string>(Object.values(PropertyType))

export class ActivepiecesPieceRegistry implements PieceRegistry {
  async loadMetadata(pieceName: string): Promise<PieceMetadata | null> {
    const piece = await loadFrameworkPiece(pieceName)
    if (!piece) return null

    return {
      pieceName,
      displayName: piece.displayName,
      logoUrl: piece.logoUrl,
      description: piece.description,
      hasAuth: piece.auth != null,
      actions: this.mapActions(piece),
      triggers: this.mapTriggers(piece),
    }
  }

  async listCatalog(): Promise<PieceCatalogEntry[]> {
    let entries: RawCatalogEntry[]
    try {
      const content = await readFile(CATALOG_PATH, 'utf-8')
      const parsed: unknown = JSON.parse(content)
      entries = Array.isArray(parsed) ? (parsed as RawCatalogEntry[]) : []
    } catch {
      return []
    }

    return entries.map((entry) => {
      const source: PluginSource = entry.source === 'local' ? 'local' : 'piece'
      return {
        id: entry.id,
        name: entry.displayName,
        description: entry.description ?? null,
        version: entry.version,
        category: entry.category ?? null,
        pieceName: entry.pieceName,
        authType: entry.auth?.type ?? null,
        authProps: mapAuthProps(entry.auth?.props),
        icon: entry.logoUrl ?? null,
        source,
        manifest: entry.tools ? JSON.stringify(entry) : null,
        raw: entry as unknown as Json,
      }
    })
  }

  private mapActions(piece: LoadedPiece): PieceAction[] {
    let actions: Record<string, LoadedAction>
    try {
      actions = piece.actions()
    } catch {
      return []
    }
    return Object.entries(actions)
      .filter(([, a]) => a && typeof a === 'object')
      .map(([name, a]) => ({
        name,
        displayName: a.displayName,
        description: a.description,
        requireAuth: a.requireAuth ?? true,
        props: mapProps(a.props),
      }))
  }

  private mapTriggers(piece: LoadedPiece): PieceTrigger[] {
    let triggers: Record<string, LoadedTrigger>
    try {
      triggers = piece.triggers()
    } catch {
      return []
    }
    return Object.entries(triggers)
      .filter(([, t]) => t && typeof t === 'object')
      .map(([name, t]) => ({
        name,
        displayName: t.displayName,
        description: t.description,
        requireAuth: t.requireAuth ?? true,
        type: t.type,
        props: mapProps(t.props),
      }))
  }
}

interface RawAuthProp {
  name?: string
  displayName?: string
  type?: string
  required?: boolean
  options?: { label?: string; value?: string }[]
}

interface RawCatalogEntry {
  id: string
  displayName: string
  description?: string
  version: string
  category?: string
  pieceName: string
  logoUrl?: string
  auth?: { type?: string; props?: RawAuthProp[] }
  source?: string
  tools?: unknown[]
}

// Project the catalog's `auth.props` onto the pure PieceAuthProp domain model,
// dropping malformed entries (no name). Empty array when the piece declares no
// props. PURE: no I/O.
function mapAuthProps(props: RawAuthProp[] | undefined): PieceAuthProp[] {
  if (!Array.isArray(props)) return []
  const out: PieceAuthProp[] = []
  for (const p of props) {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string' || p.name.length === 0) continue
    const options: PieceAuthPropOption[] | undefined = Array.isArray(p.options)
      ? p.options
          .filter((o): o is { label?: string; value?: string } => !!o && typeof o === 'object')
          .map((o) => ({ label: String(o.label ?? o.value ?? ''), value: String(o.value ?? '') }))
      : undefined
    out.push({
      name: p.name,
      displayName: typeof p.displayName === 'string' ? p.displayName : p.name,
      type: toPieceAuthPropType(p.type),
      required: p.required ?? false,
      ...(options ? { options } : {}),
    })
  }
  return out
}

function mapProps(props: Record<string, unknown> | undefined): PieceProperty[] {
  if (!props) return []
  const out: PieceProperty[] = []
  for (const [name, def] of Object.entries(props)) {
    if (!def || typeof def !== 'object') continue
    const p = def as { type?: unknown; required?: boolean; displayName?: string; description?: string }
    out.push({
      name,
      type: mapPropertyType(p.type),
      required: p.required ?? false,
      displayName: p.displayName,
      description: p.description,
    })
  }
  return out
}

// The framework PropertyType enum values are string-identical to the domain
// union, so a membership check is a safe, total mapping.
function mapPropertyType(type: unknown): PiecePropertyType {
  return typeof type === 'string' && PROPERTY_TYPES.has(type) ? (type as PiecePropertyType) : 'SHORT_TEXT'
}
