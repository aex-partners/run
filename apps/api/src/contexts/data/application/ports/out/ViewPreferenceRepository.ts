import { UserViewPreference } from '@/contexts/data/domain/UserViewPreference'
import { ViewPreferenceId } from '@/contexts/data/domain/ViewPreferenceId'

export interface ViewPreferenceRepository {
  nextId(): ViewPreferenceId
  findByUserEntity(userId: string, entityId: string): Promise<UserViewPreference | null>
  save(pref: UserViewPreference): Promise<void>
}
