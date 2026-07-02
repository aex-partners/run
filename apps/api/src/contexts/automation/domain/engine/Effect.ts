import { Json } from '@/shared/domain/Json'
import { ActionType } from '@/contexts/automation/domain/FlowDsl'
import { ExecutionPath } from '@/contexts/automation/domain/ExecutionState'

// Effects are DATA describing the next side effect, produced by the pure decider.
// Only `invokePiece` and `runCode` are true IO (driven ports); the rest are pure
// control effects whose interpretation is a no-op echo into the matching event.
// This keeps loop/router/skip semantics in the pure core while preserving the
// decider/interpreter split of the skeleton.
export interface BranchResult {
  branchName: string
  branchIndex: number
  evaluation: boolean
}

export type Effect =
  // --- IO effects ---
  | {
      kind: 'invokePiece'
      name: string
      pieceName: string
      pieceVersion?: string
      actionName: string
      input: Json
      credentialId?: string
      continueOnFailure: boolean
      path: ExecutionPath[]
    }
  | {
      kind: 'runCode'
      name: string
      sourceCode: string
      input: Json
      continueOnFailure: boolean
      path: ExecutionPath[]
    }
  // --- pure control effects ---
  | { kind: 'skip'; name: string; atype: ActionType; path: ExecutionPath[] }
  | { kind: 'enterLoop'; name: string; itemsExpr: string; items: Json[]; hasBody: boolean; path: ExecutionPath[] }
  | { kind: 'iterate'; name: string; index: number; item: Json; total: number; path: ExecutionPath[] }
  | { kind: 'finalizeLoop'; name: string; path: ExecutionPath[] }
  | {
      kind: 'enterRouter'
      name: string
      input: Json
      branchResults: BranchResult[]
      selected: number[]
      path: ExecutionPath[]
    }
  | { kind: 'finish' }
