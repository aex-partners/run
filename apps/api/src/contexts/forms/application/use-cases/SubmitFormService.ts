import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SubmitForm, SubmitFormCommand } from '@/contexts/forms/application/ports/in/SubmitForm'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { FormSubmissionRepository } from '@/contexts/forms/application/ports/out/FormSubmissionRepository'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { EntityRecordSink } from '@/contexts/forms/application/ports/out/EntityRecordSink'
import { SubmissionValidator } from '@/contexts/forms/domain/SubmissionValidator'
import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { EntityRecordRef } from '@/contexts/forms/domain/EntityRecordRef'

// Public submission flow: resolve the form by token, validate the payload against
// the form's visible fields (with their required overrides) and the entity's
// field types, then create the entity record across the ACL and persist the
// submission. The data context is reached only through the EntityCatalog (read)
// and EntityRecordSink (write) ports.
export class SubmitFormService implements SubmitForm {
  constructor(
    private readonly forms: FormRepository,
    private readonly submissions: FormSubmissionRepository,
    private readonly catalog: EntityCatalog,
    private readonly sink: EntityRecordSink,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SubmitFormCommand): Promise<Result<{ id: string }>> {
    const form = await this.forms.findByToken(cmd.token)
    if (!form || !form.isPublic) return fail('Form not found or not public')

    const entityFields = await this.catalog.fieldsOf(form.entityId.value)
    if (!entityFields) return fail('Entity not found')

    const validationFields = form.buildSubmissionFields(entityFields)
    if (!validationFields.ok) return fail(validationFields.error)

    const validated = SubmissionValidator.validate(cmd.data, validationFields.value)
    if (!validated.ok) return fail(validated.error)

    const inserted = await this.sink.insert(form.entityId.value, cmd.data)
    if (!inserted.ok) return fail(inserted.error)

    const submission = FormSubmission.create(
      this.submissions.nextId(),
      form.id,
      form.entityId,
      EntityRecordRef.of(inserted.value.id),
      cmd.data,
      cmd.submitterIp ?? null,
      this.clock.now(),
    )

    await this.submissions.save(submission)
    await this.events.publish(submission.pullEvents())
    return ok({ id: submission.id.value })
  }
}
