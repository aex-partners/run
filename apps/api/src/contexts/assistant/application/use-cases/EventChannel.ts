// A minimal single-producer/single-consumer async channel. The chat orchestration
// has TWO event sources that must interleave into one ordered stream: the runtime's
// own events, and the `tool_confirmation_required` events the confirmation gate
// emits before it blocks awaiting the user. A generator alone can't surface an
// event from inside an awaited callback, so both push here and the use case drains
// it. Pure TS, no npm.
export class EventChannel<T> {
  private queue: T[] = []
  private waiters: Array<() => void> = []
  private closed = false

  push(item: T): void {
    if (this.closed) return
    this.queue.push(item)
    this.wake()
  }

  close(): void {
    this.closed = true
    this.wake()
  }

  private wake(): void {
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }

  async *stream(): AsyncGenerator<T> {
    for (;;) {
      while (this.queue.length > 0) {
        yield this.queue.shift() as T
      }
      if (this.closed) return
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
  }
}
