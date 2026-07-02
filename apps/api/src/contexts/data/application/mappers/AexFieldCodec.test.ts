import { describe, it, expect } from 'vitest'
import { AexFieldCodec } from '@/contexts/data/application/mappers/AexFieldCodec'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Field } from '@/contexts/data/domain/Field'

// Build a domain entity with a spread of field types so we can pull real Field
// objects to feed the codec's reverse direction (toAex / serialize).
const buildEntity = (): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Catalog', new Date(0))
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  const add = (d: Parameters<EntityDefinition['addField']>[0]) => {
    const r = e.addField(d, new Date(0))
    if (!r.ok) throw new Error(r.error)
  }
  add({ name: 'price', required: false, type: { kind: 'number' }, id: 'f-price' })
  add({ name: 'title', required: true, type: { kind: 'text' }, id: 'f-title', displayName: 'Title' })
  add({ name: 'active', required: false, type: { kind: 'boolean' }, id: 'f-active' })
  add({
    name: 'status',
    required: false,
    id: 'f-status',
    type: { kind: 'select', options: [{ value: 'open', label: 'Open' }] },
  })
  add({
    name: 'owner',
    required: false,
    id: 'f-owner',
    type: { kind: 'relation', targetEntityId: 'ent-2', targetEntityName: 'Users' },
  })
  add({ name: 'total', required: false, type: { kind: 'formula', expression: 'price * 2' }, id: 'f-total' })
  return e
}

const fieldBySlug = (e: EntityDefinition, slug: string): Field => {
  const f = e.fields().find((x) => x.name.value === slug)
  if (!f) throw new Error(`no field ${slug}`)
  return f
}

describe('AexFieldCodec.toAex', () => {
  it('maps boolean to the AEX "checkbox" type string', () => {
    const aex = AexFieldCodec.toAex(fieldBySlug(buildEntity(), 'active'))
    expect(aex.type).toBe('checkbox')
    expect(aex.slug).toBe('active')
  })

  it('maps relation to "relationship" and carries the target entity id/name', () => {
    const aex = AexFieldCodec.toAex(fieldBySlug(buildEntity(), 'owner'))
    expect(aex.type).toBe('relationship')
    expect(aex.relationshipEntityId).toBe('ent-2')
    expect(aex.relationshipEntityName).toBe('Users')
  })

  it('carries select options and the formula expression', () => {
    const e = buildEntity()
    expect(AexFieldCodec.toAex(fieldBySlug(e, 'status')).options).toEqual([{ value: 'open', label: 'Open' }])
    expect(AexFieldCodec.toAex(fieldBySlug(e, 'total')).formula).toBe('price * 2')
  })

  it('uses displayName for name and falls back to slug when absent', () => {
    const e = buildEntity()
    expect(AexFieldCodec.toAex(fieldBySlug(e, 'title')).name).toBe('Title')
    expect(AexFieldCodec.toAex(fieldBySlug(e, 'price')).name).toBe('price')
  })
})

describe('AexFieldCodec.serialize / parse round-trip', () => {
  it('survives serialize -> parse preserving slug, type kind and required', () => {
    const e = buildEntity()
    const json = AexFieldCodec.serialize(e.fields())
    const descriptors = AexFieldCodec.parse(json)

    expect(descriptors.map((d) => d.name)).toEqual(['price', 'title', 'active', 'status', 'owner', 'total'])
    const byName = Object.fromEntries(descriptors.map((d) => [d.name, d]))
    // boolean/relation kinds restored from the checkbox/relationship strings.
    expect(byName['active'].type.kind).toBe('boolean')
    expect(byName['owner'].type.kind).toBe('relation')
    expect(byName['title'].required).toBe(true)
  })

  it('returns [] for unparseable JSON', () => {
    expect(AexFieldCodec.parse('not json')).toEqual([])
  })
})

describe('AexFieldCodec.toDescriptor', () => {
  it('migrates legacy string options to {value,label} pairs', () => {
    const [descriptor] = AexFieldCodec.parse(
      JSON.stringify([
        { id: 'f1', name: 'Status', slug: 'status', type: 'select', required: false, options: ['open', 'closed'] },
      ]),
    )
    expect(descriptor.type).toMatchObject({
      kind: 'select',
      options: [
        { value: 'open', label: 'open' },
        { value: 'closed', label: 'closed' },
      ],
    })
  })

  it('defaults required to false and uses slug as the domain field name', () => {
    const d = AexFieldCodec.toDescriptor({ id: 'f1', name: 'Title', slug: 'title', type: 'text' } as never)
    expect(d.name).toBe('title')
    expect(d.required).toBe(false)
    expect(d.displayName).toBe('Title')
  })
})
