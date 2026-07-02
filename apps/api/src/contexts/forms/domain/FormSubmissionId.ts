import { Identifier } from '@/shared/kernel/Identifier'

export class FormSubmissionId extends Identifier {
  static of(value: string): FormSubmissionId {
    return new FormSubmissionId(value)
  }
}
