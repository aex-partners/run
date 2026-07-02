import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class SkillUpdated implements DomainEvent {
  readonly name = 'skills.SkillUpdated'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
