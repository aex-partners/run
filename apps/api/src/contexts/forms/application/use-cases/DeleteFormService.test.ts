import { describe, it, expect } from 'vitest'
import { DeleteFormService } from '@/contexts/forms/application/use-cases/DeleteFormService'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function existingForm(id: string): Form {
  const r = Form.create(FormId.of(id), EntityRef.of('ent-1'), 'Signup', [], defaultFormSettings(), 'u', NOW)
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

class FakeForms implements FormRepository {
  deleted: string[] = []
  constructor(private readonly byId: Map<string, Form> = new Map()) {}
  nextId(): FormId {
    return FormId.of('x')
  }
  nextFieldId(): string {
    return 'fid'
  }
  nextToken(): string {
    return 'tok'
  }
  async findById(id: FormId): Promise<Form | null> {
    return this.byId.get(id.value) ?? null
  }
  async findByToken(): Promise<Form | null> {
    return null
  }
  async save(): Promise<void> {}
  async delete(id: FormId): Promise<void> {
    this.deleted.push(id.value)
  }
}

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('DeleteFormService', () => {
  it('deletes an existing form and publishes FormDeleted', async () => {
    const forms = new FakeForms(new Map([['f1', existingForm('f1')]]))
    const events = new FakeEvents()
    const svc = new DeleteFormService(forms, events, clock)

    const r = await svc.execute({ id: 'f1' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ success: true })
    expect(forms.deleted).toEqual(['f1'])
    expect(events.published.some((e) => e.name === 'forms.FormDeleted')).toBe(true)
  })

  it('is idempotent: deletes by id and publishes nothing when the form is absent', async () => {
    const forms = new FakeForms()
    const events = new FakeEvents()
    const svc = new DeleteFormService(forms, events, clock)

    const r = await svc.execute({ id: 'gone' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ success: true })
    expect(forms.deleted).toEqual(['gone'])
    expect(events.published).toHaveLength(0)
  })
})
