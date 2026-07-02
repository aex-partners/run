import { describe, it, expect } from 'vitest'
import { SubmitFormService } from '@/contexts/forms/application/use-cases/SubmitFormService'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { FormSubmissionRepository } from '@/contexts/forms/application/ports/out/FormSubmissionRepository'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { EntityRecordSink } from '@/contexts/forms/application/ports/out/EntityRecordSink'
import { Form } from '@/contexts/forms/domain/Form'
import { FormId } from '@/contexts/forms/domain/FormId'
import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'
import { ok, fail, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

const NOW = new Date('2024-01-01T00:00:00.000Z')
const clock = { now: () => NOW }

const ENTITY_FIELDS: EntityFieldSpec[] = [
  { id: 'fld-name', name: 'Name', slug: 'name', type: 'text', required: true },
  { id: 'fld-email', name: 'Email', slug: 'email', type: 'email', required: false },
]

function publicForm(): Form {
  const fields: FormField[] = [
    { id: 'ff1', entityFieldId: 'fld-name', order: 0, required: true, visible: true },
    { id: 'ff2', entityFieldId: 'fld-email', order: 1, required: false, visible: true },
  ]
  const r = Form.create(FormId.of('f1'), EntityRef.of('ent-1'), 'Signup', fields, defaultFormSettings(), 'u', NOW)
  if (!r.ok) throw new Error('setup failed')
  r.value.togglePublic('tok-1', NOW)
  r.value.pullEvents()
  return r.value
}

class FakeForms implements FormRepository {
  constructor(private readonly byToken: Map<string, Form>) {}
  nextId(): FormId {
    return FormId.of('x')
  }
  nextFieldId(): string {
    return 'fid'
  }
  nextToken(): string {
    return 'tok'
  }
  async findById(): Promise<Form | null> {
    return null
  }
  async findByToken(token: string): Promise<Form | null> {
    return this.byToken.get(token) ?? null
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeSubmissions implements FormSubmissionRepository {
  saved: FormSubmission[] = []
  nextId(): FormSubmissionId {
    return FormSubmissionId.of('sub-1')
  }
  async save(submission: FormSubmission): Promise<void> {
    this.saved.push(submission)
  }
}

const catalogOf = (fields: EntityFieldSpec[] | null): EntityCatalog => ({
  fieldsOf: async () => fields,
})

class FakeSink implements EntityRecordSink {
  inserted: JsonObject[] = []
  constructor(private readonly result: Result<{ id: string }>) {}
  async insert(_entityId: string, data: JsonObject): Promise<Result<{ id: string }>> {
    this.inserted.push(data)
    return this.result
  }
}

class FakeEvents {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
}

describe('SubmitFormService', () => {
  it('validates, inserts the record, persists the submission and publishes', async () => {
    const submissions = new FakeSubmissions()
    const sink = new FakeSink(ok({ id: 'rec-9' }))
    const events = new FakeEvents()
    const svc = new SubmitFormService(
      new FakeForms(new Map([['tok-1', publicForm()]])),
      submissions,
      catalogOf(ENTITY_FIELDS),
      sink,
      events,
      clock,
    )
    const r = await svc.execute({ token: 'tok-1', data: { name: 'Alice', email: 'a@b.com' } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.id).toBe('sub-1')
    expect(sink.inserted).toHaveLength(1)
    expect(submissions.saved).toHaveLength(1)
    expect(submissions.saved[0]?.entityRecordId?.value).toBe('rec-9')
    expect(events.published.some((e) => e.name === 'forms.FormSubmitted')).toBe(true)
  })

  it('fails when the token resolves to no form', async () => {
    const svc = new SubmitFormService(
      new FakeForms(new Map()),
      new FakeSubmissions(),
      catalogOf(ENTITY_FIELDS),
      new FakeSink(ok({ id: 'x' })),
      new FakeEvents(),
      clock,
    )
    const r = await svc.execute({ token: 'nope', data: {} })
    expect(r.ok).toBe(false)
  })

  it('fails validation before inserting when a required field is missing', async () => {
    const sink = new FakeSink(ok({ id: 'x' }))
    const svc = new SubmitFormService(
      new FakeForms(new Map([['tok-1', publicForm()]])),
      new FakeSubmissions(),
      catalogOf(ENTITY_FIELDS),
      sink,
      new FakeEvents(),
      clock,
    )
    const r = await svc.execute({ token: 'tok-1', data: { email: 'a@b.com' } })
    expect(r.ok).toBe(false)
    expect(sink.inserted).toHaveLength(0)
  })

  it('surfaces a record-sink failure', async () => {
    const svc = new SubmitFormService(
      new FakeForms(new Map([['tok-1', publicForm()]])),
      new FakeSubmissions(),
      catalogOf(ENTITY_FIELDS),
      new FakeSink(fail('schema rejected')),
      new FakeEvents(),
      clock,
    )
    const r = await svc.execute({ token: 'tok-1', data: { name: 'Alice' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('schema rejected')
  })

  it('fails when the entity no longer exists', async () => {
    const svc = new SubmitFormService(
      new FakeForms(new Map([['tok-1', publicForm()]])),
      new FakeSubmissions(),
      catalogOf(null),
      new FakeSink(ok({ id: 'x' })),
      new FakeEvents(),
      clock,
    )
    const r = await svc.execute({ token: 'tok-1', data: { name: 'Alice' } })
    expect(r.ok).toBe(false)
  })
})
