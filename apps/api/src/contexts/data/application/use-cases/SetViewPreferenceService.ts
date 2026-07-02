import { Result, ok } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import {
  SetViewPreference,
  SetViewPreferenceCommand,
} from '@/contexts/data/application/ports/in/SetViewPreference'
import { ViewPreferenceRepository } from '@/contexts/data/application/ports/out/ViewPreferenceRepository'
import { UserViewPreference } from '@/contexts/data/domain/UserViewPreference'

// Ports view-preferences.set: upsert the (user, entity) preference, shallow-
// merging config per top-level view key.
export class SetViewPreferenceService implements SetViewPreference {
  constructor(private readonly prefs: ViewPreferenceRepository) {}

  async execute(cmd: SetViewPreferenceCommand): Promise<Result<{ activeView: string | null; config: JsonObject }>> {
    let pref = await this.prefs.findByUserEntity(cmd.userId, cmd.entityId)
    if (!pref) {
      pref = UserViewPreference.create(this.prefs.nextId(), cmd.userId, cmd.entityId)
    }
    pref.set(cmd.activeView, cmd.config)
    await this.prefs.save(pref)
    return ok({ activeView: pref.activeView, config: pref.config })
  }
}
