import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Emitted by the FormSubmission aggregate. `aggregateId` is the submission id;
// `entityRecordId` is the record minted in the `data` context via the
// EntityRecordSink ACL (null only if the sink returned no id).
export class FormSubmitted implements DomainEvent {
  readonly name = 'forms.FormSubmitted'
  constructor(
    public readonly aggregateId: string,
    public readonly formId: string,
    public readonly entityId: string,
    public readonly entityRecordId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
