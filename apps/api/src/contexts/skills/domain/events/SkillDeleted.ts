import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class SkillDeleted implements DomainEvent {
  readonly name = 'skills.SkillDeleted'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
