import { PiecePropertyType } from '@/contexts/plugins/domain/PiecePropertyType'

// PURE domain model of a loaded piece's metadata (actions / triggers / props).
// The registry adapter loads the real piece from the framework and projects it
// onto these plain shapes; everything downstream (tool discovery, action
// resolution) reasons over this, never the npm framework type.

export interface PieceProperty {
  name: string
  type: PiecePropertyType
  required: boolean
  displayName?: string
  description?: string
}

export interface PieceAction {
  name: string
  displayName?: string
  description?: string
  // The ActivePieces framework defaults `requireAuth` to true even for no-auth
  // pieces; the auth gate also checks `hasAuth`, so this is preserved verbatim.
  requireAuth: boolean
  props: PieceProperty[]
}

export interface PieceTrigger {
  name: string
  displayName?: string
  description?: string
  requireAuth: boolean
  // POLLING / WEBHOOK / APP_WEBHOOK / MANUAL — the trigger strategy, if declared.
  type?: string
  props: PieceProperty[]
}

export interface PieceMetadata {
  // The real piece package/identifier (e.g. `@activepieces/piece-gmail`).
  pieceName: string
  displayName: string
  logoUrl?: string
  description?: string
  // Whether the piece declares an auth schema. The auth gate fails only when a
  // piece HAS auth AND the action/trigger requires it AND no credential resolves.
  hasAuth: boolean
  actions: PieceAction[]
  triggers: PieceTrigger[]
}

export const PieceMetadata = {
  // Look up one action by its (unsanitized) name.
  findAction(meta: PieceMetadata, actionName: string): PieceAction | undefined {
    return meta.actions.find((a) => a.name === actionName)
  },

  // Look up one trigger by its (unsanitized) name.
  findTrigger(meta: PieceMetadata, triggerName: string): PieceTrigger | undefined {
    return meta.triggers.find((t) => t.name === triggerName)
  },
}
