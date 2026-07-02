import { Result, ok, fail } from '@/shared/kernel/Result'
import {
  ManageSavedView,
  ManageSavedViewCommand,
} from '@/contexts/data/application/ports/in/ManageSavedView'
import { SavedViewRepository } from '@/contexts/data/application/ports/out/SavedViewRepository'
import { SavedView } from '@/contexts/data/domain/SavedView'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'

// Saved-views lifecycle. Owner-only edit/delete and the clone-for-non-owner rule
// live in the SavedView aggregate; this service just orchestrates load/save.
export class ManageSavedViewService implements ManageSavedView {
  constructor(private readonly views: SavedViewRepository) {}

  async execute(cmd: ManageSavedViewCommand): Promise<Result<{ id: string }>> {
    switch (cmd.action) {
      case 'create': {
        const id = this.views.nextId()
        const view = SavedView.create(id, cmd.entityId, cmd.actorId, {
          name: cmd.name,
          isPublic: cmd.isPublic,
          viewType: cmd.viewType,
          filters: cmd.filters,
          config: cmd.config,
        })
        if (!view.ok) return fail(view.error)
        await this.views.save(view.value)
        return ok({ id: id.value })
      }
      case 'update': {
        const view = await this.views.findById(SavedViewId.of(cmd.viewId))
        if (!view) return fail('ManageSavedView: view not found')
        const updated = view.update(cmd.actorId, {
          name: cmd.name,
          isPublic: cmd.isPublic,
          viewType: cmd.viewType,
          filters: cmd.filters,
          config: cmd.config,
        })
        if (!updated.ok) return fail(updated.error)
        await this.views.save(view)
        return ok({ id: view.id.value })
      }
      case 'delete': {
        const view = await this.views.findById(SavedViewId.of(cmd.viewId))
        if (!view) return fail('ManageSavedView: view not found')
        if (!view.isOwnedBy(cmd.actorId)) return fail('ManageSavedView: only the owner can delete this view')
        await this.views.delete(view.id)
        return ok({ id: view.id.value })
      }
      case 'clone': {
        const source = await this.views.findById(SavedViewId.of(cmd.viewId))
        if (!source) return fail('ManageSavedView: view not found')
        const newId = this.views.nextId()
        const clone = source.cloneFor(newId, cmd.actorId, cmd.name)
        await this.views.save(clone)
        return ok({ id: newId.value })
      }
    }
  }
}
