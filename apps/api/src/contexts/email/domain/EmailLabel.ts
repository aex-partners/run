import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { EmailLabelId } from '@/contexts/email/domain/ids'
import { DEFAULT_LABEL_COLOR } from '@/contexts/email/domain/Label'
import { EmailLabelCreated } from '@/contexts/email/domain/events/EmailLabelCreated'
import { EmailLabelDeleted } from '@/contexts/email/domain/events/EmailLabelDeleted'

export interface EmailLabelSnapshot {
  accountId: string
  name: string
  color: string
  createdAt: Date
}

// AGGREGATE. A named, coloured label definition belonging to one mail account.
// Distinct from the inline label tags stored on an Email: this is the catalogue
// the user manages; emails reference these by name and copy the colour.
export class EmailLabel extends AggregateRoot<EmailLabelId> {
  private constructor(
    id: EmailLabelId,
    public readonly accountId: string,
    private _name: string,
    private _color: string,
    private readonly _createdAt: Date,
  ) {
    super(id)
  }

  static create(
    id: EmailLabelId,
    accountId: string,
    name: string,
    color: string,
    now: Date,
  ): Result<EmailLabel> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('EmailLabel: name is required')
    const label = new EmailLabel(id, accountId, trimmed, color || DEFAULT_LABEL_COLOR, now)
    label.addEvent(new EmailLabelCreated(id.value, accountId, trimmed, now))
    return ok(label)
  }

  static rehydrate(id: EmailLabelId, s: EmailLabelSnapshot): EmailLabel {
    return new EmailLabel(id, s.accountId, s.name, s.color, s.createdAt)
  }

  // Stamps the deletion event; the repository removes the row.
  markDeleted(now: Date): void {
    this.addEvent(new EmailLabelDeleted(this.id.value, now))
  }

  get name(): string {
    return this._name
  }
  get color(): string {
    return this._color
  }
  get createdAt(): Date {
    return this._createdAt
  }
}
