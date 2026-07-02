import { Json } from '@/shared/domain/Json'
import { ActionType } from '@/contexts/automation/domain/FlowDsl'
import { ExecutionPath } from '@/contexts/automation/domain/ExecutionState'
import { BranchResult } from '@/contexts/automation/domain/engine/Effect'

// Facts recorded to the event store. Folding these through FlowDecider.evolve
// rebuilds RunState exactly, so a run resumes by replay (no effect re-performed).
// Events carry only names + computed data; the decider re-derives action nodes
// from its `byName` index, keeping the log lean and serializable.
export type RunEvent =
  | { type: 'started'; triggerName: string; triggerOutput: Json }
  | {
      type: 'stepSucceeded'
      name: string
      atype: ActionType
      input: Json
      output: Json
      duration: number
      path: ExecutionPath[]
    }
  | {
      type: 'stepFailed'
      name: string
      atype: ActionType
      input: Json
      output: Json
      duration: number
      errorMessage: string
      continued: boolean
      path: ExecutionPath[]
    }
  | { type: 'stepSkipped'; name: string; atype: ActionType; path: ExecutionPath[] }
  | { type: 'loopEntered'; name: string; itemsExpr: string; items: Json[]; hasBody: boolean; path: ExecutionPath[] }
  | { type: 'loopIterationStarted'; name: string; index: number; item: Json; total: number; path: ExecutionPath[] }
  | { type: 'loopFinalized'; name: string; path: ExecutionPath[] }
  | {
      type: 'routerEntered'
      name: string
      input: Json
      branchResults: BranchResult[]
      selected: number[]
      path: ExecutionPath[]
    }
  | { type: 'finished' }
