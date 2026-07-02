import { describe, it, expect } from 'vitest'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'

const NOW = new Date('2024-01-01T00:00:00.000Z')

function newForm(fields: FormField[] = []): Form {
  const r = Form.create(FormId.of('f1'), EntityRef.of('ent-1'), 'Contact', fields, defaultFormSettings(), 'user-1', NOW)
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

describe('Form.create', () => {
  it('creates a form and records FormCreated', () => {
    const r = Form.create(FormId.of('f1'), EntityRef.of('ent-1'), '  Contact  ', [], defaultFormSettings(), 'u', NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.name).toBe('Contact')
    expect(r.value.isPublic).toBe(false)
    expect(r.value.publicToken).toBeNull()
    expect(r.value.pullEvents().map((e) => e.name)).toEqual(['forms.FormCreated'])
  })

  it('rejects a blank name', () => {
    expect(Form.create(FormId.of('f1'), EntityRef.of('e'), '   ', [], defaultFormSettings(), 'u', NOW).ok).toBe(false)
  })
})

describe('Form.update', () => {
  it('updates only the provided fields', () => {
    const f = newForm()
    const r = f.update({ description: 'desc' }, NOW)
    expect(r.ok).toBe(true)
    expect(f.description).toBe('desc')
    expect(f.name).toBe('Contact')
    expect(f.pullEvents().map((e) => e.name)).toEqual(['forms.FormUpdated'])
  })

  it('rejects a blank name on update', () => {
    const f = newForm()
    expect(f.update({ name: '  ' }, NOW).ok).toBe(false)
  })
})

describe('Form.togglePublic', () => {
  it('mints a token the first time it goes public', () => {
    const f = newForm()
    const r = f.togglePublic('tok-123', NOW)
    expect(r.ok).toBe(true)
    expect(f.isPublic).toBe(true)
    expect(f.publicToken).toBe('tok-123')
    expect(f.pullEvents().map((e) => e.name)).toEqual(['forms.FormPublished'])
  })

  it('preserves the original token across toggles (mint once)', () => {
    const f = newForm()
    f.togglePublic('tok-123', NOW)
    f.togglePublic('tok-OTHER', NOW)
    expect(f.isPublic).toBe(false)
    expect(f.publicToken).toBe('tok-123')
    f.togglePublic('tok-AGAIN', NOW)
    expect(f.isPublic).toBe(true)
    expect(f.publicToken).toBe('tok-123')
  })
})

describe('Form.markDeleted', () => {
  it('records FormDeleted', () => {
    const f = newForm()
    f.markDeleted(NOW)
    expect(f.pullEvents().map((e) => e.name)).toEqual(['forms.FormDeleted'])
  })
})

describe('Form.buildSubmissionFields', () => {
  const entityFields: EntityFieldSpec[] = [
    { id: 'fld-1', name: 'Name', slug: 'name', type: 'text', required: false },
    { id: 'fld-2', name: 'Age', slug: 'age', type: 'number', required: true },
  ]

  it('maps visible form fields onto entity fields, applying the required override', () => {
    const f = newForm([
      { id: 'ff1', entityFieldId: 'fld-1', order: 0, required: true, visible: true },
      { id: 'ff2', entityFieldId: 'fld-2', order: 1, required: false, visible: true },
    ])
    const r = f.buildSubmissionFields(entityFields)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toHaveLength(2)
    expect(r.value[0]).toMatchObject({ slug: 'name', required: true })
    expect(r.value[1]).toMatchObject({ slug: 'age', required: false })
  })

  it('excludes non-visible form fields', () => {
    const f = newForm([{ id: 'ff1', entityFieldId: 'fld-1', order: 0, required: true, visible: false }])
    const r = f.buildSubmissionFields(entityFields)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toHaveLength(0)
  })

  it('fails when a form field references a field the entity no longer has', () => {
    const f = newForm([{ id: 'ff1', entityFieldId: 'gone', order: 0, required: true, visible: true }])
    const r = f.buildSubmissionFields(entityFields)
    expect(r.ok).toBe(false)
  })
})
