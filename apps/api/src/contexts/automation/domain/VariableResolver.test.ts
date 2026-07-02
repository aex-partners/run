import { describe, it, expect } from 'vitest'
import { resolveTemplate } from '@/contexts/automation/domain/VariableResolver'
import { JsonObject } from '@/shared/domain/Json'

const vars: JsonObject = {
  trigger: { x: 5, name: 'Ada', nested: { deep: true } },
  step1: { total: 42, list: [1, 2, 3] },
}

describe('resolveTemplate', () => {
  it('full-string reference preserves the referenced value type (number)', () => {
    expect(resolveTemplate('{{trigger.x}}', vars)).toBe(5)
  })

  it('full-string reference preserves an object value', () => {
    expect(resolveTemplate('{{trigger.nested}}', vars)).toEqual({ deep: true })
  })

  it('resolves a {{stepId.field}} reference', () => {
    expect(resolveTemplate('{{step1.total}}', vars)).toBe(42)
  })

  it('embedded reference is string-substituted', () => {
    expect(resolveTemplate('Hi {{trigger.name}}!', vars)).toBe('Hi Ada!')
  })

  it('tolerates surrounding whitespace inside the braces', () => {
    expect(resolveTemplate('{{  trigger.x  }}', vars)).toBe(5)
  })

  it('missing path -> null for a full-string reference', () => {
    expect(resolveTemplate('{{trigger.nope}}', vars)).toBeNull()
  })

  it('missing path -> empty string when embedded', () => {
    expect(resolveTemplate('val=[{{trigger.nope}}]', vars)).toBe('val=[]')
  })

  it('recurses into objects and arrays', () => {
    const out = resolveTemplate(
      { a: '{{trigger.x}}', b: ['{{trigger.name}}', { c: '{{step1.total}}' }] },
      vars,
    )
    expect(out).toEqual({ a: 5, b: ['Ada', { c: 42 }] })
  })

  it('leaves non-string scalars untouched', () => {
    expect(resolveTemplate(true, vars)).toBe(true)
    expect(resolveTemplate(7, vars)).toBe(7)
    expect(resolveTemplate(null, vars)).toBeNull()
  })

  it('does not treat bracket paths as array indexing (getPath splits on dots only)', () => {
    // Documents the skeleton resolver's behavior: list[0] is not parsed.
    expect(resolveTemplate('{{step1.list}}', vars)).toEqual([1, 2, 3])
    expect(resolveTemplate('{{step1.list[0]}}', vars)).toBeNull()
  })
})
