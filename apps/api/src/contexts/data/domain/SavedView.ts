import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json, JsonObject } from '@/shared/domain/Json'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'

// The view types a saved view can target. Mirrors AEX's database screen views.
export type ViewType = 'table' | 'kanban' | 'calendar' | 'form' | 'gallery' | 'map' | 'pivot'

const VIEW_TYPES: readonly ViewType[] = [
  'table',
  'kanban',
  'calendar',
  'form',
  'gallery',
  'map',
  'pivot',
]

export interface SavedViewProps {
  name?: string
  isPublic?: boolean
  viewType?: ViewType
  filters?: Json[]
  config?: JsonObject
}

// AGGREGATE. A named bundle of filter + arrangement + view type for one entity,
// owned by a user. Public views are visible to everyone but only the owner may
// edit or delete the original; a non-owner clones it into a private copy.
export class SavedView extends AggregateRoot<SavedViewId> {
  private constructor(
    id: SavedViewId,
    public readonly entityId: string,
    private _ownerId: string,
    private _name: string,
    private _isPublic: boolean,
    private _viewType: ViewType,
    private _filters: Json[],
    private _config: JsonObject,
  ) {
    super(id)
  }

  static create(id: SavedViewId, entityId: string, ownerId: string, props: SavedViewProps): Result<SavedView> {
    const name = (props.name ?? '').trim()
    if (name.length < 1) return fail('SavedView: name is required')
    const viewType = props.viewType ?? 'table'
    if (!VIEW_TYPES.includes(viewType)) return fail(`SavedView: unknown view type "${viewType}"`)
    return ok(
      new SavedView(
        id,
        entityId,
        ownerId,
        name,
        props.isPublic ?? false,
        viewType,
        props.filters ?? [],
        props.config ?? {},
      ),
    )
  }

  static rehydrate(
    id: SavedViewId,
    entityId: string,
    ownerId: string,
    name: string,
    isPublic: boolean,
    viewType: ViewType,
    filters: Json[],
    config: JsonObject,
  ): SavedView {
    return new SavedView(id, entityId, ownerId, name, isPublic, viewType, filters, config)
  }

  get ownerId(): string {
    return this._ownerId
  }
  get name(): string {
    return this._name
  }
  get isPublic(): boolean {
    return this._isPublic
  }
  get viewType(): ViewType {
    return this._viewType
  }
  get filters(): Json[] {
    return this._filters
  }
  get config(): JsonObject {
    return this._config
  }

  isOwnedBy(userId: string): boolean {
    return this._ownerId === userId
  }

  // Only the owner edits the original (enforced here, not just at the service).
  update(userId: string, props: SavedViewProps): Result<void> {
    if (!this.isOwnedBy(userId)) return fail('SavedView: only the owner can edit this view')
    if (props.name !== undefined) {
      const name = props.name.trim()
      if (name.length < 1) return fail('SavedView: name is required')
      this._name = name
    }
    if (props.viewType !== undefined) {
      if (!VIEW_TYPES.includes(props.viewType)) return fail(`SavedView: unknown view type "${props.viewType}"`)
      this._viewType = props.viewType
    }
    if (props.isPublic !== undefined) this._isPublic = props.isPublic
    if (props.filters !== undefined) this._filters = props.filters
    if (props.config !== undefined) this._config = props.config
    return ok(undefined)
  }

  // A non-owner clones a (public) view into their own private copy.
  cloneFor(newId: SavedViewId, userId: string, name?: string): SavedView {
    return new SavedView(
      newId,
      this.entityId,
      userId,
      (name ?? `${this._name} (copy)`).trim(),
      false,
      this._viewType,
      [...this._filters],
      { ...this._config },
    )
  }
}
