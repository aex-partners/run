import { Entity } from '@/shared/kernel/Entity'
import { Identifier } from '@/shared/kernel/Identifier'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The only object an outside caller loads and saves as a unit. It guards its
// invariants and records domain events to be dispatched after persistence.
export abstract class AggregateRoot<Id extends Identifier> extends Entity<Id> {
  private _events: DomainEvent[] = []

  protected addEvent(event: DomainEvent): void {
    this._events.push(event)
  }

  // Drains recorded events. The repository / composition root calls this after
  // save() and hands them to an event publisher.
  pullEvents(): DomainEvent[] {
    const drained = this._events
    this._events = []
    return drained
  }
}
