import { createRequire } from 'node:module'
import { join } from 'node:path'

// Shared piece loader used by BOTH the registry adapter (reads metadata) and the
// piece client adapter (runs actions/triggers). Dynamically resolves an installed
// `@activepieces/piece-*` package from the dedicated `.pieces/` dir, falling back
// to the project's node_modules, and duck-types the Piece instance. Ported from
// the source `piece-loader.ts` (module-level cache included, so a piece loads once
// per process).

// Runnable shapes duck-typed off a loaded piece. Metadata fields are read by the
// registry; the `run`/hook fields are invoked by the client.
export interface LoadedAction {
  name?: string
  displayName?: string
  description?: string
  requireAuth?: boolean
  props?: Record<string, unknown>
  run?: (ctx: unknown) => Promise<unknown>
}

export interface LoadedTrigger {
  name?: string
  displayName?: string
  description?: string
  requireAuth?: boolean
  type?: string
  props?: Record<string, unknown>
  onEnable?: (ctx: unknown) => Promise<unknown>
  onDisable?: (ctx: unknown) => Promise<unknown>
  run?: (ctx: unknown) => Promise<unknown>
  test?: (ctx: unknown) => Promise<unknown>
}

export interface LoadedPiece {
  displayName: string
  logoUrl?: string
  description?: string
  auth?: unknown
  actions: () => Record<string, LoadedAction>
  triggers: () => Record<string, LoadedTrigger>
}

const PIECES_DIR = process.env.PIECES_DIR || join(process.cwd(), '.pieces')
const cache = new Map<string, LoadedPiece | null>()

export async function loadFrameworkPiece(pieceName: string): Promise<LoadedPiece | null> {
  if (cache.has(pieceName)) return cache.get(pieceName) ?? null

  const packageName = pieceName.startsWith('@activepieces/') ? pieceName : `@activepieces/piece-${pieceName}`

  let piece: LoadedPiece | null = null
  try {
    const require = createRequire(join(PIECES_DIR, 'node_modules', '_virtual.js'))
    const resolved = require.resolve(packageName)
    piece = findPieceExport(await import(resolved))
  } catch {
    try {
      piece = findPieceExport(await import(packageName))
    } catch {
      piece = null
    }
  }

  cache.set(pieceName, piece)
  return piece
}

// Drop the cache (hot-reload / test helper). Mirrors source `clearPieceCache`.
export function clearFrameworkPieceCache(): void {
  cache.clear()
}

function findPieceExport(mod: Record<string, unknown>): LoadedPiece | null {
  if (mod.default && isPiece(mod.default)) return mod.default as unknown as LoadedPiece
  for (const key of Object.keys(mod)) {
    if (isPiece(mod[key])) return mod[key] as unknown as LoadedPiece
  }
  return null
}

function isPiece(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return typeof o.displayName === 'string' && typeof o.actions === 'function' && typeof o.triggers === 'function'
}
