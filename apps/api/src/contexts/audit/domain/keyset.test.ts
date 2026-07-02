import { describe, it, expect } from 'vitest'
import { keysetPage } from '@/contexts/audit/domain/keyset'

interface Row {
  id: string
  createdAt: Date
}

const cursorOf = (r: Row): Date => r.createdAt

function rows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    createdAt: new Date(2024, 0, 1, 0, 0, n - i), // descending order
  }))
}

describe('keysetPage', () => {
  it('returns all rows and a null cursor when there is no extra row', () => {
    const page = keysetPage(rows(3), 3, cursorOf)
    expect(page.items).toHaveLength(3)
    expect(page.nextCursor).toBeNull()
  })

  it('returns fewer than limit with a null cursor', () => {
    const page = keysetPage(rows(2), 5, cursorOf)
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('trims to limit and derives the cursor from the last kept row when there is more', () => {
    const data = rows(4) // fetched limit + 1
    const page = keysetPage(data, 3, cursorOf)
    expect(page.items).toHaveLength(3)
    expect(page.items.map((r) => r.id)).toEqual(['r0', 'r1', 'r2'])
    expect(page.nextCursor).toEqual(data[2]!.createdAt)
  })

  it('handles an empty result', () => {
    const page = keysetPage([], 10, cursorOf)
    expect(page.items).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('returns a copy, not the original array reference', () => {
    const data = rows(2)
    const page = keysetPage(data, 5, cursorOf)
    expect(page.items).not.toBe(data)
  })
})
