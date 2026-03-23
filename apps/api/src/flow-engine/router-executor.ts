/**
 * Executor for ROUTER action type.
 * Evaluates conditions on branches, executes matching branches.
 * Supports EXECUTE_FIRST_MATCH and EXECUTE_ALL_MATCH modes.
 */

import type { RouterAction, FlowAction, StepOutput, EngineConstants, RouterConditionGroup } from "./types.js";
import { StepStatus, ActionType, ExecutionVerdict } from "./types.js";
import { FlowExecutionContext } from "./execution-context.js";
import { resolveVariables } from "./variable-service.js";
import type { Database } from "../db/index.js";

export async function executeRouterAction(
  action: RouterAction,
  context: FlowExecutionContext,
  constants: EngineConstants,
  db: Database,
  executeAction: (action: FlowAction, ctx: FlowExecutionContext, constants: EngineConstants, db: Database) => Promise<FlowExecutionContext>,
): Promise<FlowExecutionContext> {
  const startTime = Date.now();
  const state = context.currentState();
  const { branches, executionType } = action.settings;

  const branchResults: Array<{ branchName: string; branchIndex: number; evaluation: boolean }> = [];
  let ctx = context;
  let anyMatched = false;

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    let evaluation = false;

    if (branch.branchType === "FALLBACK") {
      evaluation = !anyMatched;
    } else if (branch.conditions) {
      evaluation = evaluateConditions(branch.conditions, state);
    }

    branchResults.push({ branchName: branch.branchName, branchIndex: i, evaluation });

    if (evaluation) {
      anyMatched = true;

      // Execute branch (children[i] is the first action of this branch)
      const branchAction = action.children[i];
      if (branchAction) {
        let currentAction: FlowAction | undefined = branchAction;
        while (currentAction && ctx.verdict === ExecutionVerdict.RUNNING) {
          ctx = await executeAction(currentAction, ctx, constants, db);
          currentAction = currentAction.nextAction;
        }
      }

      // Stop after first match if EXECUTE_FIRST_MATCH
      if (executionType === "EXECUTE_FIRST_MATCH") break;
    }
  }

  const duration = Date.now() - startTime;
  const stepOutput: StepOutput = {
    type: ActionType.ROUTER,
    status: ctx.verdict === ExecutionVerdict.RUNNING ? StepStatus.SUCCEEDED : StepStatus.FAILED,
    input: { branches: branches.map((b) => b.branchName) },
    output: { branches: branchResults },
    duration,
  };

  return ctx.upsertStep(action.name, stepOutput).addDuration(duration);
}

/**
 * Evaluate a set of condition groups (OR between groups).
 * Each group contains conditions that are ANDed together.
 */
function evaluateConditions(
  groups: RouterConditionGroup[],
  state: Record<string, unknown>,
): boolean {
  // Each condition is evaluated independently (OR logic between conditions)
  // For AND, the AP model uses nested arrays. Our simplified model uses OR.
  for (const condition of groups) {
    if (evaluateSingleCondition(condition, state)) {
      return true;
    }
  }
  return groups.length === 0;
}

/**
 * Evaluate a single condition.
 */
function evaluateSingleCondition(
  condition: RouterConditionGroup,
  state: Record<string, unknown>,
): boolean {
  const first = resolveVariables(condition.firstValue, state);
  const second = condition.secondValue !== undefined
    ? resolveVariables(condition.secondValue, state)
    : undefined;

  const op = condition.operator;

  switch (op) {
    // Text operators
    case "TEXT_CONTAINS":
      return String(first).toLowerCase().includes(String(second).toLowerCase());
    case "TEXT_DOES_NOT_CONTAIN":
      return !String(first).toLowerCase().includes(String(second).toLowerCase());
    case "TEXT_EXACTLY_MATCHES":
      return String(first) === String(second);
    case "TEXT_DOES_NOT_EXACTLY_MATCH":
      return String(first) !== String(second);
    case "TEXT_STARTS_WITH":
      return String(first).startsWith(String(second));
    case "TEXT_ENDS_WITH":
      return String(first).endsWith(String(second));
    case "TEXT_IS_EMPTY":
      return !first || String(first).length === 0;
    case "TEXT_IS_NOT_EMPTY":
      return !!first && String(first).length > 0;

    // Number operators
    case "NUMBER_IS_GREATER_THAN":
      return Number(first) > Number(second);
    case "NUMBER_IS_LESS_THAN":
      return Number(first) < Number(second);
    case "NUMBER_IS_EQUAL_TO":
      return Number(first) === Number(second);
    case "NUMBER_IS_GREATER_THAN_OR_EQUAL":
      return Number(first) >= Number(second);
    case "NUMBER_IS_LESS_THAN_OR_EQUAL":
      return Number(first) <= Number(second);

    // Boolean operators
    case "BOOLEAN_IS_TRUE":
      return first === true || first === "true";
    case "BOOLEAN_IS_FALSE":
      return first === false || first === "false";

    // Existence operators
    case "EXISTS":
      return first !== null && first !== undefined;
    case "DOES_NOT_EXIST":
      return first === null || first === undefined;

    // List operators
    case "LIST_CONTAINS":
      return Array.isArray(first) && first.includes(second);
    case "LIST_DOES_NOT_CONTAIN":
      return !Array.isArray(first) || !first.includes(second);
    case "LIST_IS_EMPTY":
      return !Array.isArray(first) || first.length === 0;
    case "LIST_IS_NOT_EMPTY":
      return Array.isArray(first) && first.length > 0;

    default:
      console.warn(`Unknown condition operator: ${op}`);
      return false;
  }
}
