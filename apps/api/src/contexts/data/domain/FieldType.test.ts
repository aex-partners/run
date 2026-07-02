import { describe, it, expect } from 'vitest'
import { FieldTypeFactory, FieldTypeConfig } from '@/contexts/data/domain/FieldType'

// Helper: build a strategy from its descriptor (the only public construction path).
const make = (config: FieldTypeConfig, available: readonly string[] = []) => {
  const r = FieldTypeFactory.create(config, available)
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('FieldType: text family', () => {
  it('text accepts strings and null, rejects numbers', () => {
    const t = make({ kind: 'text' })
    expect(t.computed).toBe(false)
    expect(t.castKind()).toBe('text')
    expect(t.validate('hi')).toEqual({ ok: true, value: 'hi' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate(42).ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'text' })
  })

  it('free-text kinds (long_text/rich_text/phone/person/barcode/attachment) behave like text', () => {
    for (const kind of ['long_text', 'rich_text', 'phone', 'person', 'barcode', 'attachment'] as const) {
      const t = make({ kind })
      expect(t.kind).toBe(kind)
      expect(t.computed).toBe(false)
      expect(t.validate('x').ok).toBe(true)
      expect(t.validate(null)).toEqual({ ok: true, value: null })
      expect(t.validate(1).ok).toBe(false)
      expect(t.toConfig()).toEqual({ kind })
    }
  })

  it('email requires an @ but allows null/empty', () => {
    const t = make({ kind: 'email' })
    expect(t.validate('a@b.com').ok).toBe(true)
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate('nope').ok).toBe(false)
    expect(t.validate(5).ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'email' })
  })

  it('url requires http(s):// but allows null/empty', () => {
    const t = make({ kind: 'url' })
    expect(t.validate('https://x.com').ok).toBe(true)
    expect(t.validate('http://x.com').ok).toBe(true)
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate('ftp://x').ok).toBe(false)
    expect(t.validate('x.com').ok).toBe(false)
    expect(t.validate(9).ok).toBe(false)
  })

  it('ai accepts strings, null, carries its prompt in config', () => {
    const t = make({ kind: 'ai', aiPrompt: 'summarize' })
    expect(t.computed).toBe(false)
    expect(t.validate('text').ok).toBe(true)
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate(3).ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'ai', aiPrompt: 'summarize' })
    // No prompt -> no aiPrompt key.
    expect(make({ kind: 'ai' }).toConfig()).toEqual({ kind: 'ai' })
  })

  it('json validates parseable strings and accepts JSON values', () => {
    const t = make({ kind: 'json' })
    expect(t.validate('{"a":1}').ok).toBe(true)
    expect(t.validate('not json').ok).toBe(false)
    expect(t.validate({ a: 1 }).ok).toBe(true)
    expect(t.validate([1, 2]).ok).toBe(true)
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.toConfig()).toEqual({ kind: 'json' })
  })
})

describe('FieldType: numeric family', () => {
  it('number accepts numbers and null, rejects numeric strings', () => {
    const t = make({ kind: 'number' })
    expect(t.castKind()).toBe('numeric')
    expect(t.validate(42)).toEqual({ ok: true, value: 42 })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate('42').ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'number' })
  })

  it('decimal/percent/duration accept numeric strings; currency carries config', () => {
    const dec = make({ kind: 'decimal', decimalPlaces: 2 })
    expect(dec.validate('12.5').ok).toBe(true)
    expect(dec.validate(12.5).ok).toBe(true)
    expect(dec.validate('abc').ok).toBe(false)
    expect(dec.validate('')).toEqual({ ok: true, value: '' })
    expect(dec.toConfig()).toEqual({ kind: 'decimal', decimalPlaces: 2 })

    const cur = make({ kind: 'currency', currencyCode: 'USD', decimalPlaces: 2 })
    expect(cur.toConfig()).toEqual({ kind: 'currency', currencyCode: 'USD', decimalPlaces: 2 })

    const pct = make({ kind: 'percent' })
    expect(pct.validate('10').ok).toBe(true)
    expect(pct.toConfig()).toEqual({ kind: 'percent' })

    const dur = make({ kind: 'duration' })
    expect(dur.castKind()).toBe('numeric')
    expect(dur.toConfig()).toEqual({ kind: 'duration' })
  })

  it('rating enforces 0..maxRating', () => {
    const t = make({ kind: 'rating', maxRating: 5 })
    expect(t.validate(3).ok).toBe(true)
    expect(t.validate(0).ok).toBe(true)
    expect(t.validate(5).ok).toBe(true)
    expect(t.validate(6).ok).toBe(false)
    expect(t.validate(-1).ok).toBe(false)
    expect(t.validate('not-num').ok).toBe(false)
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.toConfig()).toEqual({ kind: 'rating', maxRating: 5 })
    // Default maxRating is 5.
    expect(make({ kind: 'rating' }).toConfig()).toEqual({ kind: 'rating', maxRating: 5 })
  })
})

