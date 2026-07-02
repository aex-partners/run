import { Json, JsonObject } from '@/shared/domain/Json'

// Read side. Lists the saved views visible to a user for an entity: their own
// plus any public ones.
export interface SavedViewView {
  id: string
  entityId: string
  ownerId: string
  name: string
  isPublic: boolean
  viewType: string
  filters: Json[]
  config: JsonObject
  isOwner: boolean
}

export interface ListSavedViewsOptions {
  entityId: string
  userId: string
}

export interface ListSavedViews {
  execute(opts: ListSavedViewsOptions): Promise<SavedViewView[]>
}
