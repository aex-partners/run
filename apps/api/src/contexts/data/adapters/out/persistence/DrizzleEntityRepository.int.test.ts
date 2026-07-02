import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Adapter integration test against a REAL Postgres. Parallel-safe: every test
// uses fresh randomUUID ids (users/entities) so it never collides with other
// concurrently-running int files and never assumes an empty table. entities
// .created_by is a NOT NULL FK to users, so a user is seeded first.
describeIntegration('DrizzleEntityRepository (integration)', () => {
  let db: Database
  let repo: DrizzleEntityRepository
  beforeAll(() => {
    db = getTestDb()
    repo = new DrizzleEntityRepository(db)
  })

  const seedUser = async (): Promise<string> => {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'Tester', email: `${id}@t.test`, emailVerified: false })
    return id
  }

  const build = (createdBy: string): EntityDefinition => {
    const suffix = randomUUID().slice(0, 8)
    const created = EntityDefinition.create(EntityId.of(`e-${randomUUID()}`), `Orders ${suffix}`, new Date(0), {
      createdBy,
      description: 'sales orders',
    })
    if (!created.ok) throw new Error(created.error)
    created.value.addField({ name: 'title', required: true, type: { kind: 'text' }, id: 'f-title' }, new Date(0))
    created.value.addField({ name: 'amount', required: false, type: { kind: 'number' }, id: 'f-amount' }, new Date(0))
    return created.value
  }

  it('saves an aggregate and reads it back equal (fields round-trip via AEX JSON)', async () => {
    const userId = await seedUser()
    const entity = build(userId)
    await repo.save(entity)

    const found = await repo.findById(entity.id)
    expect(found).not.toBeNull()
    if (!found) return
    expect(found.name).toBe(entity.name)
    expect(found.slug).toBe(entity.slug)
    expect(found.description).toBe('sales orders')
    expect(found.createdBy).toBe(userId)
    expect(found.fields().map((f) => f.name.value)).toEqual(['title', 'amount'])
    expect(found.fieldById('f-amount')?.type.kind).toBe('number')
    expect(found.fieldById('f-title')?.required).toBe(true)
  })

  it('resolves by id, slug, and name via findByRef', async () => {
    const userId = await seedUser()
    const entity = build(userId)
    await repo.save(entity)

    expect((await repo.findByRef(entity.id.value))?.id.value).toBe(entity.id.value)
    expect((await repo.findByRef(entity.slug))?.id.value).toBe(entity.id.value)
    expect((await repo.findByRef(entity.name))?.id.value).toBe(entity.id.value)
    expect(await repo.findByRef(`missing-${randomUUID()}`)).toBeNull()
  })

  it('upserts on save (ON CONFLICT) when the same aggregate is renamed', async () => {
    const userId = await seedUser()
    const entity = build(userId)
    await repo.save(entity)

    const renamed = entity.rename(`Renamed ${randomUUID().slice(0, 8)}`, new Date(0))
    expect(renamed.ok).toBe(true)
    await repo.save(entity)

    const found = await repo.findById(entity.id)
    expect(found?.name).toBe(entity.name)
    expect(found?.slug).toBe(entity.slug)
  })

  it('deletes an entity', async () => {
    const userId = await seedUser()
    const entity = build(userId)
    await repo.save(entity)
    await repo.delete(entity.id)
    expect(await repo.findById(entity.id)).toBeNull()
  })
})
