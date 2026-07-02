import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'

// Driven adapter for the EventPublisher port. In the real app this fans out to
// WebSocket clients and BullMQ. Here it logs — enough to prove events flow out
// of aggregates after persistence.
export class ConsoleEventPublisher implements EventPublisher {
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      console.log(`  event ${e.name} (aggregate=${e.aggregateId})`)
    }
  }
}
