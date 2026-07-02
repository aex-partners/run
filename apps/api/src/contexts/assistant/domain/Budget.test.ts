import { describe, it, expect } from 'vitest'
import { Budget } from '@/contexts/assistant/domain/Budget'

describe('Budget', () => {
  it('reports its configured daily limit', () => {
    expect(Budget.daily(5).limitUsd()).toBe(5)
  })

  it('is not exceeded below the cap', () => {
    expect(Budget.daily(5).isExceeded(4.9999)).toBe(false)
  })

  it('is exceeded at or above the cap (>= boundary)', () => {
    const b = Budget.daily(5)
    expect(b.isExceeded(5)).toBe(true)
    expect(b.isExceeded(10)).toBe(true)
  })

  it('formats the exceeded message with spend (4dp) and limit (2dp)', () => {
    const msg = Budget.daily(5).exceededMessage(7.5)
    expect(msg).toContain('$7.5000')
    expect(msg).toContain('$5.00')
    expect(msg).toContain('Daily AI spend limit reached')
  })
})
