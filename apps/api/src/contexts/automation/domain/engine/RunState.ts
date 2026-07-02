import { Json } from '@/shared/domain/Json'
import { FlowAction } from '@/contexts/automation/domain/FlowDsl'
import { StepStore, ExecutionPath } from '@/contexts/automation/domain/ExecutionState'

// The folded state of an engine run. The AEX executor is a recursive depth-first
// tree walk; to keep the decider PURE and total (so a run can resume by replaying
// events) we flatten that recursion into an explicit continuation `stack`. The top
// of the stack (index 0) is the next thing to do.
//
// Frames:
//   action       -> execute one DSL node (piece/code/loop/router/skip)
//   loopIterate  -> begin loop iteration i (sets "{{loop.item}}" before the body)
//   finalizeLoop -> mark a loop step SUCCEEDED after its last iteration
export type Frame =
  | { kind: 'action'; action: FlowAction; path: ExecutionPath[] }
  | { kind: 'loopIterate'; name: string; index: number; item: Json; total: number; path: ExecutionPath[] }
  | { kind: 'finalizeLoop'; name: string; path: ExecutionPath[] }

export interface RunState {
  status: 'running' | 'succeeded' | 'failed'
  steps: StepStore
  stack: Frame[]
  error: string | null
  duration: number
}
