import { Json, JsonObject } from '@/shared/domain/Json'

// The folded state of a run. `vars` accumulates each step's output keyed by step
// id (plus `trigger` for the initial input), so later steps can reference
// "{{stepId.field}}".
export interface RunState {
  status: 'running' | 'completed' | 'failed'
  cursor: string | null
  vars: JsonObject
  output: Json
  error: string | null
}
