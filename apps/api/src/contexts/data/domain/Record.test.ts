import { describe, it, expect } from 'vitest'
import { Record } from '@/contexts/data/domain/Record'
import { RecordSchema } from '@/contexts/data/domain/RecordSchema'
import { Field } from '@/contexts/data/domain/Field'
import { FieldName } from '@/contexts/data/domain/FieldName'
import { FieldTypeConfig, FieldTypeFactory, FieldType } from '@/contexts/data/domain/FieldType'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Version } from '@/contexts/data/domain/Version'

const NOW = new Date(0)

const field = (name: string, config: FieldTypeConfig, required = false): Field => {
  const fn = FieldName.of(name)
  if (!fn.ok) throw new Error(fn.error)
  const t = FieldTypeFactory.create(config, [])
  if (!t.ok) throw new Error(t.error)
  return new Field(fn.value, t.value as FieldType, required)
}

const schema = (...fields: Field[]) => new RecordSchema(fields)

describe('Record.create', () => {
  it('validates against the schema and starts at version 0', () => {
    const r = Record.create(
      RecordId.of('rec-1'),
      EntityId.of('ent-1'),
      schema(field('name', { kind: 'text' }, true)),
      { name: 'Acme' },
      NOW,
      { createdBy: 'u1' },
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const rec = r.value
    expect(rec.data).toEqual({ name: 'Acme' })
    expect(rec.version.value).toBe(0)
    expect(rec.createdBy).toBe('u1')
    const events = rec.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.name).toBe('data.RecordUpserted')
  })

  it('fails when the data violates the schema', () => {
    const r = Record.create(
      RecordId.of('rec-1'),
      EntityId.of('ent-1'),
      schema(field('name', { kind: 'text' }, true)),
      {},
      NOW,
    )
    expect(r.ok).toBe(false)
  })
})

describe('Record.update (Version CAS)', () => {
  const seed = () => {
    const r = Record.create(
      RecordId.of('rec-1'),
      EntityId.of('ent-1'),
      schema(field('name', { kind: 'text' }, true)),
      { name: 'Acme' },
      NOW,
    )
    if (!r.ok) throw new Error('seed failed')
    r.value.pullEvents() // drop create event
    return r.value
  }

  it('bumps the version and re-validates on a matching expected version', () => {
    const rec = seed()
    const r = rec.update(
      schema(field('name', { kind: 'text' }, true)),
      { name: 'Beta' },
      Version.of(0),
      NOW,
    )
    expect(r.ok).toBe(true)
    expect(rec.data).toEqual({ name: 'Beta' })
    expect(rec.version.value).toBe(1)
    const events = rec.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.name).toBe('data.RecordUpserted')
  })

  it('conflicts when the expected version is wrong, leaving state unchanged', () => {
    const rec = seed()
    const r = rec.update(
      schema(field('name', { kind: 'text' }, true)),
      { name: 'Beta' },
      Version.of(5),
      NOW,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('version conflict')
    expect(rec.data).toEqual({ name: 'Acme' }) // unchanged
    expect(rec.version.value).toBe(0) // not bumped
    expect(rec.pullEvents()).toHaveLength(0) // no event recorded
  })

  it('fails (and does not bump) when new data violates the schema', () => {
    const rec = seed()
    const r = rec.update(schema(field('name', { kind: 'text' }, true)), {}, Version.of(0), NOW)
    expect(r.ok).toBe(false)
    expect(rec.version.value).toBe(0)
  })
})

describe('Version VO', () => {
  it('initial is 0, next increments, equals compares by value', () => {
    expect(Version.initial().value).toBe(0)
    expect(Version.of(3).next().value).toBe(4)
    expect(Version.of(2).equals(Version.of(2))).toBe(true)
    expect(Version.of(2).equals(Version.of(3))).toBe(false)
  })
})