describe('FieldType: date family', () => {
  it('date/datetime accept ISO strings and null/empty', () => {
    const d = make({ kind: 'date' })
    expect(d.castKind()).toBe('date')
    expect(d.validate('2024-01-01').ok).toBe(true)
    expect(d.validate('not-a-date').ok).toBe(false)
    expect(d.validate('')).toEqual({ ok: true, value: '' })
    expect(d.validate(null)).toEqual({ ok: true, value: null })
    expect(d.validate(123).ok).toBe(false)
    expect(d.toConfig()).toEqual({ kind: 'date' })

    const dt = make({ kind: 'datetime' })
    expect(dt.validate('2024-01-01T10:00:00Z').ok).toBe(true)
    expect(dt.toConfig()).toEqual({ kind: 'datetime' })
  })
})

describe('FieldType: boolean', () => {
  it('coerces "true"/"false" strings and accepts booleans', () => {
    const t = make({ kind: 'boolean' })
    expect(t.castKind()).toBe('text')
    expect(t.validate(true)).toEqual({ ok: true, value: true })
    expect(t.validate(false)).toEqual({ ok: true, value: false })
    expect(t.validate('true')).toEqual({ ok: true, value: true })
    expect(t.validate('false')).toEqual({ ok: true, value: false })
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate('maybe').ok).toBe(false)
    expect(t.validate(1).ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'boolean' })
  })
})

describe('FieldType: choice family', () => {
  const options = [
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Done', color: 'green' },
  ]

  it('select validates against its option values', () => {
    const t = make({ kind: 'select', options })
    expect(t.validate('open').ok).toBe(true)
    expect(t.validate('nope').ok).toBe(false)
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.toConfig()).toEqual({ kind: 'select', options })
  })

  it('status/priority share the select strategy', () => {
    for (const kind of ['status', 'priority'] as const) {
      const t = make({ kind, options })
      expect(t.kind).toBe(kind)
      expect(t.validate('done').ok).toBe(true)
      expect(t.validate('bad').ok).toBe(false)
      expect(t.toConfig()).toEqual({ kind, options })
    }
  })

  it('select with no options accepts any value', () => {
    const t = make({ kind: 'select', options: [] })
    expect(t.validate('anything').ok).toBe(true)
  })

  it('multiselect validates each comma-separated value', () => {
    const t = make({ kind: 'multiselect', options })
    expect(t.validate('open,done').ok).toBe(true)
    expect(t.validate('open, done').ok).toBe(true)
    expect(t.validate('open,bad').ok).toBe(false)
    expect(t.validate('')).toEqual({ ok: true, value: '' })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.toConfig()).toEqual({ kind: 'multiselect', options })
  })
})

describe('FieldType: relation', () => {
  it('accepts a string id, null; rejects non-strings; carries target in config', () => {
    const t = make({ kind: 'relation', targetEntityId: 'ent-1', targetEntityName: 'Customers' })
    expect(t.computed).toBe(false)
    expect(t.validate('rec-1').ok).toBe(true)
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate(7).ok).toBe(false)
    expect(t.toConfig()).toEqual({
      kind: 'relation',
      targetEntityId: 'ent-1',
      targetEntityName: 'Customers',
    })
    // targetEntityName is omitted when absent.
    expect(make({ kind: 'relation', targetEntityId: 'ent-2' }).toConfig()).toEqual({
      kind: 'relation',
      targetEntityId: 'ent-2',
    })
  })
})

