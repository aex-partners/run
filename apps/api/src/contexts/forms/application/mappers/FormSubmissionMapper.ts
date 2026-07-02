import { JsonObject } from '@/shared/domain/Json'
import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRecordRef } from '@/contexts/forms/domain/EntityRecordRef'

// Mirrors the AEX `form_submissions` table. `data` is the deserialized payload;
// the Drizzle adapter handles the JSON text round-trip.
export interface FormSubmissionRow {
  id: string
  formId: string
  entityRecordId: string | null
  data: JsonObject
  submitterIp: string | null
}

export const FormSubmissionMapper = {
  toPersistence(submission: FormSubmission): FormSubmissionRow {
    return {
      id: submission.id.value,
      formId: submission.formId.value,
      entityRecordId: submission.entityRecordId?.value ?? null,
      data: submission.data,
      submitterIp: submission.submitterIp,
    }
  },

  toDomain(row: FormSubmissionRow): FormSubmission {
    return FormSubmission.rehydrate(
      FormSubmissionId.of(row.id),
      FormId.of(row.formId),
      row.entityRecordId ? EntityRecordRef.of(row.entityRecordId) : null,
      row.data,
      row.submitterIp,
    )
  },
}
