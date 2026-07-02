import { describe, it, expect } from 'vitest'
import { DescribeEntityService } from '@/contexts/data/application/use-cases/DescribeEntityService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

class FakeEntityRepository implements EntityRepository {
  store = new Map<string, EntityDefinition>()
  bySlug = new Map<string, EntityDefinition>()
  private seq = 0
  nextId(): EntityId {
    return EntityId.of(`ent-${++this.seq}`)
  }
  async findById(id: EntityId): Promise<EntityDefinition | null> {
    return this.store.get(id.value) ?? null
  }
  async findByRef(ref: string): Promise<EntityDefinition | null> {
    return this.store.get(ref) ?? this.bySlug.get(ref) ?? null
  }
  async save(entity: EntityDefinition): Promise<void> {
    this.store.set(entity.id.value, entity)
  }
  async delete(id: EntityId): Promise<void> {
    this.store.delete(id.value)
  }
}

const seed = (repo: FakeEntityRepository): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Tickets', new Date(0), {
    description: 'support tickets',
  })
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  e.addField({ name: 'title', required: true, type: { kind: 'text' }, id: 'fld-title', displayName: 'Title' }, new Date(0))
  e.addField(
    {
      name: 'status',
      required: false,
      id: 'fld-status',
      type: { kind: 'select', options: [{ value: 'open', label: 'Open' }] },
    },
    new Date(0),
  )
  e.addField({ name: 'stars', required: false, type: { kind: 'rating', maxRating: 5 }, id: 'fld-stars' }, new Date(0))
  e.addField(
    {
      name: 'owner',
      required: false,
      id: 'fld-owner',
      type: { kind: 'relation', targetEntityId: 'ent-2', targetEntityName: 'Users' },
    },
    new Date(0),
  )
  repo.store.set('ent-1', e)
  repo.bySlug.set('tickets', e)
  return e
}

describe('DescribeEntityService', () => {
  it('projects the entity header and fields by ref', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new DescribeEntityService(repo)

    const view = await service.execute('tickets')
    expect(view).not.toBeNull()
    if (!view) return
    expect(view.id).toBe('ent-1')
    expect(view.name).toBe('Tickets')
    expect(view.slug).toBe('tickets')
    expect(view.description).toBe('support tickets')
    expect(view.fields.map((f) => f.slug)).toEqual(['title', 'status', 'stars', 'owner'])
  })

  it('maps AEX-shape field attributes (type strings, options, maxRating, relationship)', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new DescribeEntityService(repo)

    const view = await service.execute('ent-1')
    if (!view) throw new Error('expected a view')
    const byId = Object.fromEntries(view.fields.map((f) => [f.id, f]))

    expect(byId['fld-title'].type).toBe('text')
    expect(byId['fld-title'].required).toBe(true)
    expect(byId['fld-status'].type).toBe('select')
    expect(byId['fld-status'].options).toEqual([{ value: 'open', label: 'Open' }])
    expect(byId['fld-stars'].maxRating).toBe(5)
    // relation is exposed under AEX's 'relationship' type string.
    expect(byId['fld-owner'].type).toBe('relationship')
    expect(byId['fld-owner'].relationshipEntityId).toBe('ent-2')
    expect(byId['fld-owner'].relationshipEntityName).toBe('Users')
  })

  it('returns null when the ref resolves to nothing', async () => {
    const repo = new FakeEntityRepository()
    const service = new DescribeEntityService(repo)
    expect(await service.execute('missing')).toBeNull()
  })
})
