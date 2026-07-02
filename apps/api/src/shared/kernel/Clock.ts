// Driven port for time. Injected so domain/application stay deterministic and
// testable: a fake clock makes use cases reproducible, and event-sourced replay
// reads the recorded timestamp instead of calling the wall clock again.
export interface Clock {
  now(): Date
}
