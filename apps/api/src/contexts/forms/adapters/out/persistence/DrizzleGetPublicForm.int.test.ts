import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleGetPublicForm } from '@/contexts/forms/adapters/out/persistence/DrizzleGetPublicForm'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'

const catalogOf = (fields: EntityFieldSpec[] | null): EntityCatalog => ({
  fieldsOf: async () => fields,
})

const ENTITY_FIELDS: EntityFieldSpec[] = [
  { id: 'fld-name', name: 'Name', slug: 'name', type: 'text', required: true },
  { id: 'fld-pick', name: 'Pick', slug: 'pick', type: 'select', required: false, options: [{ value: 'a', label: 'A' }] },
]

describeIntegration('DrizzleGetPublicForm (integration)', () => {
  let db: Database
  beforeAll(() => {
    db = getTestDb()
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

  async function seedForm(entityId: string, userId: string, token: string, isPublic: number): Promise<string> {
    const id = `f-${randomUUID()}`
    await db.insert(schema.forms).values({
      id,
      entityId,
      name: 'Public Form',
      description: 'fill me',
      fields: JSON.stringify([{ id: 'ff1', entityFieldId: 'fld-name', order: 0, required: true, visible: true }]),
      settings: JSON.stringify({ submitButtonText: 'Go', successMessage: 'Thanks' }),
      publicToken: token,
      isPublic,
      createdBy: userId,
    })
    return id
  }

  it('returns the public render model (form config + entity fields via catalog)', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const token = `tok-${randomUUID()}`
    const formId = await seedForm(entityId, userId, token, 1)
    const query = new DrizzleGetPublicForm(db, catalogOf(ENTITY_FIELDS))

    const view = await query.execute({ token })
    expect(view).not.toBeNull()
    expect(view!.id).toBe(formId)
    expect(view!.name).toBe('Public Form')
    expect(view!.description).toBe('fill me')
    expect(view!.fields).toEqual([{ id: 'ff1', entityFieldId: 'fld-name', order: 0, required: true, visible: true }])
    expect(view!.settings).toEqual({ submitButtonText: 'Go', successMessage: 'Thanks' })
    expect(view!.entityFields).toEqual([
      { id: 'fld-name', name: 'Name', slug: 'name', type: 'text', required: true, options: undefined },
      { id: 'fld-pick', name: 'Pick', slug: 'pick', type: 'select', required: false, options: [{ value: 'a', label: 'A' }] },
    ])
  })

  it('returns null for an unknown token', async () => {
    const query = new DrizzleGetPublicForm(db, catalogOf(ENTITY_FIELDS))
    expect(await query.execute({ token: `nope-${randomUUID()}` })).toBeNull()
  })

  it('returns null when the form exists but is not public', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const token = `tok-${randomUUID()}`
    await seedForm(entityId, userId, token, 0)
    const query = new DrizzleGetPublicForm(db, catalogOf(ENTITY_FIELDS))

    expect(await query.execute({ token })).toBeNull()
  })

  it('returns null when the entity no longer exists (catalog returns null)', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const token = `tok-${randomUUID()}`
    await seedForm(entityId, userId, token, 1)
    const query = new DrizzleGetPublicForm(db, catalogOf(null))

    expect(await query.execute({ token })).toBeNull()
  })
})
