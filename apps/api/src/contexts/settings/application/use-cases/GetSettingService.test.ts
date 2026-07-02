import { describe, it, expect } from 'vitest'
import { GetSettingService } from '@/contexts/settings/application/use-cases/GetSettingService'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'

class FakeSettingsRepo implements SettingsRepository {
  constructor(private readonly store = new Map<string, string>()) {}
  set(key: string, value: string): void {
    this.store.set(key, value)
  }
  async find(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async upsert(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }
}

describe('GetSettingService', () => {
  it('returns null for a missing key', async () => {
    const svc = new GetSettingService(new FakeSettingsRepo())
    expect(await svc.execute({ key: 'absent' })).toBeNull()
  })

  it('passes a plain string through verbatim', async () => {
    const repo = new FakeSettingsRepo()
    repo.set('company.orgName', 'Acme')
    const svc = new GetSettingService(repo)
    expect(await svc.execute({ key: 'company.orgName' })).toBe('Acme')
  })

  it('parses JSON-encoded values back into structured data', async () => {
    const repo = new FakeSettingsRepo()
    repo.set('locale.currencies', JSON.stringify(['USD', 'BRL']))
    repo.set('mail.smtp.secure', JSON.stringify(true))
    const svc = new GetSettingService(repo)
    expect(await svc.execute({ key: 'locale.currencies' })).toEqual(['USD', 'BRL'])
    expect(await svc.execute({ key: 'mail.smtp.secure' })).toBe(true)
  })
})
