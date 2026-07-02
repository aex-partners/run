import { MailSettings } from '@/contexts/email/application/ports/out/MailSettings'
import { SettingsReader } from '@/contexts/email/application/ports/out/SettingsReader'
import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'

const SYSTEM_ACCOUNT_KEY = 'mail.system.accountId'
const LOCALE_KEY = 'locale.language'

const readSetting = (value: string): string => {
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

// Driven adapter for the MailSettings port. Ports AEX email-engine/config.ts:
// the system sender account id and the workspace locale. The values live in the
// settings-context-owned `settings` table, reached through the SettingsReader ACL
// out-port (bridged in main to settings.GetSetting) rather than read directly.
export class DrizzleMailSettings implements MailSettings {
  constructor(private readonly settings: SettingsReader) {}

  async systemEmailAccountId(): Promise<string | null> {
    const value = await this.settings.get(SYSTEM_ACCOUNT_KEY)
    if (value === null) return null
    const id = readSetting(value).trim()
    return id || null
  }

  async emailLocale(): Promise<EmailLocale> {
    const value = await this.settings.get(LOCALE_KEY)
    if (value === null) return 'en'
    return readSetting(value).startsWith('pt') ? 'pt-BR' : 'en'
  }
}
