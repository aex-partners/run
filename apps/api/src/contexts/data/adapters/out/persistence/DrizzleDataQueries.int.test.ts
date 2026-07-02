import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { DrizzleListRecords } from '@/contexts/data/adapters/out/persistence/DrizzleListRecords'
import { DrizzleSearchRecords } from '@/contexts/data/adapters/out/persistence/DrizzleSearchRecords'
import { DrizzlePivotRecords } from '@/contexts/data/adapters/out/persistence/DrizzlePivotRecords'
import { DrizzleListEntities } from '@/contexts/data/adapters/out/persistence/DrizzleListEntities'
import { DrizzleQueryRecords } from '@/contexts/data/adapters/out/persistence/DrizzleQueryRecords'
import { EntityDefinition, FieldDescriptor } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { JsonObject } from '@/shared/domain/Json'

// Read-side adapters against a REAL Postgres. Every test scopes its reads to a
// freshly created entity (unique id) so it is parallel-safe and never assumes an
// empty table.
describeIntegration('Drizzle data read queries (integration)', () => {
  let db: Database
  let entityRepo: DrizzleEntityRepository
  beforeAll(() => {
    db = getTestDb()
    entityRepo = new DrizzleEntityRepository(db)
  })

  const seedUser = async (): Promise<string> => {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.test`, emailVerified: false })
    return id
  }

  const seedEntity = async (createdBy: string, fields: FieldDescriptor[]): Promise<EntityDefinition> => {
    const created = EntityDefinition.create(EntityId.of(`e-${randomUUID()}`), `E ${randomUUID().slice(0, 8)}`, new Date(0), { createdBy })
    if (!created.ok) throw new Error(created.error)
    for (const f of fields) {
      const r = created.value.addField(f, new Date(0))
      if (!r.ok) throw new Error(r.error)
    }
    await entityRepo.save(created.value)
    return created.value
  }

  const insertRecord = async (
    entityId: string,
    createdBy: string,
    data: JsonObject,
    opts?: { createdAt?: Date },
  ): Promise<string> => {
    const id = `r-${randomUUID()}`
    await db.insert(schema.entityRecords).values({
      id,
      entityId,
      data: JSON.stringify(data),
      version: 0,
      createdBy,
      ...(opts?.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    return id
  }

  it('DrizzleListRecords returns the view shape, newest-first, and can re-sort by a field', async () => {
    const userId = await seedUser()
    const entity = await seedEntity(userId, [{ name: 'name', required: false, type: { kind: 'text' } }])
    const old = await insertRecord(entity.id.value, userId, { name: 'Charlie' }, { createdAt: new Date('2024-01-01') })
    const recent = await insertRecord(entity.id.value, userId, { name: 'alpha' }, { createdAt: new Date('2024-06-01') })

    const byDate = new DrizzleListRecords(db)
    const defaultOrder = await byDate.execute({ entityId: entity.id.value })
    expect(defaultOrder.map((v) => v.id)).toEqual([recent, old]) // created_at DESC
    expect(defaultOrder[0]).toMatchObject({ version: 0, data: { name: 'alpha' } })

    const sorted = await byDate.execute({ entityId: entity.id.value, sortBy: 'name' })
    expect(sorted.map((v) => v.data.name)).toEqual(['alpha', 'Charlie'])
  })

  it('DrizzleSearchRecords labels by the required text field and filters by search', async () => {
    const userId = await seedUser()
    const entity = await seedEntity(userId, [{ name: 'name', required: true, type: { kind: 'text' } }])
    await insertRecord(entity.id.value, userId, { name: 'Acme' })
    await insertRecord(entity.id.value, userId, { name: 'Beta' })

    const search = new DrizzleSearchRecords(db)
    const all = await search.execute({ entityId: entity.id.value })
    expect(all.map((r) => r.label).sort()).toEqual(['Acme', 'Beta'])

    const filtered = await search.execute({ entityId: entity.id.value, search: 'ac' })
    expect(filtered.map((r) => r.label)).toEqual(['Acme'])

    expect(await search.execute({ entityId: `missing-${randomUUID()}` })).toEqual([])
  })

  it('DrizzlePivotRecords extracts requested slugs from JSONB across the dataset', async () => {
    const userId = await seedUser()
    const entity = await seedEntity(userId, [
      { name: 'amount', required: false, type: { kind: 'number' } },
      { name: 'region', required: false, type: { kind: 'text' } },
    ])
    await insertRecord(entity.id.value, userId, { amount: 10, region: 'south' })
    await insertRecord(entity.id.value, userId, { amount: 20, region: 'north' })

    const pivot = new DrizzlePivotRecords(db)
    const result = await pivot.execute({ entityId: entity.id.value, fields: ['amount', 'region', 'bogus'] })
    expect(result.total).toBe(2)
    expect(result.truncated).toBe(false)
    const amounts = result.rows.map((r) => r.amount).sort()
    expect(amounts).toEqual(['10', '20']) // jsonb ->> yields text
    const regions = result.rows.map((r) => r.region).sort()
    expect(regions).toEqual(['north', 'south'])
    // 'bogus' is not a valid slug, so it is not a returned column key.
    expect(Object.keys(result.rows[0])).toEqual(['amount', 'region'])
  })

  it('DrizzleListEntities reports the record count for an entity', async () => {
    const userId = await seedUser()
    const entity = await seedEntity(userId, [{ name: 'title', required: false, type: { kind: 'text' } }])
    await insertRecord(entity.id.value, userId, { title: 'a' })
    await insertRecord(entity.id.value, userId, { title: 'b' })

    const list = new DrizzleListEntities(db)
    const all = await list.execute()
    const mine = all.find((e) => e.id === entity.id.value)
    expect(mine).toBeDefined()
    expect(mine?.recordCount).toBe(2)
    expect(mine?.fields.map((f) => f.slug)).toEqual(['title'])
  })

  it('DrizzleQueryRecords filters on a typed JSONB field and groups/aggregates', async () => {
    const userId = await seedUser()
    const entity = await seedEntity(userId, [
      { name: 'amount', required: false, type: { kind: 'number' } },
      { name: 'region', required: false, type: { kind: 'text' } },
    ])
    await insertRecord(entity.id.value, userId, { amount: 10, region: 'south' })
    await insertRecord(entity.id.value, userId, { amount: 30, region: 'north' })
    await insertRecord(entity.id.value, userId, { amount: 20, region: 'south' })

    const query = new DrizzleQueryRecords(db)

    const filtered = await query.execute({ entity: entity.id.value, where: [{ field: 'amount', op: 'gte', value: 20 }] })
    if ('rows' in filtered) {
      expect(filtered.total).toBe(2)
      expect(filtered.rows.map((r) => Number(r.data.amount)).sort((a, b) => a - b)).toEqual([20, 30])
    } else {
      throw new Error('expected rows result')
    }

    const grouped = await query.execute({
      entity: entity.id.value,
      group_by: ['region'],
      aggregate: [{ fn: 'sum', field: 'amount', as: 'total' }],
    })
    if ('groups' in grouped) {
      const byRegion = Object.fromEntries(grouped.groups.map((g) => [g.key?.region, Number(g.values.total)]))
      expect(byRegion).toEqual({ south: 30, north: 30 })
    } else {
      throw new Error('expected groups result')
    }
  })
})
