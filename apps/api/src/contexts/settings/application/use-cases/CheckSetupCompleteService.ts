import { CheckSetupComplete } from '@/contexts/settings/application/ports/in/CheckSetupComplete'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE } from '@/contexts/settings/domain/Setting'

export class CheckSetupCompleteService implements CheckSetupComplete {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(): Promise<{ complete: boolean }> {
    const value = await this.settings.find(SETUP_COMPLETE_KEY)
    return { complete: value === SETUP_COMPLETE_VALUE }
  }
}
