import { describe, it, expect } from 'vitest'
import { CreateFormService } from '@/contexts/forms/application/use-cases/CreateFormService'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

const ENTITY_FIELDS: EntityFieldSpec[] = [
  { id: 'fld-name', name: 'Name', slug: 'name', type: 'text', required: true },
  { id: 'fld-email', name: 'Email', slug: 'email', type: 'email', required: false },
]

class FakeForms implements FormRepository {
  saved: Form[] = []
  deleted: string[] = []
  private fieldSeq = 0
  nextId(): FormId {
    return FormId.of('form-1')
  }
  nextFieldId(): string {
    return `field-${++this.fieldSeq}`
  }
  nextToken(): string {
    return 'tok'
  }
  async findById(): Promise<Form | null> {
    return null
  }
  async findByToken(): Promise<Form | null> {
    return null
  }
  async save(form: Form): Promise<void> {
    this.saved.push(form)
  }
  async delete(id: FormId): Promise<void> {
    this.deleted.push(id.value)
  }
}

const catalogOf = (fields: EntityFieldSpec[] | null): EntityCatalog => ({
  fieldsOf: async () => fields,
})

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('CreateFormService', () => {
  it('seeds one field per entity field, persists and publishes FormCreated', async () => {
    const forms = new FakeForms()
    const events = new FakeEvents()
    const svc = new CreateFormService(forms, catalogOf(ENTITY_FIELDS), events, clock)

    const r = await svc.execute({ entityId: 'ent-1', name: 'Signup', createdBy: 'u-1' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ id: 'form-1', name: 'Signup' })
    expect(forms.saved).toHaveLength(1)

    const saved = forms.saved[0]!
    const fields = saved.fields()
    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({ entityFieldId: 'fld-name', order: 0, required: true, visible: true })
    expect(fields[1]).toMatchObject({ entityFieldId: 'fld-email', order: 1, required: false, visible: true })
    expect(fields[0]!.id).toBe('field-1')
    expect(fields[1]!.id).toBe('field-2')
    expect(saved.entityId.value).toBe('ent-1')
    expect(saved.createdBy).toBe('u-1')
    expect(events.published.some((e) => e.name === 'forms.FormCreated')).toBe(true)
  })

  it('fails when the entity does not exist', async () => {
    const forms = new FakeForms()
    const svc = new CreateFormService(forms, catalogOf(null), new FakeEvents(), clock)

    const r = await svc.execute({ entityId: 'missing', name: 'Signup', createdBy: 'u-1' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Entity not found')
    expect(forms.saved).toHaveLength(0)
  })

  it('propagates a domain validation failure (blank name) without persisting', async () => {
    const forms = new FakeForms()
    const events = new FakeEvents()
    const svc = new CreateFormService(forms, catalogOf(ENTITY_FIELDS), events, clock)

    const r = await svc.execute({ entityId: 'ent-1', name: '   ', createdBy: 'u-1' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('name is required')
    expect(forms.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
