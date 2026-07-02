import { FormSubmission } from '@/contexts/forms/domain/FormSubmission'
import { FormSubmissionId } from '@/contexts/forms/domain/FormSubmissionId'

export interface FormSubmissionRepository {
  nextId(): FormSubmissionId
  save(submission: FormSubmission): Promise<void>
}
