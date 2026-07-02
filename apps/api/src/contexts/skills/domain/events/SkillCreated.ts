import { DomainEvent } from '@/shared/kernel/DomainEvent'

export class SkillCreated implements DomainEvent {
  readonly name = 'skills.SkillCreated'
  constructor(
    public readonly aggregateId: string,
    public readonly slug: string,
    public readonly occurredAt: Date,
  ) {}
}
