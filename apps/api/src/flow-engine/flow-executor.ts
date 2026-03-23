/**
 * Main flow executor.
 * Walks the linked list of actions and dispatches to type-specific executors.
 */

import type { FlowAction, FlowTrigger, EngineConstants, StepOutput } from "./types.js";
import { ActionType, StepStatus, ExecutionVerdict } from "./types.js";
import { FlowExecutionContext } from "./execution-context.js";
import { executePieceAction } from "./piece-executor.js";
import { executeCodeAction } from "./code-executor.js";
import { executeLoopAction } from "./loop-executor.js";
import { executeRouterAction } from "./router-executor.js";
import type { Database } from "../db/index.js";

/**
 * Execute a flow from its trigger definition.
 */
export async function executeFlow(
  trigger: FlowTrigger,
  constants: EngineConstants,
  db: Database,
  onStepComplete?: (stepName: string, output: StepOutput) => void,
): Promise<FlowExecutionContext> {
  let context = new FlowExecutionContext();

  // Record trigger step
  const triggerOutput: StepOutput = {
    type: ActionType.PIECE,
    status: StepStatus.SUCCEEDED,
    input: trigger.settings,
    output: trigger.settings.input ?? {},
    duration: 0,
  };
  context = context.upsertStep(trigger.name, triggerOutput);
  onStepComplete?.(trigger.name, triggerOutput);

  // Walk the linked list of actions
  let currentAction: FlowAction | undefined = trigger.nextAction;

  while (currentAction && context.verdict === ExecutionVerdict.RUNNING) {
    context = await executeAction(currentAction, context, constants, db);

    // Notify progress
    const stepOutput = context.steps[currentAction.name];
    if (stepOutput) {
      onStepComplete?.(currentAction.name, stepOutput);
    }

    currentAction = currentAction.nextAction;
  }

  // Set final verdict
  if (context.verdict === ExecutionVerdict.RUNNING) {
    context = context.setVerdict(ExecutionVerdict.SUCCEEDED);
  }

  return context;
}

/**
 * Execute a single action, dispatching to the appropriate executor.
 */
export async function executeAction(
  action: FlowAction,
  context: FlowExecutionContext,
  constants: EngineConstants,
  db: Database,
): Promise<FlowExecutionContext> {
  // Skip if action is marked as skip
  if (action.skip) {
    const skipOutput: StepOutput = {
      type: action.type,
      status: StepStatus.SKIPPED,
      input: null,
      output: null,
      duration: 0,
    };
    return context.upsertStep(action.name, skipOutput);
  }

  switch (action.type) {
    case ActionType.PIECE:
      return executePieceAction(action, context, constants, db);

    case ActionType.CODE:
      return executeCodeAction(action, context, constants);

    case ActionType.LOOP_ON_ITEMS:
      return executeLoopAction(action, context, constants, db, executeAction);

    case ActionType.ROUTER:
      return executeRouterAction(action, context, constants, db, executeAction);

    default:
      console.warn(`Unknown action type: ${(action as FlowAction).type}`);
      return context;
  }
}
