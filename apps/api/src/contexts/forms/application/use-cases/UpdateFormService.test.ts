import { describe, it, expect } from 'vitest'
import { UpdateFormService } from '@/contexts/forms/application/use-cases/UpdateFormService'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function existingForm(id: string): Form {
  const r = Form.create(FormId.of(id), EntityRef.of('ent-1'), 'Old name', [], defaultFormSettings(), 'u', NOW)
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

class FakeForms implements FormRepository {
  saved: Form[] = []
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
  async save(form: Form): Promise<void> {
    this.saved.push(form)
  }
  async delete(): Promise<void> {}
}

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('UpdateFormService', () => {
  it('applies the patch, persists and publishes FormUpdated', async () => {
    const form = existingForm('f1')
    const forms = new FakeForms(new Map([['f1', form]]))
    const events = new FakeEvents()
    const svc = new UpdateFormService(forms, events, clock)

    const r = await svc.execute({ id: 'f1', name: 'New name', description: 'desc' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ id: 'f1' })
    expect(forms.saved).toHaveLength(1)
    expect(form.name).toBe('New name')
    expect(form.description).toBe('desc')
    expect(events.published.some((e) => e.name === 'forms.FormUpdated')).toBe(true)
  })

  it('fails when the form is not found', async () => {
    const forms = new FakeForms()
    const svc = new UpdateFormService(forms, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'missing', name: 'x' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Form not found')
    expect(forms.saved).toHaveLength(0)
  })

  it('propagates a domain validation failure (blank name) without persisting', async () => {
    const forms = new FakeForms(new Map([['f1', existingForm('f1')]]))
    const events = new FakeEvents()
    const svc = new UpdateFormService(forms, events, clock)

    const r = await svc.execute({ id: 'f1', name: '   ' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('name is required')
    expect(forms.saved).toHaveLength(0)
    expect(events.published).toHaveLength(0)
  })
})
