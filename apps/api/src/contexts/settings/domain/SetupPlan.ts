// The settings-owned slice of the setup-wizard payload. Cross-context fields
// (SMTP credentials, mail provider, invites processing, etc.) live on the
// CompleteSetup command and flow to the SetupProvisioner ACL out-port instead.
export interface SetupWizardInput {
  orgName: string
  orgLogo?: string
  website?: string
  niche?: string
  subNiche?: string
  country?: string
  language?: string
  timezone?: string
  currencies?: string[]
  invites?: string[]
  onboardingPath?: string | null
  selectedRoutines?: string[]
  smtpHost?: string
  smtpPort?: string
  smtpSecure?: boolean
}

export interface SettingEntry {
  key: string
  value: unknown
}

// Pure rule: translate the wizard payload into the exact list of settings rows to
// upsert, with the same keys and inclusion conditions as AEX's
// settings.completeSetup. The system.setupComplete flag is written by the use
// case after these, so it is intentionally not part of this list.
export function setupSettingEntries(input: SetupWizardInput): SettingEntry[] {
  const entries: SettingEntry[] = []
  const push = (key: string, value: unknown): void => {
    entries.push({ key, value })
  }

  // Company
  push('company.orgName', input.orgName)
  if (input.orgLogo !== undefined) push('company.orgLogo', input.orgLogo)
  if (input.website !== undefined) push('company.website', input.website)
  if (input.niche !== undefined) push('company.niche', input.niche)
  if (input.subNiche !== undefined) push('company.subNiche', input.subNiche)

  // Locale
  if (input.country !== undefined) push('locale.country', input.country)
  if (input.language !== undefined) push('locale.language', input.language)
  if (input.timezone !== undefined) push('locale.timezone', input.timezone)
  if (input.currencies !== undefined) push('locale.currencies', input.currencies)

  // Onboarding
  if (input.onboardingPath !== undefined) push('onboarding.path', input.onboardingPath)
  if (input.selectedRoutines !== undefined) push('onboarding.selectedRoutines', input.selectedRoutines)
  if (input.invites !== undefined) push('onboarding.pendingInvites', input.invites)

  // Email server defaults (host/port/secure only — never credentials)
  if (input.smtpHost) push('mail.smtp.host', input.smtpHost)
  if (input.smtpPort) push('mail.smtp.port', input.smtpPort)
  if (input.smtpSecure !== undefined) push('mail.smtp.secure', input.smtpSecure)

  // Company profile snapshot from the wizard
  if (input.niche) {
    push('company_profile', {
      name: input.orgName,
      type: input.niche,
      processes: input.selectedRoutines ?? [],
      notes: input.subNiche || undefined,
    })
  }

  return entries
}
