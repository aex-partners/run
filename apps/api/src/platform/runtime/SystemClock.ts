import { Clock } from '@/shared/kernel/Clock'

// Driven adapter for the Clock port.
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
