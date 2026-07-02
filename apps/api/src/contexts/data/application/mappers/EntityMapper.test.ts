import { describe, it, expect } from 'vitest'
import { EntityMapper } from '@/contexts/data/application/mappers/EntityMapper'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

const build = (): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Orders', new Date(5), {
    createdBy: 'u1',
    description: 'sales orders',
  })
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  e.addField({ name: 'title', required: true, type: { kind: 'text' }, id: 'f-title' }, new Date(0))
  e.addField({ name: 'amount', required: false, type: { kind: 'number' }, id: 'f-amount' }, new Date(0))
  return e
}

describe('EntityMapper', () => {
  it('toPersistence captures the header and structured field descriptors', () => {
    const row = EntityMapper.toPersistence(build())
    expect(row).toMatchObject({
      id: 'ent-1',
      name: 'Orders',
      slug: 'orders',
      description: 'sales orders',
      createdBy: 'u1',
    })
    expect(row.createdAt).toEqual(new Date(5))
    expect(row.fields.map((f) => f.name)).toEqual(['title', 'amount'])
    expect(row.fields[0].type.kind).toBe('text')
  })

  it('round-trips toPersistence -> toDomain losslessly', () => {
    const original = build()
    const rebuilt = EntityMapper.toDomain(EntityMapper.toPersistence(original))

    expect(rebuilt.id.value).toBe('ent-1')
    expect(rebuilt.name).toBe('Orders')
    expect(rebuilt.slug).toBe('orders')
    expect(rebuilt.description).toBe('sales orders')
    expect(rebuilt.createdBy).toBe('u1')
    expect(rebuilt.createdAt).toEqual(new Date(5))
    expect(rebuilt.fields().map((f) => f.name.value)).toEqual(['title', 'amount'])
    expect(rebuilt.fieldById('f-amount')?.type.kind).toBe('number')
    // Rehydration produces no domain events.
    expect(rebuilt.pullEvents()).toHaveLength(0)
  })
})
