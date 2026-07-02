import { describe, it, expect } from 'vitest'
import { resolveFieldRef, assertAggregatable, buildWhere } from '@/contexts/data/adapters/out/persistence/queryEngine'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Field } from '@/contexts/data/domain/Field'

// queryEngine is pure (it only BUILDS drizzle SQL fragments, never executes), so
// its resolver/guard helpers are unit-testable without a database.
const fields = (): Field[] => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Invoices', new Date(0))
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  e.addField({ name: 'amount', required: false, type: { kind: 'number' }, displayName: 'Amount' }, new Date(0))
  e.addField({ name: 'due', required: false, type: { kind: 'date' } }, new Date(0))
  e.addField({ name: 'name', required: false, type: { kind: 'text' } }, new Date(0))
  return [...e.fields()]
}

describe('queryEngine.resolveFieldRef', () => {
  it('resolves by slug', () => {
    expect(resolveFieldRef(fields(), 'amount').name.value).toBe('amount')
  })

  it('resolves by display name (case-insensitive)', () => {
    expect(resolveFieldRef(fields(), 'amount').name.value).toBe('amount')
    expect(resolveFieldRef(fields(), 'AMOUNT').name.value).toBe('amount')
  })

  it('throws on an unknown field, listing valid fields', () => {
    expect(() => resolveFieldRef(fields(), 'nope')).toThrow(/not found/)
    expect(() => resolveFieldRef(fields(), 'nope')).toThrow(/amount/)
  })
})

describe('queryEngine.assertAggregatable', () => {
  it('allows count on any field', () => {
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'name'), 'count')).not.toThrow()
  })

  it('allows sum/avg on a numeric field', () => {
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'amount'), 'sum')).not.toThrow()
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'amount'), 'avg')).not.toThrow()
  })

  it('allows min/max on a date field but not sum', () => {
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'due'), 'min')).not.toThrow()
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'due'), 'sum')).toThrow(/numeric/)
  })

  it('rejects sum on a text field', () => {
    expect(() => assertAggregatable(resolveFieldRef(fields(), 'name'), 'sum')).toThrow(/numeric/)
  })
})

describe('queryEngine.buildWhere', () => {
  it('returns undefined when there are no conditions', () => {
    expect(buildWhere(fields(), undefined)).toBeUndefined()
    expect(buildWhere(fields(), [])).toBeUndefined()
  })

  it('builds a fragment for a condition (does not throw)', () => {
    const sqlFrag = buildWhere(fields(), [{ field: 'amount', op: 'gte', value: 10 }])
    expect(sqlFrag).toBeDefined()
  })
})
