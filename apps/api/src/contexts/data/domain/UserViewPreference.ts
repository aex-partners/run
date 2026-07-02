import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { JsonObject } from '@/shared/domain/Json'
import { ViewPreferenceId } from '@/contexts/data/domain/ViewPreferenceId'

// AGGREGATE. A user's last-selected view and per-view settings for one entity.
// config is shallow-merged per top-level view key (table/gallery/map/...), so a
// caller can persist one view's settings without clobbering the others — exactly
// like view-preferences.set.
export class UserViewPreference extends AggregateRoot<ViewPreferenceId> {
  private constructor(
    id: ViewPreferenceId,
    public readonly userId: string,
    public readonly entityId: string,
    private _activeView: string | null,
    private _config: JsonObject,
  ) {
    super(id)
  }

  static create(
    id: ViewPreferenceId,
    userId: string,
    entityId: string,
    activeView: string | null = null,
    config: JsonObject = {},
  ): UserViewPreference {
    return new UserViewPreference(id, userId, entityId, activeView, config)
  }

  static rehydrate(
    id: ViewPreferenceId,
    userId: string,
    entityId: string,
    activeView: string | null,
    config: JsonObject,
  ): UserViewPreference {
    return new UserViewPreference(id, userId, entityId, activeView, config)
  }

  get activeView(): string | null {
    return this._activeView
  }

  get config(): JsonObject {
    return this._config
  }

  // Shallow-merge new view settings over the existing config (per top-level key).
  set(activeView: string | null | undefined, config: JsonObject | undefined): void {
    if (activeView !== undefined) this._activeView = activeView
    if (config !== undefined) this._config = { ...this._config, ...config }
  }
}
