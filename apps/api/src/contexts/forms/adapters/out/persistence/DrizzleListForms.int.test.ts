import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListForms } from '@/contexts/forms/adapters/out/persistence/DrizzleListForms'

describeIntegration('DrizzleListForms (integration)', () => {
  let db: Database
  let query: DrizzleListForms
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleListForms(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedEntity(userId: string): Promise<string> {
    const id = `e-${randomUUID()}`
    await db.insert(schema.entities).values({ id, name: 'E', slug: `s-${randomUUID()}`, fields: '[]', createdBy: userId })
    return id
  }

  async function seedForm(entityId: string, userId: string, name: string, createdAt: Date): Promise<string> {
    const id = `f-${randomUUID()}`
    await db.insert(schema.forms).values({ id, entityId, name, createdBy: userId, createdAt })
    return id
  }

  it('lists an entity\'s forms newest-first', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const older = await seedForm(entityId, userId, 'Older', new Date('2024-01-01T00:00:00.000Z'))
    const newer = await seedForm(entityId, userId, 'Newer', new Date('2024-06-01T00:00:00.000Z'))

    const views = await query.execute({ entityId })
    expect(views.map((v) => v.id)).toEqual([newer, older])
    expect(views[0]!.name).toBe('Newer')
    expect(views.every((v) => v.entityId === entityId)).toBe(true)
  })

  it('does not return forms of a different entity', async () => {
    const userId = await seedUser()
    const entityA = await seedEntity(userId)
    const entityB = await seedEntity(userId)
    const inA = await seedForm(entityA, userId, 'A', new Date('2024-01-01T00:00:00.000Z'))
    await seedForm(entityB, userId, 'B', new Date('2024-01-01T00:00:00.000Z'))

    const views = await query.execute({ entityId: entityA })
    expect(views.map((v) => v.id)).toEqual([inA])
  })

  it('returns an empty list for an entity with no forms', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    expect(await query.execute({ entityId })).toEqual([])
  })
})
