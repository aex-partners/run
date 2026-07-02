import { describe, it, expect } from 'vitest'
import { setupSettingEntries, SetupWizardInput, SettingEntry } from '@/contexts/settings/domain/SetupPlan'

function asMap(entries: SettingEntry[]): Map<string, unknown> {
  return new Map(entries.map((e) => [e.key, e.value]))
}

describe('setupSettingEntries', () => {
  it('always writes company.orgName', () => {
    const entries = setupSettingEntries({ orgName: 'Acme' })
    expect(asMap(entries).get('company.orgName')).toBe('Acme')
  })

  it('omits optional company/locale keys when undefined', () => {
    const keys = setupSettingEntries({ orgName: 'Acme' }).map((e) => e.key)
    expect(keys).toEqual(['company.orgName'])
    expect(keys).not.toContain('company.website')
    expect(keys).not.toContain('locale.country')
  })

  it('includes locale rows when provided', () => {
    const map = asMap(
      setupSettingEntries({
        orgName: 'Acme',
        country: 'BR',
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        currencies: ['BRL', 'USD'],
      }),
    )
    expect(map.get('locale.country')).toBe('BR')
    expect(map.get('locale.language')).toBe('pt-BR')
    expect(map.get('locale.timezone')).toBe('America/Sao_Paulo')
    expect(map.get('locale.currencies')).toEqual(['BRL', 'USD'])
  })

  it('maps onboarding fields', () => {
    const map = asMap(
      setupSettingEntries({
        orgName: 'Acme',
        onboardingPath: 'guided',
        selectedRoutines: ['r1'],
        invites: ['a@b.com'],
      }),
    )
    expect(map.get('onboarding.path')).toBe('guided')
    expect(map.get('onboarding.selectedRoutines')).toEqual(['r1'])
    expect(map.get('onboarding.pendingInvites')).toEqual(['a@b.com'])
  })

  it('writes smtp host/port only when truthy, but secure when defined', () => {
    const withSmtp = asMap(setupSettingEntries({ orgName: 'Acme', smtpHost: 'smtp.x', smtpPort: '587', smtpSecure: false }))
    expect(withSmtp.get('mail.smtp.host')).toBe('smtp.x')
    expect(withSmtp.get('mail.smtp.port')).toBe('587')
    expect(withSmtp.get('mail.smtp.secure')).toBe(false)

    const emptyHost = asMap(setupSettingEntries({ orgName: 'Acme', smtpHost: '', smtpPort: '' }))
    expect(emptyHost.has('mail.smtp.host')).toBe(false)
    expect(emptyHost.has('mail.smtp.port')).toBe(false)
  })

  it('builds the company_profile snapshot only when a niche is present', () => {
    const input: SetupWizardInput = {
      orgName: 'Acme',
      niche: 'agency',
      subNiche: 'design',
      selectedRoutines: ['r1', 'r2'],
    }
    const map = asMap(setupSettingEntries(input))
    expect(map.get('company_profile')).toEqual({
      name: 'Acme',
      type: 'agency',
      processes: ['r1', 'r2'],
      notes: 'design',
    })
  })

  it('omits company_profile when there is no niche', () => {
    const keys = setupSettingEntries({ orgName: 'Acme' }).map((e) => e.key)
    expect(keys).not.toContain('company_profile')
  })

  it('never writes the system.setupComplete flag', () => {
    const keys = setupSettingEntries({ orgName: 'Acme', niche: 'x' }).map((e) => e.key)
    expect(keys).not.toContain('system.setupComplete')
  })
})
