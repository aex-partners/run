import { describe, it, expect } from 'vitest'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

const NOW = new Date('2024-06-01T12:00:00.000Z')
const user = UserId.of('u1')

describe('NotificationPreferences defaults', () => {
  it('createDefault is enabled and never sent', () => {
    const p = NotificationPreferences.createDefault(user, NOW)
    expect(p.isDigestEnabled()).toBe(true)
    expect(p.emailDigest).toBe(true)
    expect(p.lastDigestSentAt).toBeNull()
  })
})

describe('digestWindowStart', () => {
  it('bounds the first run to FIRST_RUN_WINDOW_MS before now', () => {
    const p = NotificationPreferences.createDefault(user, NOW)
    const start = p.digestWindowStart(NOW)
    expect(start.getTime()).toBe(NOW.getTime() - NotificationPreferences.FIRST_RUN_WINDOW_MS)
  })

  it('uses the last sent stamp once one exists', () => {
    const stamp = new Date('2024-05-30T00:00:00.000Z')
    const p = NotificationPreferences.rehydrate(user, true, stamp, stamp)
    expect(p.digestWindowStart(NOW)).toBe(stamp)
  })
})

describe('markDigestSent (idempotency advance)', () => {
  it('advances the window so already-sent items are not re-sent', () => {
    const p = NotificationPreferences.createDefault(user, NOW)
    const firstWindow = p.digestWindowStart(NOW)
    p.markDigestSent(NOW)
    expect(p.lastDigestSentAt).toBe(NOW)
    // After a send, the next window starts strictly later than the first run window.
    const secondWindow = p.digestWindowStart(new Date(NOW.getTime() + 1000))
    expect(secondWindow.getTime()).toBeGreaterThan(firstWindow.getTime())
    expect(secondWindow).toBe(NOW)
  })

  it('updates updatedAt as well', () => {
    const p = NotificationPreferences.createDefault(user, NOW)
    const later = new Date(NOW.getTime() + 5000)
    p.markDigestSent(later)
    expect(p.updatedAt).toBe(later)
  })
})

describe('setEmailDigest', () => {
  it('toggles the digest flag and stamps updatedAt', () => {
    const p = NotificationPreferences.createDefault(user, NOW)
    const later = new Date(NOW.getTime() + 1000)
    p.setEmailDigest(false, later)
    expect(p.isDigestEnabled()).toBe(false)
    expect(p.updatedAt).toBe(later)
  })
})
