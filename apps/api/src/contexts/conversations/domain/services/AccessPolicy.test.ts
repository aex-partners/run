import { describe, it, expect } from 'vitest'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'

const NOW = new Date('2026-01-01T00:00:00Z')

describe('AccessPolicy.requireMember', () => {
  it('fails when the membership row is missing', () => {
    const res = AccessPolicy.requireMember(null)
    expect(res.ok).toBe(false)
  })

  it('passes through the member when present', () => {
    const member = ConversationMember.create('u1', NOW)
    const res = AccessPolicy.requireMember(member)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toBe(member)
    expect(res.value.userId).toBe('u1')
  })
})
