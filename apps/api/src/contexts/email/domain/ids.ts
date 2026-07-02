import { Identifier } from '@/shared/kernel/Identifier'

export class EmailId extends Identifier {
  static of(value: string): EmailId {
    return new EmailId(value)
  }
}

export class EmailAccountId extends Identifier {
  static of(value: string): EmailAccountId {
    return new EmailAccountId(value)
  }
}

export class EmailLabelId extends Identifier {
  static of(value: string): EmailLabelId {
    return new EmailLabelId(value)
  }
}

// Composite identity for a membership row (the table keys on accountId+userId,
// it has no surrogate id). Encoded "accountId:userId" so a member is still an
// aggregate with a stable, comparable id and an aggregateId for its events.
export class MailMemberId extends Identifier {
  static of(accountId: string, userId: string): MailMemberId {
    return new MailMemberId(`${accountId}:${userId}`)
  }
}
