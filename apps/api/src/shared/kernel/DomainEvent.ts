// Something that happened in the domain, worth telling other parts of the system.
// Aggregates record these; the composition root dispatches them after persistence.
export interface DomainEvent {
  readonly name: string
  readonly occurredAt: Date
  readonly aggregateId: string
}