describe('FieldType: computed/derived', () => {
  it('lookup/rollup/autonumber are computed and reject manual values', () => {
    const lookup = make({ kind: 'lookup', viaFieldId: 'v', lookupFieldId: 'l' })
    expect(lookup.computed).toBe(true)
    expect(lookup.validate(null)).toEqual({ ok: true, value: null })
    expect(lookup.validate('anything').ok).toBe(false)
    expect(lookup.castKind()).toBe('text')
    expect(lookup.toConfig()).toEqual({ kind: 'lookup', viaFieldId: 'v', lookupFieldId: 'l' })

    const rollup = make({ kind: 'rollup', viaFieldId: 'v', lookupFieldId: 'l', rollupFunction: 'sum' })
    expect(rollup.computed).toBe(true)
    expect(rollup.toConfig()).toEqual({
      kind: 'rollup',
      viaFieldId: 'v',
      lookupFieldId: 'l',
      rollupFunction: 'sum',
    })

    const auto = make({ kind: 'autonumber' })
    expect(auto.computed).toBe(true)
    expect(auto.castKind()).toBe('numeric')
    expect(auto.validate(1).ok).toBe(false)
    expect(auto.toConfig()).toEqual({ kind: 'autonumber' })
  })

  it('formula is computed: rejects manual non-number values, accepts numbers/null', () => {
    const t = make({ kind: 'formula', expression: 'a + b' }, ['a', 'b'])
    expect(t.computed).toBe(true)
    expect(t.castKind()).toBe('numeric')
    expect(t.validate(10)).toEqual({ ok: true, value: 10 })
    expect(t.validate(null)).toEqual({ ok: true, value: null })
    expect(t.validate('x').ok).toBe(false)
    expect(t.toConfig()).toEqual({ kind: 'formula', expression: 'a + b' })
  })

  it('formula referencing an unknown field fails to construct', () => {
    const r = FieldTypeFactory.create({ kind: 'formula', expression: 'a + missing' }, ['a'])
    expect(r.ok).toBe(false)
  })

  it('system fields are computed, always valid, and classify their cast kind', () => {
    const createdAt = make({ kind: 'created_at' })
    expect(createdAt.computed).toBe(true)
    expect(createdAt.castKind()).toBe('date')
    expect(createdAt.validate('whatever').ok).toBe(true)
    expect(createdAt.toConfig()).toEqual({ kind: 'created_at' })

    expect(make({ kind: 'updated_at' }).castKind()).toBe('date')
    expect(make({ kind: 'created_by' }).castKind()).toBe('text')
    expect(make({ kind: 'updated_by' }).castKind()).toBe('text')
    expect(make({ kind: 'created_by' }).validate(123).ok).toBe(true)
  })
})

describe('FieldTypeFactory', () => {
  it('reconstructs every kind in the closed set without error', () => {
    const configs: FieldTypeConfig[] = [
      { kind: 'text' },
      { kind: 'long_text' },
      { kind: 'rich_text' },
      { kind: 'number' },
      { kind: 'decimal' },
      { kind: 'currency' },
      { kind: 'percent' },
      { kind: 'date' },
      { kind: 'datetime' },
      { kind: 'duration' },
      { kind: 'boolean' },
      { kind: 'select', options: [] },
      { kind: 'multiselect', options: [] },
      { kind: 'status', options: [] },
      { kind: 'priority', options: [] },
      { kind: 'rating' },
      { kind: 'email' },
      { kind: 'url' },
      { kind: 'phone' },
      { kind: 'person' },
      { kind: 'relation', targetEntityId: 'e' },
      { kind: 'lookup' },
      { kind: 'rollup' },
      { kind: 'autonumber' },
      { kind: 'attachment' },
      { kind: 'json' },
      { kind: 'barcode' },
      { kind: 'ai' },
      { kind: 'created_at' },
      { kind: 'updated_at' },
      { kind: 'created_by' },
      { kind: 'updated_by' },
    ]
    for (const config of configs) {
      const r = FieldTypeFactory.create(config, [])
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value.kind).toBe(config.kind)
    }
  })
})
