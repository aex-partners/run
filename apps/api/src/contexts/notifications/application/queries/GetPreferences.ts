// Read side (CQRS). Returns the self-scoped digest preference. An absent row
// reads as enabled (matches the digest worker and the domain default), so the
// adapter coalesces a missing row to { emailDigest: true }.
export interface PreferencesView {
  emailDigest: boolean
}

export interface GetPreferencesQuery {
  userId: string
}

export interface GetPreferences {
  execute(q: GetPreferencesQuery): Promise<PreferencesView>
}
