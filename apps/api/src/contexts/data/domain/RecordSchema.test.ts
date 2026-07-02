import { describe, it, expect } from 'vitest'
import { RecordSchema } from '@/contexts/data/domain/RecordSchema'
import { Field } from '@/contexts/data/domain/Field'
import { FieldName } from '@/contexts/data/domain/FieldName'
import { FieldTypeConfig, FieldTypeFactory, FieldType } from '@/contexts/data/domain/FieldType'

// Build a Field VO directly from a descriptor (RecordSchema consumes Fields, not
// EntityDefinitions). `available` lets a formula see its referenced fields.
const field = (
  name: string,
  config: FieldTypeConfig,
  required = false,
  available: readonly string[] = [],
): Field => {
  const fn = FieldName.of(name)
  if (!fn.ok) throw new Error(fn.error)
  const t = FieldTypeFactory.create(config, available)
  if (!t.ok) throw new Error(t.error)
  return new Field(fn.value, t.value as FieldType, required)
}

describe('RecordSchema.validate', () => {
  it('accepts and coerces a valid record', () => {
    const schema = new RecordSchema([
      field('name', { kind: 'text' }),
      field('active', { kind: 'boolean' }),
    ])
    const r = schema.validate({ name: 'Acme', active: 'true' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // boolean string is coerced.
    expect(r.value).toEqual({ name: 'Acme', active: true })
  })

  it('rejects an unknown key', () => {
    const schema = new RecordSchema([field('name', { kind: 'text' })])
    const r = schema.validate({ name: 'x', bogus: 1 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('unknown field "bogus"')
  })

  it('fails when a required field is missing/null', () => {
    const schema = new RecordSchema([field('name', { kind: 'text' }, true)])
    const missing = schema.validate({})
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.error).toContain('is required')

    expect(schema.validate({ name: null }).ok).toBe(false)
  })

  it('defaults an omitted optional field to null', () => {
    const schema = new RecordSchema([field('nickname', { kind: 'text' })])
    const r = schema.validate({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ nickname: null })
  })

  it('propagates a per-field type error (prefixed with field name)', () => {
    const schema = new RecordSchema([field('count', { kind: 'number' })])
    const r = schema.validate({ count: 'not-a-number' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('record.count:')
  })

  it('computes a formula field and injects it into the output', () => {
    const schema = new RecordSchema([
      field('price', { kind: 'number' }),
      field('qty', { kind: 'number' }),
      field('total', { kind: 'formula', expression: 'price * qty' }, false, ['price', 'qty']),
    ])
    const r = schema.validate({ price: 10, qty: 3 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.total).toBe(30)
    expect(r.value.price).toBe(10)
  })

  it('does not require user input for a computed formula field', () => {
    const schema = new RecordSchema([
      field('a', { kind: 'number' }),
      field('double', { kind: 'formula', expression: 'a * 2' }, true, ['a']),
    ])
    // `double` is required=true but computed, so it is skipped in the required check.
    const r = schema.validate({ a: 4 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.double).toBe(8)
  })

  it('fails validation when a formula cannot be evaluated (ref not a number)', () => {
    const schema = new RecordSchema([
      field('price', { kind: 'number' }),
      field('total', { kind: 'formula', expression: 'price * 2' }, false, ['price']),
    ])
    const r = schema.validate({ price: null })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('record.total:')
  })

  it('skips non-formula computed fields entirely (no output key)', () => {
    const schema = new RecordSchema([
      field('name', { kind: 'text' }),
      field('seq', { kind: 'autonumber' }),
      field('created_at', { kind: 'created_at' }),
    ])
    const r = schema.validate({ name: 'x' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ name: 'x' })
    expect('seq' in r.value).toBe(false)
    expect('created_at' in r.value).toBe(false)
  })

  it('relationFields returns only relation-typed fields', () => {
    const schema = new RecordSchema([
      field('name', { kind: 'text' }),
      field('customer', { kind: 'relation', targetEntityId: 'ent-1' }),
    ])
    const rels = schema.relationFields()
    expect(rels.map((f) => f.name.value)).toEqual(['customer'])
  })
})
