import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { MailMemberId } from '@/contexts/email/domain/ids'
import { MailMemberAdded } from '@/contexts/email/domain/events/MailMemberAdded'
import { MailMemberRemoved } from '@/contexts/email/domain/events/MailMemberRemoved'

export interface MailAccountMemberSnapshot {
  canSend: boolean
  addedAt: Date
}

// AGGREGATE. A user's membership of a (shared) mail account, carrying the single
// permission that matters here: whether they may send from it. The owner is
// always a member with canSend; extra members are granted explicitly.
export class MailAccountMember extends AggregateRoot<MailMemberId> {
  private constructor(
    id: MailMemberId,
    public readonly accountId: string,
    public readonly userId: string,
    private _canSend: boolean,
    private readonly _addedAt: Date,
  ) {
    super(id)
  }

  static create(accountId: string, userId: string, canSend: boolean, now: Date): MailAccountMember {
    const member = new MailAccountMember(MailMemberId.of(accountId, userId), accountId, userId, canSend, now)
    member.addEvent(new MailMemberAdded(member.id.value, accountId, userId, canSend, now))
    return member
  }

  static rehydrate(accountId: string, userId: string, s: MailAccountMemberSnapshot): MailAccountMember {
    return new MailAccountMember(MailMemberId.of(accountId, userId), accountId, userId, s.canSend, s.addedAt)
  }

  setCanSend(canSend: boolean): void {
    this._canSend = canSend
  }

  // Stamps the removal event; the repository deletes the row.
  markRemoved(now: Date): void {
    this.addEvent(new MailMemberRemoved(this.id.value, this.accountId, this.userId, now))
  }

  get canSend(): boolean {
    return this._canSend
  }
  get addedAt(): Date {
    return this._addedAt
  }
}
