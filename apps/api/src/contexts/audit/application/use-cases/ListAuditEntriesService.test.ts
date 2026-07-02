import { describe, it, expect } from 'vitest'
import { ListAuditEntriesService } from '@/contexts/audit/application/use-cases/ListAuditEntriesService'
import { AuditRepository, AuditQueryFilter } from '@/contexts/audit/application/ports/out/AuditRepository'
import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

function entry(id: string, createdAt: Date): AuditEntry {
  return {
    id,
    actorId: null,
    actorEmail: null,
    action: 'settings.changed',
    resourceType: 'settings',
    resourceId: null,
    metadata: null,
    createdAt,
  }
}

class FakeAuditRepo implements AuditRepository {
  lastFilter: AuditQueryFilter | null = null
  lastLimit = 0
  constructor(private readonly rows: AuditEntry[]) {}
  nextId(): string {
    return 'id'
  }
  async append(): Promise<void> {}
  async query(filter: AuditQueryFilter, limit: number): Promise<AuditEntry[]> {
    this.lastFilter = filter
    this.lastLimit = limit
    // The adapter returns newest-first, already limited to `limit` rows.
    return this.rows.slice(0, limit)
  }
}

describe('ListAuditEntriesService', () => {
  it('forwards the filter and fetches limit+1 rows for keyset paging', async () => {
    const repo = new FakeAuditRepo([])
    const svc = new ListAuditEntriesService(repo)
    const before = new Date('2024-02-01T00:00:00.000Z')

    await svc.execute({ action: 'settings.changed', resourceType: 'settings', actorId: 'a', before, limit: 20 })

    expect(repo.lastLimit).toBe(21)
    expect(repo.lastFilter).toEqual({
      action: 'settings.changed',
      resourceType: 'settings',
      actorId: 'a',
      before,
    })
  })

  it('returns all rows with a null cursor when the page is not full', async () => {
    const rows = [
      entry('a', new Date('2024-01-03T00:00:00.000Z')),
      entry('b', new Date('2024-01-02T00:00:00.000Z')),
    ]
    const svc = new ListAuditEntriesService(new FakeAuditRepo(rows))

    const page = await svc.execute({ limit: 5 })

    expect(page.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBeNull()
  })

  it('trims the extra row and derives the next cursor from the last kept row', async () => {
    const rows = [
      entry('a', new Date('2024-01-03T00:00:00.000Z')),
      entry('b', new Date('2024-01-02T00:00:00.000Z')),
      entry('c', new Date('2024-01-01T00:00:00.000Z')),
    ]
    const svc = new ListAuditEntriesService(new FakeAuditRepo(rows))

    const page = await svc.execute({ limit: 2 })

    expect(page.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(page.nextCursor).toEqual(new Date('2024-01-02T00:00:00.000Z'))
  })
})
