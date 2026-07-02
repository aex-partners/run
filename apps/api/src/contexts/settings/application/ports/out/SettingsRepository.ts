// Driven port. Generic key/value settings store. The Drizzle adapter backs this
// with the `settings` table (text PK + text value + updatedAt).
export interface SettingsRepository {
  find(key: string): Promise<string | null>
  upsert(key: string, value: string, updatedAt: Date): Promise<void>
}
