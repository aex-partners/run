import { JsonObject } from '@/shared/domain/Json'

// Read side. Ports view-preferences.get: the current user's preference for an
// entity, or null.
export interface GetViewPreferenceOptions {
  userId: string
  entityId: string
}

export interface ViewPreferenceView {
  activeView: string | null
  config: JsonObject
}

export interface GetViewPreference {
  execute(opts: GetViewPreferenceOptions): Promise<ViewPreferenceView | null>
}
