import { Result } from '@/shared/kernel/Result'

// Driving port for the daily digest worker. Takes no command (it sweeps every
// user); the BullMQ worker is just another caller of this in-port.
export interface DigestRunResult {
  sent: number
  skipped: number
}

export interface RunDigest {
  execute(): Promise<Result<DigestRunResult>>
}
