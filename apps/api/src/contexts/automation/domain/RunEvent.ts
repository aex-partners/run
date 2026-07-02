import { Json } from '@/shared/domain/Json'

// Facts that happened, recorded to the event store. Folding these through
// FlowDecider.evolve rebuilds RunState exactly — that is how a crashed run
// resumes without re-performing effects.
export type RunEvent =
  | { type: 'started'; input: Json }
  | { type: 'stepSucceeded'; stepId: string; output: Json; next: string | null }
  | { type: 'routed'; from: string; to: string | null }
  | { type: 'finished'; output: Json }
  | { type: 'failed'; stepId: string; reason: string }
