import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetForm } from '@/contexts/forms/adapters/out/persistence/DrizzleGetForm'

describeIntegration('DrizzleGetForm (integration)', () => {
  let db: Database
  let query: DrizzleGetForm
  beforeAll(() => {
    db = getTestDb()
    query = new DrizzleGetForm(db)
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

  it('projects a form row into a FormView', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = `f-${randomUUID()}`
    await db.insert(schema.forms).values({
      id: formId,
      entityId,
      name: 'Contact',
      description: 'reach us',
      fields: JSON.stringify([{ id: 'ff1', entityFieldId: 'fld', order: 0, required: false, visible: true }]),
      settings: JSON.stringify({ submitButtonText: 'Send', successMessage: 'Done' }),
      publicToken: null,
      isPublic: 0,
      createdBy: userId,
    })

    const view = await query.execute({ id: formId })
    expect(view).not.toBeNull()
    expect(view!.id).toBe(formId)
    expect(view!.entityId).toBe(entityId)
    expect(view!.name).toBe('Contact')
    expect(view!.description).toBe('reach us')
    expect(view!.isPublic).toBe(false)
    expect(view!.publicToken).toBeNull()
    expect(view!.fields).toEqual([{ id: 'ff1', entityFieldId: 'fld', order: 0, required: false, visible: true }])
    expect(view!.settings).toEqual({ submitButtonText: 'Send', successMessage: 'Done' })
    expect(view!.createdAt).toBeInstanceOf(Date)
    expect(view!.updatedAt).toBeInstanceOf(Date)
  })

  it('returns null for a missing id', async () => {
    expect(await query.execute({ id: `missing-${randomUUID()}` })).toBeNull()
  })
})
