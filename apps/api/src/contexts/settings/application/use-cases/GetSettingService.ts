import { GetSetting, GetSettingQuery } from '@/contexts/settings/application/ports/in/GetSetting'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { parseValue } from '@/contexts/settings/domain/Setting'

export class GetSettingService implements GetSetting {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(query: GetSettingQuery): Promise<unknown> {
    const raw = await this.settings.find(query.key)
    return raw === null ? null : parseValue(raw)
  }
}
