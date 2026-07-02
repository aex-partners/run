import { RemotePieceCatalog } from '@/contexts/plugins/application/ports/out/RemotePieceCatalog'
import { PieceMetadata, PieceAction, PieceTrigger, PieceProperty } from '@/contexts/plugins/domain/PieceMetadata'
import { PiecePropertyType } from '@/contexts/plugins/domain/PiecePropertyType'

// Driven adapter: reads a piece's full metadata from the ActivePieces public
// registry (the same source the bundled catalog is generated from). The detail
// endpoint returns actions/triggers with their input `props`, which we project
// onto the pure domain PieceMetadata model. Network + shape concerns live here.
const BASE = process.env.PIECE_CLOUD_URL || 'https://cloud.activepieces.com/api/v1/pieces'

const KNOWN_TYPES = new Set<string>([
  'SHORT_TEXT', 'LONG_TEXT', 'MARKDOWN', 'DROPDOWN', 'STATIC_DROPDOWN', 'NUMBER', 'CHECKBOX',
  'OAUTH2', 'SECRET_TEXT', 'ARRAY', 'OBJECT', 'BASIC_AUTH', 'JSON', 'MULTI_SELECT_DROPDOWN',
  'STATIC_MULTI_SELECT_DROPDOWN', 'DYNAMIC', 'CUSTOM_AUTH', 'DATE_TIME', 'FILE', 'CUSTOM', 'COLOR',
])

type RawProp = { type?: unknown; required?: boolean; displayName?: string; description?: string }
type RawAction = { displayName?: string; description?: string; requireAuth?: boolean; props?: Record<string, RawProp> }
type RawTrigger = RawAction & { type?: string }
type RawMeta = {
  displayName?: string
  logoUrl?: string
  description?: string
  auth?: unknown
  actions?: Record<string, RawAction>
  triggers?: Record<string, RawTrigger>
}

export class ActivepiecesCloudClient implements RemotePieceCatalog {
  async getMetadata(pieceName: string): Promise<PieceMetadata | null> {
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(pieceName)}`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return null
      const meta = (await res.json()) as RawMeta
      return {
        pieceName,
        displayName: meta.displayName ?? pieceName,
        logoUrl: meta.logoUrl,
        description: meta.description,
        hasAuth: meta.auth != null,
        actions: mapRecord<RawAction, PieceAction>(meta.actions, (name, a) => ({
          name,
          displayName: a.displayName,
          description: a.description,
          requireAuth: a.requireAuth ?? true,
          props: mapProps(a.props),
        })),
        triggers: mapRecord<RawTrigger, PieceTrigger>(meta.triggers, (name, t) => ({
          name,
          displayName: t.displayName,
          description: t.description,
          requireAuth: t.requireAuth ?? true,
          type: t.type,
          props: mapProps(t.props),
        })),
      }
    } catch {
      return null
    }
  }
}

function mapRecord<T, R>(rec: Record<string, T> | undefined, fn: (name: string, v: T) => R): R[] {
  if (!rec || typeof rec !== 'object') return []
  return Object.entries(rec)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([name, v]) => fn(name, v))
}

function mapProps(props: Record<string, RawProp> | undefined): PieceProperty[] {
  if (!props) return []
  return Object.entries(props)
    .filter(([, def]) => def && typeof def === 'object')
    .map(([name, def]) => ({
      name,
      type: mapType(def.type),
      required: def.required ?? false,
      displayName: def.displayName,
      description: def.description,
    }))
}

function mapType(type: unknown): PiecePropertyType {
  return typeof type === 'string' && KNOWN_TYPES.has(type) ? (type as PiecePropertyType) : 'SHORT_TEXT'
}
