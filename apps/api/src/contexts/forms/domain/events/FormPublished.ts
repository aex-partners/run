import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Emitted when a form's public visibility is toggled. Carries the resulting
// state and the public token (minted on first publish).
export class FormPublished implements DomainEvent {
  readonly name = 'forms.FormPublished'
  constructor(
    public readonly aggregateId: string,
    public readonly isPublic: boolean,
    public readonly publicToken: string | null,
    public readonly occurredAt: Date,
  ) {}
}
