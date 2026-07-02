import { randomUUID } from 'node:crypto'
import { Database } from '@/platform/db/client'
import { formSubmissions } from '@/platform/db/schema'
import { FormSubmissionRepository } from '@/contexts/forms/application/ports/out/FormSubmissionRepository'
import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'
import { FormSubmissionMapper } from '@/contexts/forms/application/mappers/FormSubmissionMapper'

export class DrizzleFormSubmissionRepository implements FormSubmissionRepository {
  constructor(private readonly db: Database) {}

  nextId(): FormSubmissionId {
    return FormSubmissionId.of(randomUUID())
  }

  async save(submission: FormSubmission): Promise<void> {
    const row = FormSubmissionMapper.toPersistence(submission)
    await this.db.insert(formSubmissions).values({
      id: row.id,
      formId: row.formId,
      entityRecordId: row.entityRecordId,
      data: JSON.stringify(row.data),
      submitterIp: row.submitterIp,
    })
  }
}
