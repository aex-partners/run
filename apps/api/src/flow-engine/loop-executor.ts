/**
 * Executor for LOOP_ON_ITEMS action type.
 * Iterates over an array and recursively executes a sub-flow for each item.
 */

import type { LoopAction, StepOutput, EngineConstants } from "./types.js";
import { StepStatus, ActionType, ExecutionVerdict } from "./types.js";
import { FlowExecutionContext } from "./execution-context.js";
import { resolveVariables } from "./variable-service.js";
import type { Database } from "../db/index.js";

export async function executeLoopAction(
  action: LoopAction,
  context: FlowExecutionContext,
  constants: EngineConstants,
  db: Database,
  executeAction: (action: import("./types.js").FlowAction, ctx: FlowExecutionContext, constants: EngineConstants, db: Database) => Promise<FlowExecutionContext>,
): Promise<FlowExecutionContext> {
  const startTime = Date.now();

  const state = context.currentState();
  const resolvedItems = resolveVariables(action.settings.items, state);

  // Ensure items is an array
  const items = Array.isArray(resolvedItems) ? resolvedItems : [];

  // Initialize loop step output
  const loopOutput: StepOutput = {
    type: ActionType.LOOP_ON_ITEMS,
    status: StepStatus.RUNNING,
    input: { items: action.settings.items },
    output: { iterations: items.length },
    duration: 0,
    iterations: {},
  };

  let ctx = context.upsertStep(action.name, loopOutput);

  if (!action.firstLoopAction) {
    // Empty loop body
    const duration = Date.now() - startTime;
    const finalOutput: StepOutput = { ...loopOutput, status: StepStatus.SUCCEEDED, duration };
    return ctx.upsertStep(action.name, finalOutput).addDuration(duration);
  }

  // Execute for each item
  for (let i = 0; i < items.length; i++) {
    // Set loop path so nested steps are scoped
    ctx = ctx.setCurrentPath([...ctx.currentPath, { stepName: action.name, iteration: i }]);

    // Add current item to loop step iterations
    const loopStep = ctx.steps[action.name];
    if (loopStep) {
      const iterations = { ...(loopStep.iterations ?? {}) };
      iterations[i] = {};
      ctx = ctx.upsertStep(action.name, {
        ...loopStep,
        iterations,
        output: { iterations: items.length, index: i, item: items[i] },
      });
    }

    // Execute the loop body (linked list starting from firstLoopAction)
    let currentAction: import("./types.js").FlowAction | undefined = action.firstLoopAction;
    while (currentAction && ctx.verdict === ExecutionVerdict.RUNNING) {
      ctx = await executeAction(currentAction, ctx, constants, db);
      currentAction = currentAction.nextAction;
    }

    // Remove loop path
    ctx = ctx.setCurrentPath(ctx.currentPath.slice(0, -1));

    // Stop if flow failed
    if (ctx.verdict !== ExecutionVerdict.RUNNING) break;
  }

  // Finalize loop step
  const duration = Date.now() - startTime;
  const finalStatus = ctx.verdict === ExecutionVerdict.RUNNING ? StepStatus.SUCCEEDED : StepStatus.FAILED;
  const currentLoop = ctx.steps[action.name];
  if (currentLoop) {
    ctx = ctx.upsertStep(action.name, {
      ...currentLoop,
      status: finalStatus,
      duration,
    });
  }

  return ctx.addDuration(duration);
}
