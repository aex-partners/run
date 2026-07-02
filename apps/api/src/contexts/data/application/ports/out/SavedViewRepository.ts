import { SavedView } from '@/contexts/data/domain/SavedView'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'

export interface SavedViewRepository {
  nextId(): SavedViewId
  findById(id: SavedViewId): Promise<SavedView | null>
  save(view: SavedView): Promise<void>
  delete(id: SavedViewId): Promise<void>
}
