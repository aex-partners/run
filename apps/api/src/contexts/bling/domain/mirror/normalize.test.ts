import { describe, it, expect } from 'vitest'
import { nStr, nNum, nDate } from '@/contexts/bling/domain/mirror/normalize'

describe('normalize', () => {
  it('nStr trims, maps empty/undefined to null', () => {
    expect(nStr('  x  ')).toBe('x')
    expect(nStr('')).toBeNull()
    expect(nStr(undefined)).toBeNull()
    expect(nStr(5)).toBe('5')
  })
  it('nNum parses finite numbers, else null', () => {
    expect(nNum('3.5')).toBe(3.5)
    expect(nNum('')).toBeNull()
    expect(nNum(undefined)).toBeNull()
    expect(nNum('abc')).toBeNull()
  })
  it('nDate maps Bling zero-dates to null', () => {
    expect(nDate('2026-01-02')).toBe('2026-01-02')
    expect(nDate('0000-00-00')).toBeNull()
    expect(nDate(undefined)).toBeNull()
  })
})
