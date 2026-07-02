import { Result } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import { ViewType } from '@/contexts/data/domain/SavedView'

// One in-port for the saved-views lifecycle (AEX defines the table but no router
// yet; this is the natural CRUD surface). `actorId` is the acting user; only the
// owner may update/delete the original, and a non-owner clones into a private copy.
export interface CreateSavedViewCommand {
  action: 'create'
  actorId: string
  entityId: string
  name: string
  isPublic?: boolean
  viewType?: ViewType
  filters?: Json[]
  config?: JsonObject
}

export interface UpdateSavedViewCommand {
  action: 'update'
  actorId: string
  viewId: string
  name?: string
  isPublic?: boolean
  viewType?: ViewType
  filters?: Json[]
  config?: JsonObject
}

export interface DeleteSavedViewCommand {
  action: 'delete'
  actorId: string
  viewId: string
}

export interface CloneSavedViewCommand {
  action: 'clone'
  actorId: string
  viewId: string
  name?: string
}

export type ManageSavedViewCommand =
  | CreateSavedViewCommand
  | UpdateSavedViewCommand
  | DeleteSavedViewCommand
  | CloneSavedViewCommand

export interface ManageSavedView {
  execute(cmd: ManageSavedViewCommand): Promise<Result<{ id: string }>>
}
