// ACL / driven out-port toward the settings context. The email context owns no
// workspace-settings table: the system sender account, locale and server SMTP
// defaults all live in the platform `settings` table owned by the settings
// context. Email states WHAT it needs (read one setting value by key) and main
// bridges HOW (settings.GetSetting in-port). Returns null when the key is unset.
export interface SettingsReader {
  get(key: string): Promise<string | null>
}
