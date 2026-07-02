import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleAuditRepository } from '@/contexts/audit/adapters/out/persistence/DrizzleAuditRepository'
import { AuditEntry } from '@/contexts/audit/domain/AuditEntry'

// Parallel-safe: each test uses a UNIQUE resourceType so query() only ever
// returns rows this test created, even though other files write to audit_log.
describeIntegration('DrizzleAuditRepository (integration)', () => {
  let db: Database
  let repo: DrizzleAuditRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleAuditRepository(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  function entry(resourceType: string, createdAt: Date, over: Partial<AuditEntry> = {}): AuditEntry {
    return {
      id: randomUUID(),
      actorId: null,
      actorEmail: null,
      action: 'settings.changed',
      resourceType,
      resourceId: null,
      metadata: null,
      createdAt,
      ...over,
    }
  }

  it('appends and reads back a full entry (actor, email, metadata)', async () => {
    const actorId = await seedUser()
    const rt = `rt-${randomUUID()}`
    const e = entry(rt, new Date('2024-01-01T00:00:00.000Z'), {
      actorId,
      actorEmail: 'admin@t.io',
      action: 'user.role_changed',
      resourceId: 'user-9',
      metadata: { from: 'user', to: 'owner' },
    })
    await repo.append(e)

    const rows = await repo.query({ resourceType: rt }, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(e)
  })

  it('nextId produces unique ids', () => {
    expect(repo.nextId()).not.toBe(repo.nextId())
  })

  it('paginates newest-first with the before-cursor (keyset)', async () => {
    const rt = `rt-${randomUUID()}`
    // Five rows, ascending createdAt e1..e5.
    const times = [
      new Date('2024-03-01T00:00:00.000Z'),
      new Date('2024-03-02T00:00:00.000Z'),
      new Date('2024-03-03T00:00:00.000Z'),
      new Date('2024-03-04T00:00:00.000Z'),
      new Date('2024-03-05T00:00:00.000Z'),
    ]
    const entries = times.map((t, i) => entry(rt, t, { resourceId: `r-${i + 1}` }))
    for (const e of entries) await repo.append(e)

    // First page: newest-first, limited to 3 => e5, e4, e3.
    const page1 = await repo.query({ resourceType: rt }, 3)
    expect(page1.map((r) => r.resourceId)).toEqual(['r-5', 'r-4', 'r-3'])
    // Confirms strict desc ordering by createdAt.
    expect(page1.map((r) => r.createdAt.getTime())).toEqual(
      [...page1].map((r) => r.createdAt.getTime()).sort((a, b) => b - a),
    )

    // Second page: rows strictly older than the last row kept (e3).
    const cursor = page1[page1.length - 1].createdAt
    const page2 = await repo.query({ resourceType: rt, before: cursor }, 3)
    expect(page2.map((r) => r.resourceId)).toEqual(['r-2', 'r-1'])

    // No overlap across pages, and the cursor row itself is excluded (strict <).
    const page1Ids = new Set(page1.map((r) => r.id))
    expect(page2.some((r) => page1Ids.has(r.id))).toBe(false)
  })

  it('filters by action and actorId independently of other rows', async () => {
    const actorId = await seedUser()
    const rt = `rt-${randomUUID()}`
    await repo.append(entry(rt, new Date('2024-04-01T00:00:00.000Z'), { action: 'settings.changed' }))
    await repo.append(entry(rt, new Date('2024-04-02T00:00:00.000Z'), { action: 'user.role_changed', actorId }))

    const byAction = await repo.query({ resourceType: rt, action: 'user.role_changed' }, 10)
    expect(byAction.map((r) => r.action)).toEqual(['user.role_changed'])

    const byActor = await repo.query({ resourceType: rt, actorId }, 10)
    expect(byActor).toHaveLength(1)
    expect(byActor[0].actorId).toBe(actorId)
  })
})
