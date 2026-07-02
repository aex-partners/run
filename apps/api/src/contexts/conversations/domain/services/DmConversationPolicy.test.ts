import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { DmConversationPolicy } from '@/contexts/conversations/domain/services/DmConversationPolicy'

const expectedId = (a: string, b: string) => {
  const [lo, hi] = [a, b].sort()
  return createHash('sha256').update(`dm:${lo}:${hi}`).digest('hex').slice(0, 36)
}

describe('DmConversationPolicy.ensureDistinct', () => {
  it('rejects DMing yourself', () => {
    expect(DmConversationPolicy.ensureDistinct('u1', 'u1').ok).toBe(false)
  })

  it('accepts two distinct users', () => {
    expect(DmConversationPolicy.ensureDistinct('u1', 'u2').ok).toBe(true)
  })
})

describe('DmConversationPolicy.deterministicId', () => {
  it('fails for the same user', () => {
    const res = DmConversationPolicy.deterministicId('u1', 'u1')
    expect(res.ok).toBe(false)
  })

  it('is order-independent: the same pair yields the same id regardless of argument order', () => {
    const ab = DmConversationPolicy.deterministicId('alice', 'bob')
    const ba = DmConversationPolicy.deterministicId('bob', 'alice')
    expect(ab.ok && ba.ok).toBe(true)
    if (!ab.ok || !ba.ok) return
    expect(ab.value.value).toBe(ba.value.value)
  })

  it('derives a 36-char sha256("dm:lo:hi") id matching an independent computation', () => {
    const res = DmConversationPolicy.deterministicId('bob', 'alice')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.value).toHaveLength(36)
    expect(res.value.value).toBe(expectedId('alice', 'bob'))
  })

  it('different pairs produce different ids', () => {
    const a = DmConversationPolicy.deterministicId('u1', 'u2')
    const b = DmConversationPolicy.deterministicId('u1', 'u3')
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.value.value).not.toBe(b.value.value)
  })
})
