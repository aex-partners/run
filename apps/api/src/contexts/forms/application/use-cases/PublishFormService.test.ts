import { describe, it, expect } from 'vitest'
import { PublishFormService } from '@/contexts/forms/application/use-cases/PublishFormService'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

function privateForm(id: string): Form {
  const r = Form.create(FormId.of(id), EntityRef.of('ent-1'), 'Signup', [], defaultFormSettings(), 'u', NOW)
  if (!r.ok) throw new Error('setup failed')
  r.value.pullEvents()
  return r.value
}

function publicForm(id: string, token: string): Form {
  const f = privateForm(id)
  f.togglePublic(token, NOW)
  f.pullEvents()
  return f
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
    return 'minted-token'
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

describe('PublishFormService', () => {
  it('mints a token, goes public, persists and publishes FormPublished', async () => {
    const forms = new FakeForms(new Map([['f1', privateForm('f1')]]))
    const events = new FakeEvents()
    const svc = new PublishFormService(forms, events, clock)

    const r = await svc.execute({ id: 'f1' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ isPublic: true, publicToken: 'minted-token' })
    expect(forms.saved).toHaveLength(1)
    expect(events.published.some((e) => e.name === 'forms.FormPublished')).toBe(true)
  })

  it('toggles a public form back to private but keeps the original token', async () => {
    const forms = new FakeForms(new Map([['f1', publicForm('f1', 'orig-token')]]))
    const svc = new PublishFormService(forms, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'f1' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ isPublic: false, publicToken: 'orig-token' })
  })

  it('fails when the form is not found', async () => {
    const forms = new FakeForms()
    const svc = new PublishFormService(forms, new FakeEvents(), clock)

    const r = await svc.execute({ id: 'missing' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Form not found')
    expect(forms.saved).toHaveLength(0)
  })
})
