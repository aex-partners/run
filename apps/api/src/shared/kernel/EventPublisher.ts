import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Driven port. Application services drain an aggregate's events after save and
// publish them here. The concrete adapter (WebSocket push, BullMQ fan-out,
// console) lives in platform/main — never imported by domain/application.
export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>
}
