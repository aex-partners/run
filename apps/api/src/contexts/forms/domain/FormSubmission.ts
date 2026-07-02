import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { JsonObject } from '@/shared/domain/Json'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { EntityRecordRef } from '@/contexts/forms/domain/EntityRecordRef'
import { FormSubmitted } from '@/contexts/forms/domain/events/FormSubmitted'

// AGGREGATE. An immutable record of one public submission: the raw payload plus a
// link to the entity record it produced (in the `data` context). It holds no
// validation rules of its own — the submission was already validated against the
// form before this aggregate is created.
export class FormSubmission extends AggregateRoot<FormSubmissionId> {
  private constructor(
    id: FormSubmissionId,
    public readonly formId: FormId,
    public readonly entityRecordId: EntityRecordRef | null,
    private _data: JsonObject,
    public readonly submitterIp: string | null,
  ) {
    super(id)
  }

  static create(
    id: FormSubmissionId,
    formId: FormId,
    entityId: EntityRef,
    entityRecordId: EntityRecordRef | null,
    data: JsonObject,
    submitterIp: string | null,
    now: Date,
  ): FormSubmission {
    const submission = new FormSubmission(id, formId, entityRecordId, data, submitterIp)
    submission.addEvent(
      new FormSubmitted(id.value, formId.value, entityId.value, entityRecordId?.value ?? null, now),
    )
    return submission
  }

  static rehydrate(
    id: FormSubmissionId,
    formId: FormId,
    entityRecordId: EntityRecordRef | null,
    data: JsonObject,
    submitterIp: string | null,
  ): FormSubmission {
    return new FormSubmission(id, formId, entityRecordId, data, submitterIp)
  }

  get data(): JsonObject {
    return this._data
  }
}
