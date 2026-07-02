import { describe, it, expect } from 'vitest'
import { Clock } from '@/shared/kernel/Clock'
import { SetSettingService } from '@/contexts/settings/application/use-cases/SetSettingService'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'
import { AuditTrail, AuditTrailEvent } from '@/contexts/settings/application/ports/out/AuditTrail'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock: Clock = { now: () => NOW }

class FakeSettingsRepo implements SettingsRepository {
  upserts: { key: string; value: string; updatedAt: Date }[] = []
  async find(): Promise<string | null> {
    return null
  }
  async upsert(key: string, value: string, updatedAt: Date): Promise<void> {
    this.upserts.push({ key, value, updatedAt })
  }
}

class FakeAuditTrail implements AuditTrail {
  events: AuditTrailEvent[] = []
  async record(event: AuditTrailEvent): Promise<void> {
    this.events.push(event)
  }
}

describe('SetSettingService', () => {
  it('upserts the serialized value and records an audit event keyed by the setting key (never the value)', async () => {
    const settings = new FakeSettingsRepo()
    const audit = new FakeAuditTrail()
    const svc = new SetSettingService(settings, audit, clock)

    const res = await svc.execute({
      key: 'mail.smtp.secure',
      value: true,
      actorId: 'admin-1',
      actorEmail: 'admin@t.io',
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({ success: true })

    // Non-string value serialized to JSON, stamped with the clock instant.
    expect(settings.upserts).toEqual([{ key: 'mail.smtp.secure', value: 'true', updatedAt: NOW }])

    // Audit captures the key as resourceId, but the value is never recorded (secrets).
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0]).toEqual({
      actorId: 'admin-1',
      actorEmail: 'admin@t.io',
      action: 'settings.changed',
      resourceType: 'settings',
      resourceId: 'mail.smtp.secure',
    })
    expect(JSON.stringify(audit.events[0])).not.toContain('true')
  })

  it('passes a string value through verbatim and defaults a missing actorEmail to null', async () => {
    const settings = new FakeSettingsRepo()
    const audit = new FakeAuditTrail()
    const svc = new SetSettingService(settings, audit, clock)

    await svc.execute({ key: 'company.orgName', value: 'Acme', actorId: 'admin-1' })

    expect(settings.upserts[0].value).toBe('Acme')
    expect(audit.events[0].actorEmail).toBeNull()
  })
})
