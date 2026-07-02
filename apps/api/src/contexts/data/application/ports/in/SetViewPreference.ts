import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Ports view-preferences.set: upsert the (user, entity) preference. activeView
// and config are both optional; config is shallow-merged per top-level view key.
export interface SetViewPreferenceCommand {
  userId: string
  entityId: string
  activeView?: string | null
  config?: JsonObject
}

export interface SetViewPreference {
  execute(cmd: SetViewPreferenceCommand): Promise<Result<{ activeView: string | null; config: JsonObject }>>
}
