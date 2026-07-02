import { SettingsReader } from '@/contexts/email/application/ports/out/SettingsReader'
import { GetSmtpDefaults, SmtpDefaults } from '@/contexts/email/application/queries/GetSmtpDefaults'

// JSON-or-raw read of a settings value (AEX stores some values JSON-encoded).
const readSetting = (value: string): string => {
  try {
    return String(JSON.parse(value))
  } catch {
    return value
  }
}

// Read-side adapter. Ports AEX getSmtpDefaults: server-level SMTP host/port/secure.
// The values live in the settings-context-owned `settings` table, reached through
// the SettingsReader ACL out-port (bridged in main to settings.GetSetting) rather
// than read directly. Null when no host is configured.
export class DrizzleGetSmtpDefaults implements GetSmtpDefaults {
  constructor(private readonly settings: SettingsReader) {}

  async execute(): Promise<SmtpDefaults | null> {
    const get = async (key: string): Promise<string> => {
      const value = await this.settings.get(key)
      return value === null ? '' : readSetting(value)
    }

    const host = await get('mail.smtp.host')
    if (!host) return null

    const port = await get('mail.smtp.port')
    const secure = await get('mail.smtp.secure')

    return {
      host,
      port: parseInt(port || '587', 10),
      secure: secure === 'true',
    }
  }
}
