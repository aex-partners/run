import { describe, it, expect } from 'vitest'
import { CheckSetupCompleteService } from '@/contexts/settings/application/use-cases/CheckSetupCompleteService'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE } from '@/contexts/settings/domain/Setting'

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

describe('CheckSetupCompleteService', () => {
  it('reports incomplete when the sentinel is absent', async () => {
    const svc = new CheckSetupCompleteService(new FakeSettingsRepo())
    expect(await svc.execute()).toEqual({ complete: false })
  })

  it('reports complete when the sentinel equals the completion value', async () => {
    const repo = new FakeSettingsRepo()
    repo.set(SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE)
    const svc = new CheckSetupCompleteService(repo)
    expect(await svc.execute()).toEqual({ complete: true })
  })

  it('reports incomplete when the sentinel holds any other value', async () => {
    const repo = new FakeSettingsRepo()
    repo.set(SETUP_COMPLETE_KEY, 'false')
    const svc = new CheckSetupCompleteService(repo)
    expect(await svc.execute()).toEqual({ complete: false })
  })
})
