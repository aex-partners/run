/**
 * Flow engine type definitions.
 * Adapted from ActivePieces linked-list flow model.
 */

// --- Action Types ---

export enum ActionType {
  PIECE = "PIECE",
  CODE = "CODE",
  LOOP_ON_ITEMS = "LOOP_ON_ITEMS",
  ROUTER = "ROUTER",
}

export enum TriggerType {
  EMPTY = "EMPTY",
  PIECE = "PIECE",
  WEBHOOK = "WEBHOOK",
  SCHEDULE = "SCHEDULE",
}

// --- Step Output ---

export enum StepStatus {
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
  SKIPPED = "SKIPPED",
}

export enum ExecutionVerdict {
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
}

export interface StepOutput {
  type: ActionType;
  status: StepStatus;
  input: unknown;
  output: unknown;
  duration: number;
  errorMessage?: string;
  /** For loops: results per iteration */
  iterations?: Record<number, Record<string, StepOutput>>;
}

// --- Flow Definition (linked list) ---

export interface FlowTrigger {
  name: string;
  displayName: string;
  type: TriggerType;
  valid: boolean;
  settings: TriggerSettings;
  nextAction?: FlowAction;
}

export interface TriggerSettings {
  pieceName?: string;
  pieceVersion?: string;
  triggerName?: string;
  input?: Record<string, unknown>;
}

export type FlowAction = PieceAction | CodeAction | LoopAction | RouterAction;

interface BaseAction {
  name: string;
  displayName: string;
  type: ActionType;
  valid: boolean;
  skip?: boolean;
  nextAction?: FlowAction;
  settings: unknown;
}

export interface PieceAction extends BaseAction {
  type: ActionType.PIECE;
  settings: PieceActionSettings;
}

export interface PieceActionSettings {
  pieceName: string;
  pieceVersion?: string;
  actionName: string;
  input: Record<string, unknown>;
  inputUiInfo?: Record<string, unknown>;
  errorHandlingOptions?: ErrorHandlingOptions;
}

export interface CodeAction extends BaseAction {
  type: ActionType.CODE;
  settings: CodeActionSettings;
}

export interface CodeActionSettings {
  sourceCode: string;
  input: Record<string, unknown>;
  errorHandlingOptions?: ErrorHandlingOptions;
}

export interface LoopAction extends BaseAction {
  type: ActionType.LOOP_ON_ITEMS;
  settings: LoopActionSettings;
  firstLoopAction?: FlowAction;
}

export interface LoopActionSettings {
  items: string; // Expression like "{{step_1.output}}"
  input?: Record<string, unknown>;
}

export interface RouterAction extends BaseAction {
  type: ActionType.ROUTER;
  settings: RouterActionSettings;
  children: (FlowAction | undefined)[];
}

export interface RouterActionSettings {
  branches: RouterBranch[];
  executionType: "EXECUTE_FIRST_MATCH" | "EXECUTE_ALL_MATCH";
  input?: Record<string, unknown>;
}

export interface RouterBranch {
  branchName: string;
  branchType: "CONDITION" | "FALLBACK";
  conditions?: RouterConditionGroup[];
}

export interface RouterConditionGroup {
  operator: string;
  firstValue: string;
  secondValue?: string;
}

export interface ErrorHandlingOptions {
  retryOnFailure?: { value: boolean; count?: number };
  continueOnFailure?: { value: boolean };
}

// --- Engine Constants ---

export interface EngineConstants {
  flowId: string;
  flowVersionId: string;
  flowRunId: string;
  projectId: string;
  serverUrl: string;
}
