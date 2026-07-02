import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleFormRepository } from '@/contexts/forms/adapters/out/persistence/DrizzleFormRepository'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'

// Adapter integration test against a REAL Postgres. Parallel-safe: every row gets
// a unique id (randomUUID) and assertions only touch the rows this file created.
describeIntegration('DrizzleFormRepository (integration)', () => {
  let db: Database
  let repo: DrizzleFormRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleFormRepository(db)
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

  function makeForm(formId: string, entityId: string, createdBy: string, opts: { token?: string | null; isPublic?: boolean; fields?: FormField[] } = {}): Form {
    return Form.rehydrate(
      FormId.of(formId),
      EntityRef.of(entityId),
      'My Form',
      'a description',
      opts.fields ?? [{ id: 'ff1', entityFieldId: 'fld-1', order: 0, required: true, visible: true }],
      defaultFormSettings(),
      opts.token ?? null,
      opts.isPublic ?? false,
      createdBy,
    )
  }

  it('round-trips a saved form by id (fields/settings/isPublic)', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = `f-${randomUUID()}`
    await repo.save(makeForm(formId, entityId, userId))

    const found = await repo.findById(FormId.of(formId))
    expect(found).not.toBeNull()
    expect(found!.name).toBe('My Form')
    expect(found!.description).toBe('a description')
    expect(found!.entityId.value).toBe(entityId)
    expect(found!.createdBy).toBe(userId)
    expect(found!.isPublic).toBe(false)
    expect(found!.fields()).toHaveLength(1)
    expect(found!.fields()[0]).toMatchObject({ id: 'ff1', entityFieldId: 'fld-1', required: true, visible: true })
  })

  it('returns null for a missing id', async () => {
    const found = await repo.findById(FormId.of(`missing-${randomUUID()}`))
    expect(found).toBeNull()
  })

  it('finds a public form by its token', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = `f-${randomUUID()}`
    const token = `tok-${randomUUID()}`
    await repo.save(makeForm(formId, entityId, userId, { token, isPublic: true }))

    const found = await repo.findByToken(token)
    expect(found).not.toBeNull()
    expect(found!.id.value).toBe(formId)
    expect(found!.isPublic).toBe(true)
    expect(found!.publicToken).toBe(token)
  })

  it('upserts on save (ON CONFLICT updates name/fields in place)', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = `f-${randomUUID()}`
    await repo.save(makeForm(formId, entityId, userId))

    const updated = Form.rehydrate(
      FormId.of(formId),
      EntityRef.of(entityId),
      'Renamed',
      null,
      [],
      defaultFormSettings(),
      null,
      false,
      userId,
    )
    await repo.save(updated)

    const found = await repo.findById(FormId.of(formId))
    expect(found!.name).toBe('Renamed')
    expect(found!.description).toBeNull()
    expect(found!.fields()).toHaveLength(0)

    // Still exactly one row for this id.
    const rows = await db.select().from(schema.forms).where(eq(schema.forms.id, formId))
    expect(rows).toHaveLength(1)
  })

  it('deletes a form by id', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = `f-${randomUUID()}`
    await repo.save(makeForm(formId, entityId, userId))

    await repo.delete(FormId.of(formId))

    expect(await repo.findById(FormId.of(formId))).toBeNull()
    const rows = await db.select().from(schema.forms).where(eq(schema.forms.id, formId))
    expect(rows).toHaveLength(0)
  })
})
