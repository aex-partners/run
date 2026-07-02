import { describe, it, expect } from 'vitest'
import { AutodiscoverService } from '@/contexts/email/application/use-cases/AutodiscoverService'
import {
  EmailAutodiscovery,
  DiscoveredMailSettings,
} from '@/contexts/email/application/ports/out/EmailAutodiscovery'
import { Clock } from '@/shared/kernel/Clock'

const NOW = new Date('2026-01-01T00:00:00Z')

// A clock whose instant can be advanced between calls to drive the cooldown.
const mutableClock = (start: Date): Clock & { set: (d: Date) => void } => {
  let current = start
  return { now: () => current, set: (d: Date) => (current = d) }
}

const settings: DiscoveredMailSettings = {
  smtpHost: 'smtp.work.com',
  smtpPort: 587,
  smtpSecure: true,
  imapHost: 'imap.work.com',
  imapPort: 993,
  imapSecure: true,
}

class FakeAutodiscovery implements EmailAutodiscovery {
  readonly calls: string[] = []
  constructor(private readonly result: DiscoveredMailSettings | null) {}
  async discover(email: string): Promise<DiscoveredMailSettings | null> {
    this.calls.push(email)
    return this.result
  }
}

describe('AutodiscoverService', () => {
  it('returns the discovered settings on a first probe', async () => {
    const probe = new FakeAutodiscovery(settings)
    const service = new AutodiscoverService(probe, mutableClock(NOW))
    const res = await service.execute({ email: 'me@work.com' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toEqual(settings)
    expect(probe.calls).toEqual(['me@work.com'])
  })

  it('returns null when nothing could be discovered', async () => {
    const probe = new FakeAutodiscovery(null)
    const service = new AutodiscoverService(probe, mutableClock(NOW))
    const res = await service.execute({ email: 'me@unknown.com' })
    expect(res.ok).toBe(true)
    expect(res.ok && res.value).toBeNull()
  })

  it('rate-limits a repeat probe within the 60s cooldown without hitting the network', async () => {
    const probe = new FakeAutodiscovery(settings)
    const clock = mutableClock(NOW)
    const service = new AutodiscoverService(probe, clock)

    await service.execute({ email: 'me@work.com' })
    clock.set(new Date(NOW.getTime() + 30_000))
    const res = await service.execute({ email: 'me@work.com' })
    expect(res.ok).toBe(false)
    expect(probe.calls).toHaveLength(1)
  })

  it('keys the cooldown case-insensitively', async () => {
    const probe = new FakeAutodiscovery(settings)
    const service = new AutodiscoverService(probe, mutableClock(NOW))

    await service.execute({ email: 'ME@Work.com' })
    const res = await service.execute({ email: 'me@work.com' })
    expect(res.ok).toBe(false)
    expect(probe.calls).toHaveLength(1)
  })

  it('allows a retry once the cooldown has elapsed', async () => {
    const probe = new FakeAutodiscovery(settings)
    const clock = mutableClock(NOW)
    const service = new AutodiscoverService(probe, clock)

    await service.execute({ email: 'me@work.com' })
    clock.set(new Date(NOW.getTime() + 60_001))
    const res = await service.execute({ email: 'me@work.com' })
    expect(res.ok).toBe(true)
    expect(probe.calls).toHaveLength(2)
  })
})
