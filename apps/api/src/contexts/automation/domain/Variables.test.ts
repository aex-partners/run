import { describe, it, expect } from 'vitest'
import { resolveVariables } from '@/contexts/automation/domain/Variables'
import { JsonObject } from '@/shared/domain/Json'

const state: JsonObject = {
  trigger: { email: 'a@b.com', count: 3 },
  step_1: { output: { items: [{ name: 'x' }, { name: 'y' }], ok: true } },
}

describe('resolveVariables (engine variable-service)', () => {
  it('full-string reference returns the value with its type preserved', () => {
    expect(resolveVariables('{{trigger.count}}', state)).toBe(3)
    expect(resolveVariables('{{step_1.output.ok}}', state)).toBe(true)
  })

  it('resolves bracket array indexing', () => {
    expect(resolveVariables('{{step_1.output.items[0].name}}', state)).toBe('x')
    expect(resolveVariables('{{step_1.output.items[1].name}}', state)).toBe('y')
  })

  it('embedded reference is string-substituted', () => {
    expect(resolveVariables('mailto:{{trigger.email}}', state)).toBe('mailto:a@b.com')
  })

  it('embedded object reference is JSON.stringified', () => {
    expect(resolveVariables('items={{step_1.output.items}}', state)).toBe(
      'items=[{"name":"x"},{"name":"y"}]',
    )
  })

  it('missing path -> null for a full-string reference', () => {
    expect(resolveVariables('{{trigger.missing}}', state)).toBeNull()
  })

  it('missing path -> empty string when embedded', () => {
    expect(resolveVariables('x={{trigger.missing}}', state)).toBe('x=')
  })

  it('recurses through arrays and objects', () => {
    const out = resolveVariables(
      { to: '{{trigger.email}}', list: ['{{trigger.count}}', 'lit'] },
      state,
    )
    expect(out).toEqual({ to: 'a@b.com', list: [3, 'lit'] })
  })

  it('returns null and scalars unchanged', () => {
    expect(resolveVariables(null, state)).toBeNull()
    expect(resolveVariables(false, state)).toBe(false)
    expect(resolveVariables(10, state)).toBe(10)
  })

  it('indexing into a non-array with a numeric segment yields undefined -> null', () => {
    expect(resolveVariables('{{trigger.email.0}}', state)).toBeNull()
  })
})
