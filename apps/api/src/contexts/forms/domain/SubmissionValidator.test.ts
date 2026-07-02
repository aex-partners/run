import { describe, it, expect } from 'vitest'
import { SubmissionValidator } from '@/contexts/forms/domain/SubmissionValidator'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'

function field(over: Partial<EntityFieldSpec> & { slug: string; type: string }): EntityFieldSpec {
  return { id: over.slug, name: over.slug, required: false, ...over }
}

describe('SubmissionValidator required checks', () => {
  it('passes when all required fields are present', () => {
    const fields = [field({ slug: 'name', type: 'text', required: true })]
    expect(SubmissionValidator.validate({ name: 'Alice' }, fields).ok).toBe(true)
  })

  it('fails when a required field is missing, null, or empty string', () => {
    const fields = [field({ slug: 'name', name: 'Name', type: 'text', required: true })]
    expect(SubmissionValidator.validate({}, fields).ok).toBe(false)
    expect(SubmissionValidator.validate({ name: null }, fields).ok).toBe(false)
    expect(SubmissionValidator.validate({ name: '' }, fields).ok).toBe(false)
  })

  it('skips required checks for computed/system field types', () => {
    const fields = [
      field({ slug: 'cf', type: 'formula', required: true }),
      field({ slug: 'cb', type: 'created_by', required: true }),
    ]
    expect(SubmissionValidator.validate({}, fields).ok).toBe(true)
  })
})

describe('SubmissionValidator unknown / computed value rejection', () => {
  it('rejects an unknown field key', () => {
    const r = SubmissionValidator.validate({ ghost: 1 }, [field({ slug: 'name', type: 'text' })])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Unknown field')
  })

  it('rejects setting a derived field', () => {
    const r = SubmissionValidator.validate({ total: 5 }, [field({ slug: 'total', name: 'Total', type: 'formula' })])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('computed')
  })

  it('ignores a client value for a system field', () => {
    const r = SubmissionValidator.validate({ created_at: 'whatever' }, [field({ slug: 'created_at', type: 'created_at' })])
    expect(r.ok).toBe(true)
  })
})

describe('SubmissionValidator type checks', () => {
  it('number: accepts numbers and numeric strings, rejects non-numeric', () => {
    const fields = [field({ slug: 'n', name: 'N', type: 'number' })]
    expect(SubmissionValidator.validate({ n: 42 }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ n: '42' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ n: 'abc' }, fields).ok).toBe(false)
  })

  it('email: requires an @', () => {
    const fields = [field({ slug: 'e', name: 'E', type: 'email' })]
    expect(SubmissionValidator.validate({ e: 'a@b.com' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ e: 'nope' }, fields).ok).toBe(false)
  })

  it('url: requires http(s)://', () => {
    const fields = [field({ slug: 'u', name: 'U', type: 'url' })]
    expect(SubmissionValidator.validate({ u: 'https://x.com' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ u: 'ftp://x' }, fields).ok).toBe(false)
  })

  it('checkbox: accepts boolean or "true"/"false" strings', () => {
    const fields = [field({ slug: 'c', name: 'C', type: 'checkbox' })]
    expect(SubmissionValidator.validate({ c: true }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ c: 'true' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ c: 'maybe' }, fields).ok).toBe(false)
  })

  it('select: must be one of the option values', () => {
    const fields = [
      field({
        slug: 's',
        name: 'S',
        type: 'select',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ]
    expect(SubmissionValidator.validate({ s: 'a' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ s: 'z' }, fields).ok).toBe(false)
  })

  it('multiselect: every comma-separated value must be a valid option', () => {
    const fields = [
      field({
        slug: 'm',
        name: 'M',
        type: 'multiselect',
        options: [
          { value: 'x', label: 'X' },
          { value: 'y', label: 'Y' },
        ],
      }),
    ]
    expect(SubmissionValidator.validate({ m: 'x, y' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ m: 'x, z' }, fields).ok).toBe(false)
  })

  it('rating: must be within 0..maxRating', () => {
    const fields = [field({ slug: 'r', name: 'R', type: 'rating', maxRating: 3 })]
    expect(SubmissionValidator.validate({ r: 2 }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ r: 5 }, fields).ok).toBe(false)
  })

  it('json: a string value must parse', () => {
    const fields = [field({ slug: 'j', name: 'J', type: 'json' })]
    expect(SubmissionValidator.validate({ j: '{"a":1}' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ j: '{bad' }, fields).ok).toBe(false)
  })

  it('date: a string value must be parseable', () => {
    const fields = [field({ slug: 'd', name: 'D', type: 'date' })]
    expect(SubmissionValidator.validate({ d: '2024-01-01' }, fields).ok).toBe(true)
    expect(SubmissionValidator.validate({ d: 'not-a-date' }, fields).ok).toBe(false)
  })

  it('aggregates multiple errors into one message', () => {
    const fields = [
      field({ slug: 'name', name: 'Name', type: 'text', required: true }),
      field({ slug: 'e', name: 'E', type: 'email' }),
    ]
    const r = SubmissionValidator.validate({ e: 'bad' }, fields)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Name')
      expect(r.error).toContain('E')
    }
  })
})
