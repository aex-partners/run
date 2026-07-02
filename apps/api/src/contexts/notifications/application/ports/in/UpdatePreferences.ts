import { Result } from '@/shared/kernel/Result'

// Driving port. Self-scoped digest preference toggle. Upserts the preferences row
// (an absent row is created enabled-by-default first).
export interface UpdatePreferencesCommand {
  userId: string
  emailDigest: boolean
}

export interface UpdatePreferences {
  execute(cmd: UpdatePreferencesCommand): Promise<Result<{ emailDigest: boolean }>>
}
