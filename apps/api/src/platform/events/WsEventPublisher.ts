import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { EventPublisher } from '@/shared/kernel/EventPublisher'

// Minimal structural view of a live socket. Lets this adapter stay decoupled
// from the concrete `ws`/@fastify/websocket types — any object with these
// members (a real WebSocket) satisfies it.
export interface SocketLike {
  send(data: string): void
  readyState: number
  on(event: 'close', listener: () => void): void
}

const WS_OPEN = 1

// Driven adapter for the EventPublisher port. Replaces ConsoleEventPublisher in
// the real container: it fans every drained domain event out to all connected
// WebSocket clients (registered by the Fastify ws route). Persistence stays the
// source of truth; this is best-effort push so a slow/closed socket never blocks
// a command.
export class WsEventPublisher implements EventPublisher {
  private readonly sockets = new Set<SocketLike>()

  // Called by the Fastify ws route for every accepted connection.
  register(socket: SocketLike): void {
    this.sockets.add(socket)
    socket.on('close', () => this.sockets.delete(socket))
  }

  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0 || this.sockets.size === 0) return
    for (const event of events) {
      const frame = JSON.stringify({
        type: 'domain-event',
        name: event.name,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt.toISOString(),
      })
      for (const socket of this.sockets) {
        if (socket.readyState !== WS_OPEN) continue
        try {
          socket.send(frame)
        } catch {
          // best-effort: drop a socket that errors on send
          this.sockets.delete(socket)
        }
      }
    }
  }
}
