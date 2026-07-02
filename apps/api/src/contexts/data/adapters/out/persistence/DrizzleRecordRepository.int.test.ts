import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import {
  DrizzleRecordRepository,
  RecordConflictError,
} from '@/contexts/data/adapters/out/persistence/DrizzleRecordRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { Record } from '@/contexts/data/domain/Record'
import { RecordSchema } from '@/contexts/data/domain/RecordSchema'

// Real Postgres. entity_records.created_by + entity_id are NOT NULL FKs, so a
// user and an entity row are seeded (unique ids) before any record.
describeIntegration('DrizzleRecordRepository (integration)', () => {
  let db: Database
  let repo: DrizzleRecordRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleRecordRepository(db)
  })

  const schemaOf = (): RecordSchema => {
    const e = EntityDefinition.create(EntityId.of('tmp'), 'Tmp', new Date(0))
    if (!e.ok) throw new Error(e.error)
    e.value.addField({ name: 'name', required: false, type: { kind: 'text' } }, new Date(0))
    return e.value.toSchema()
  }

  // Seeds a user + a bare entity row and returns their ids.
  const seed = async (): Promise<{ userId: string; entityId: string }> => {
    const userId = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id: userId, name: 'T', email: `${userId}@t.test`, emailVerified: false })
    const entityId = `e-${randomUUID()}`
    await db.insert(schema.entities).values({
      id: entityId,
      name: `Ent ${entityId}`,
      slug: `ent_${entityId.replace(/-/g, '')}`,
      fields: '[]',
      createdBy: userId,
    })
    return { userId, entityId }
  }

  it('inserts a new aggregate (version 0) and finds it back', async () => {
    const { userId, entityId } = await seed()
    const create = Record.create(RecordId.of(`r-${randomUUID()}`), EntityId.of(entityId), schemaOf(), { name: 'Acme' }, new Date(0), { createdBy: userId })
    if (!create.ok) throw new Error(create.error)
    await repo.save(create.value)

    const found = await repo.findById(create.value.id)
    expect(found).not.toBeNull()
    if (!found) return
    expect(found.data).toEqual({ name: 'Acme' })
    expect(found.version.value).toBe(0)
    expect(found.createdBy).toBe(userId)
  })

  it('updates via optimistic CAS and bumps the stored version', async () => {
    const { userId, entityId } = await seed()
    const create = Record.create(RecordId.of(`r-${randomUUID()}`), EntityId.of(entityId), schemaOf(), { name: 'Acme' }, new Date(0), { createdBy: userId })
    if (!create.ok) throw new Error(create.error)
    await repo.save(create.value)

    const reread = await repo.findById(create.value.id)
    if (!reread) throw new Error('not found')
    const upd = reread.update(schemaOf(), { name: 'Beta' }, reread.version, new Date(0))
    expect(upd.ok).toBe(true)
    await repo.save(reread)

    const after = await repo.findById(create.value.id)
    expect(after?.version.value).toBe(1)
    expect(after?.data).toEqual({ name: 'Beta' })
  })

  it('throws RecordConflictError when the row moved since it was read', async () => {
    const { userId, entityId } = await seed()
    const create = Record.create(RecordId.of(`r-${randomUUID()}`), EntityId.of(entityId), schemaOf(), { name: 'Acme' }, new Date(0), { createdBy: userId })
    if (!create.ok) throw new Error(create.error)
    await repo.save(create.value)

    const reread = await repo.findById(create.value.id)
    if (!reread) throw new Error('not found')
    reread.update(schemaOf(), { name: 'Beta' }, reread.version, new Date(0)) // now version 1

    // Simulate a concurrent writer moving the row's version forward.
    await db.update(schema.entityRecords).set({ version: 5 }).where(eq(schema.entityRecords.id, create.value.id.value))

    await expect(repo.save(reread)).rejects.toBeInstanceOf(RecordConflictError)
  })

  it('reports existence scoped to the entity', async () => {
    const { userId, entityId } = await seed()
    const create = Record.create(RecordId.of(`r-${randomUUID()}`), EntityId.of(entityId), schemaOf(), { name: 'Acme' }, new Date(0), { createdBy: userId })
    if (!create.ok) throw new Error(create.error)
    await repo.save(create.value)

    expect(await repo.exists(EntityId.of(entityId), create.value.id)).toBe(true)
    expect(await repo.exists(EntityId.of(entityId), RecordId.of('missing'))).toBe(false)
  })

  it('deletes a record', async () => {
    const { userId, entityId } = await seed()
    const create = Record.create(RecordId.of(`r-${randomUUID()}`), EntityId.of(entityId), schemaOf(), { name: 'X' }, new Date(0), { createdBy: userId })
    if (!create.ok) throw new Error(create.error)
    await repo.save(create.value)
    await repo.delete(create.value.id)
    expect(await repo.findById(create.value.id)).toBeNull()
  })
})
