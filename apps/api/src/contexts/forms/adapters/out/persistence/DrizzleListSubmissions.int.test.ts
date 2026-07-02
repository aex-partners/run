import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleListSubmissions } from '@/contexts/forms/adapters/out/persistence/DrizzleListSubmissions'

describeIntegration('DrizzleListSubmissions (integration)', () => {
  let db: Database
  let query: DrizzleListSubmissions
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleListSubmissions(db)
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

  async function seedForm(entityId: string, userId: string): Promise<string> {
    const id = `f-${randomUUID()}`
    await db.insert(schema.forms).values({ id, entityId, name: 'F', createdBy: userId })
    return id
  }

  async function seedSubmission(formId: string, data: object, createdAt: Date, ip: string | null): Promise<string> {
    const id = `sub-${randomUUID()}`
    await db.insert(schema.formSubmissions).values({ id, formId, data: JSON.stringify(data), submitterIp: ip, createdAt })
    return id
  }

  it('lists a form\'s submissions newest-first with parsed JSON data', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = await seedForm(entityId, userId)
    const first = await seedSubmission(formId, { name: 'Alice' }, new Date('2024-01-01T00:00:00.000Z'), '10.0.0.1')
    const second = await seedSubmission(formId, { name: 'Bob' }, new Date('2024-02-01T00:00:00.000Z'), null)

    const views = await query.execute({ formId })
    expect(views.map((v) => v.id)).toEqual([second, first])
    expect(views[0]!.data).toEqual({ name: 'Bob' })
    expect(views[0]!.submitterIp).toBeNull()
    expect(views[1]!.data).toEqual({ name: 'Alice' })
    expect(views[1]!.submitterIp).toBe('10.0.0.1')
    expect(views[0]!.createdAt).toBeInstanceOf(Date)
  })

  it('returns an empty list for a form with no submissions', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = await seedForm(entityId, userId)
    expect(await query.execute({ formId })).toEqual([])
  })
})
