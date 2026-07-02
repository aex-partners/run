import { Json, JsonObject } from '@/shared/domain/Json'

// The real AEX flow DSL, ported 1:1 from the ActivePieces-derived linked-list
// model (`flow-engine/types.ts`). A flow is a TRIGGER whose `nextAction` is the
// head of a singly linked list of actions; LOOP bodies and ROUTER branches are
// nested lists. Everything here is pure data: the pure decider walks it, the
// imperative shell never sees these types.

export enum ActionType {
  PIECE = 'PIECE',
  CODE = 'CODE',
  LOOP_ON_ITEMS = 'LOOP_ON_ITEMS',
  ROUTER = 'ROUTER',
}

export enum TriggerType {
  EMPTY = 'EMPTY',
  PIECE = 'PIECE',
  WEBHOOK = 'WEBHOOK',
  SCHEDULE = 'SCHEDULE',
}

// --- Step output (the recorded result of executing one node) ---

export enum StepStatus {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  SKIPPED = 'SKIPPED',
}

export enum ExecutionVerdict {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
}

export interface StepOutput {
  type: ActionType
  status: StepStatus
  input: Json
  output: Json
  duration: number
  errorMessage?: string
  // For LOOP steps: per-iteration nested step outputs (iteration index -> steps).
  iterations?: Record<number, Record<string, StepOutput>>
}

// --- Trigger ---

export interface TriggerSettings {
  pieceName?: string
  pieceVersion?: string
  triggerName?: string
  input?: JsonObject
}

export interface FlowTrigger {
  name: string
  displayName: string
  type: TriggerType
  valid: boolean
  settings: TriggerSettings
  nextAction?: FlowAction
}

// --- Actions (discriminated union over ActionType) ---

export type FlowAction = PieceAction | CodeAction | LoopAction | RouterAction

interface BaseAction {
  name: string
  displayName: string
  valid: boolean
  skip?: boolean
  nextAction?: FlowAction
}

export interface ErrorHandlingOptions {
  continueOnFailure?: { value: boolean }
}

export interface PieceActionSettings {
  pieceName: string
  pieceVersion?: string
  actionName: string
  input: JsonObject
  // Optional explicit credential chosen in the builder. When absent the runner
  // falls back to the plugin's primary/active credential.
  credentialId?: string
  inputUiInfo?: JsonObject
  errorHandlingOptions?: ErrorHandlingOptions
}

export interface PieceAction extends BaseAction {
  type: ActionType.PIECE
  settings: PieceActionSettings
}

export interface CodeActionSettings {
  sourceCode: string
  input: JsonObject
  errorHandlingOptions?: ErrorHandlingOptions
}

export interface CodeAction extends BaseAction {
  type: ActionType.CODE
  settings: CodeActionSettings
}

export interface LoopActionSettings {
  items: string // expression like "{{step_1.output}}"
  input?: JsonObject
}

export interface LoopAction extends BaseAction {
  type: ActionType.LOOP_ON_ITEMS
  settings: LoopActionSettings
  firstLoopAction?: FlowAction
}

export interface RouterConditionGroup {
  operator: string
  firstValue: string
  secondValue?: string
}

export interface RouterBranch {
  branchName: string
  branchType: 'CONDITION' | 'FALLBACK'
  conditions?: RouterConditionGroup[]
}

export interface RouterActionSettings {
  branches: RouterBranch[]
  executionType: 'EXECUTE_FIRST_MATCH' | 'EXECUTE_ALL_MATCH'
  input?: JsonObject
}

export interface RouterAction extends BaseAction {
  type: ActionType.ROUTER
  settings: RouterActionSettings
  children: (FlowAction | undefined)[]
}

// Per-run constants threaded into executors (ported from EngineConstants). The
// engine itself is pure; these are surfaced to adapters that need run identity.
export interface EngineConstants {
  flowId: string
  flowVersionId: string
  flowRunId: string
  projectId: string
  serverUrl: string
}
