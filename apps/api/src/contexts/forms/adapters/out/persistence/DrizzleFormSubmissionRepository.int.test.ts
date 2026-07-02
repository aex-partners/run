import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleFormSubmissionRepository } from '@/contexts/forms/adapters/out/persistence/DrizzleFormSubmissionRepository'
import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'

describeIntegration('DrizzleFormSubmissionRepository (integration)', () => {
  let db: Database
  let repo: DrizzleFormSubmissionRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleFormSubmissionRepository(db)
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

  it('persists a submission with its JSON data and null entity-record link', async () => {
    const userId = await seedUser()
    const entityId = await seedEntity(userId)
    const formId = await seedForm(entityId, userId)
    const subId = `sub-${randomUUID()}`

    const submission = FormSubmission.create(
      FormSubmissionId.of(subId),
      FormId.of(formId),
      EntityRef.of(entityId),
      null,
      { name: 'Alice', age: 30 },
      '203.0.113.7',
      new Date('2024-01-01T00:00:00.000Z'),
    )
    await repo.save(submission)

    const rows = await db.select().from(schema.formSubmissions).where(eq(schema.formSubmissions.id, subId))
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.formId).toBe(formId)
    expect(row.entityRecordId).toBeNull()
    expect(row.submitterIp).toBe('203.0.113.7')
    expect(JSON.parse(row.data)).toEqual({ name: 'Alice', age: 30 })
  })

  it('mints unique ids via nextId', () => {
    const a = repo.nextId()
    const b = repo.nextId()
    expect(a.value).not.toBe(b.value)
  })
})
