import { Identifier } from '@/shared/kernel/Identifier'

// Entities have identity: equality is by id, not by attribute values.
export abstract class Entity<Id extends Identifier> {
  protected constructor(public readonly id: Id) {}

  equals(other?: Entity<Id>): boolean {
    return !!other && this.id.equals(other.id)
  }
}
