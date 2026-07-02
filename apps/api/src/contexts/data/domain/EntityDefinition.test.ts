import { describe, it, expect } from 'vitest'
import { EntityDefinition, FieldDescriptor } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

const NOW = new Date(0)
const id = () => EntityId.of('ent-1')

const desc = (over: Partial<FieldDescriptor> & { name: string }): FieldDescriptor => ({
  required: false,
  type: { kind: 'text' },
  ...over,
})

describe('EntityDefinition.create', () => {
  it('creates with a derived slug and records EntityCreated', () => {
    const r = EntityDefinition.create(id(), '  Sales Orders  ', NOW, {
      createdBy: 'u1',
      description: 'desc',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const e = r.value
    expect(e.name).toBe('Sales Orders') // trimmed
    expect(e.slug).toBe('sales_orders')
    expect(e.createdBy).toBe('u1')
    expect(e.description).toBe('desc')
    const events = e.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.name).toBe('data.EntityCreated')
  })

  it('rejects an empty/whitespace name', () => {
    expect(EntityDefinition.create(id(), '   ', NOW).ok).toBe(false)
    expect(EntityDefinition.create(id(), '', NOW).ok).toBe(false)
  })
})

describe('EntityDefinition.addField', () => {
  const fresh = () => {
    const r = EntityDefinition.create(id(), 'Things', NOW)
    if (!r.ok) throw new Error(r.error)
    return r.value
  }

  it('adds a field and records FieldAdded', () => {
    const e = fresh()
    e.pullEvents() // drop EntityCreated
    const added = e.addField(desc({ name: 'title', type: { kind: 'text' } }), NOW)
    expect(added.ok).toBe(true)
    expect(e.fields().map((f) => f.name.value)).toEqual(['title'])
    const events = e.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.name).toBe('data.FieldAdded')
  })

  it('rejects a duplicate field name', () => {
    const e = fresh()
    expect(e.addField(desc({ name: 'title' }), NOW).ok).toBe(true)
    const dup = e.addField(desc({ name: 'title' }), NOW)
    expect(dup.ok).toBe(false)
    if (dup.ok) return
    expect(dup.error).toContain('already exists')
  })

  it('rejects an invalid field name (not snake_case)', () => {
    const e = fresh()
    const r = e.addField(desc({ name: 'Bad Name' }), NOW)
    expect(r.ok).toBe(false)
  })

  it('allows a formula referencing an already-declared field', () => {
    const e = fresh()
    expect(e.addField(desc({ name: 'price', type: { kind: 'number' } }), NOW).ok).toBe(true)
    const r = e.addField(
      desc({ name: 'taxed', type: { kind: 'formula', expression: 'price * 1.1' } }),
      NOW,
    )
    expect(r.ok).toBe(true)
  })

  it('rejects a formula referencing a field that does not exist yet', () => {
    const e = fresh()
    const r = e.addField(
      desc({ name: 'total', type: { kind: 'formula', expression: 'price * qty' } }),
      NOW,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('unknown field')
  })
})

describe('EntityDefinition.removeField', () => {
  const withFields = () => {
    const r = EntityDefinition.create(id(), 'Things', NOW)
    if (!r.ok) throw new Error(r.error)
    const e = r.value
    e.addField(desc({ name: 'price', type: { kind: 'number' }, id: 'f-price' }), NOW)
    e.addField(desc({ name: 'qty', type: { kind: 'number' } }), NOW)
    return e
  }

  it('removes a field by name', () => {
    const e = withFields()
    const r = e.removeField('qty')
    expect(r.ok).toBe(true)
    expect(e.fields().map((f) => f.name.value)).toEqual(['price'])
  })

  it('removes a field by its stable id', () => {
    const e = withFields()
    const r = e.removeField('f-price')
    expect(r.ok).toBe(true)
    expect(e.fields().map((f) => f.name.value)).toEqual(['qty'])
  })

  it('blocks removal of a field a formula depends on', () => {
    const e = withFields()
    e.addField(desc({ name: 'total', type: { kind: 'formula', expression: 'price * qty' } }), NOW)
    const r = e.removeField('price')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('used by formula "total"')
    // price is still there.
    expect(e.fields().some((f) => f.name.value === 'price')).toBe(true)
  })

  it('fails for an unknown field', () => {
    const e = withFields()
    expect(e.removeField('nope').ok).toBe(false)
  })
})

describe('EntityDefinition.toSchema', () => {
  it('projects fields into a working RecordSchema', () => {
    const r = EntityDefinition.create(id(), 'Things', NOW)
    if (!r.ok) throw new Error(r.error)
    const e = r.value
    e.addField(desc({ name: 'title', type: { kind: 'text' }, required: true }), NOW)
    const schema = e.toSchema()
    expect(schema.validate({ title: 'hi' }).ok).toBe(true)
    expect(schema.validate({}).ok).toBe(false) // title required
  })
})

describe('EntityDefinition.rehydrate', () => {
  it('rebuilds fields from descriptors without emitting events', () => {
    const r = EntityDefinition.rehydrate(
      id(),
      'Things',
      [
        desc({ name: 'price', type: { kind: 'number' } }),
        desc({ name: 'qty', type: { kind: 'number' } }),
        desc({ name: 'total', type: { kind: 'formula', expression: 'price * qty' } }),
      ],
      { slug: 'custom_slug', createdBy: 'u9' },
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const e = r.value
    expect(e.fields()).toHaveLength(3)
    expect(e.slug).toBe('custom_slug')
    expect(e.createdBy).toBe('u9')
    expect(e.pullEvents()).toHaveLength(0) // silent rehydrate
  })

  it('derives the slug from the name when none is supplied', () => {
    const r = EntityDefinition.rehydrate(id(), 'My Entity', [])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.slug).toBe('my_entity')
  })

  it('fails when a descriptor is invalid (formula ref before its target)', () => {
    const r = EntityDefinition.rehydrate(id(), 'Things', [
      desc({ name: 'total', type: { kind: 'formula', expression: 'price * 2' } }),
      desc({ name: 'price', type: { kind: 'number' } }),
    ])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('rehydrate')
  })
})
