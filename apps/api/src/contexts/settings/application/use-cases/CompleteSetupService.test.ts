import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { CompleteSetupService } from '@/contexts/settings/application/use-cases/CompleteSetupService'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { SetupProvisioner, SetupProvisionRequest } from '@/contexts/settings/application/ports/out/SetupProvisioner'
import { SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE } from '@/contexts/settings/domain/Setting'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeSettingsRepo implements SettingsRepository {
  upserts: { key: string; value: string; updatedAt: Date }[] = []
  constructor(private readonly store = new Map<string, string>()) {}
  set(key: string, value: string): void {
    this.store.set(key, value)
  }
  async find(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async upsert(key: string, value: string, updatedAt: Date): Promise<void> {
    this.upserts.push({ key, value, updatedAt })
    this.store.set(key, value)
  }
}

class FakeProvisioner implements SetupProvisioner {
  calls: SetupProvisionRequest[] = []
  async provision(request: SetupProvisionRequest): Promise<void> {
    this.calls.push(request)
  }
}

const baseCmd = {
  actorUserId: 'user-1',
  orgName: 'Acme',
  niche: 'agency',
  selectedRoutines: ['lead_followup'],
}

describe('CompleteSetupService', () => {
  it('writes settings rows, marks setup complete last, then provisions cross-context side effects', async () => {
    const settings = new FakeSettingsRepo()
    const provisioner = new FakeProvisioner()
    const svc = new CompleteSetupService(settings, provisioner, clock)

    const res = await svc.execute(baseCmd)

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ success: true })

    const keys = settings.upserts.map((u) => u.key)
    // Domain-derived setting rows were written...
    expect(keys).toContain('company.orgName')
    expect(keys).toContain('company_profile')
    // ...with the completion sentinel written LAST.
    expect(keys[keys.length - 1]).toBe(SETUP_COMPLETE_KEY)
    const sentinel = settings.upserts[settings.upserts.length - 1]
    expect(sentinel.value).toBe(SETUP_COMPLETE_VALUE)
    // Every write stamped with the clock instant.
    expect(settings.upserts.every((u) => u.updatedAt === NOW)).toBe(true)

    // Provisioning ran with the full command.
    expect(provisioner.calls).toEqual([baseCmd])
  })

  it('serializes non-string setting values as JSON', async () => {
    const settings = new FakeSettingsRepo()
    const svc = new CompleteSetupService(settings, new FakeProvisioner(), clock)

    await svc.execute(baseCmd)

    const profile = settings.upserts.find((u) => u.key === 'company_profile')
    expect(profile).toBeDefined()
    expect(JSON.parse(profile!.value)).toMatchObject({ name: 'Acme', type: 'agency' })
  })

  it('blocks a re-run once setup is complete and provisions nothing (privilege-escalation guard)', async () => {
    const settings = new FakeSettingsRepo()
    settings.set(SETUP_COMPLETE_KEY, SETUP_COMPLETE_VALUE)
    const provisioner = new FakeProvisioner()
    const svc = new CompleteSetupService(settings, provisioner, clock)

    const res = await svc.execute(baseCmd)

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('Setup already completed')
    expect(settings.upserts).toHaveLength(0)
    expect(provisioner.calls).toHaveLength(0)
  })
})
