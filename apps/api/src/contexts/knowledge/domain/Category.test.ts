import { describe, it, expect } from 'vitest'
import { Category } from '@/contexts/knowledge/domain/Category'

describe('Category', () => {
  it('of() trims and accepts a non-empty value', () => {
    const r = Category.of('  client  ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.value).toBe('client')
  })

  it('of() rejects empty/whitespace', () => {
    expect(Category.of('').ok).toBe(false)
    expect(Category.of('   ').ok).toBe(false)
  })

  it('recognizes the reserved file-content bucket', () => {
    const r = Category.of(Category.FILE_CONTENT)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.isFileContent()).toBe(true)
  })

  it('a normal category is not file-content', () => {
    const r = Category.of('product')
    expect(r.ok && r.value.isFileContent()).toBe(false)
  })

  it('equals compares by value', () => {
    const a = Category.of('x')
    const b = Category.of('x')
    const c = Category.of('y')
    expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true)
    expect(a.ok && c.ok && a.value.equals(c.value)).toBe(false)
  })
})
