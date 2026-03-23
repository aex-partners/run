/**
 * Executor for PIECE action type.
 * Loads piece, resolves inputs, creates context, runs action.
 */

import type { PieceAction, StepOutput, EngineConstants } from "./types.js";
import { StepStatus, ActionType } from "./types.js";
import { FlowExecutionContext } from "./execution-context.js";
import { resolveVariables } from "./variable-service.js";
import type { Database } from "../db/index.js";

export async function executePieceAction(
  action: PieceAction,
  context: FlowExecutionContext,
  constants: EngineConstants,
  db: Database,
): Promise<FlowExecutionContext> {
  const startTime = Date.now();

  // Resolve input variables
  const state = context.currentState();
  const resolvedInput = resolveVariables(action.settings.input, state) as Record<string, unknown>;

  try {
    // Load piece
    const { loadPiece } = await import("../plugins/piece-loader.js");
    const piece = await loadPiece(action.settings.pieceName);

    if (!piece) {
      throw new Error(`Piece "${action.settings.pieceName}" not found or not installed`);
    }

    const actions = piece.actions();
    const pieceAction = actions[action.settings.actionName];
    if (!pieceAction) {
      throw new Error(`Action "${action.settings.actionName}" not found in piece "${action.settings.pieceName}"`);
    }

    // Get credential for piece
    const { getCredentialForPlugin } = await import("../credentials/credential-service.js");
    const credValue = await getCredentialForPlugin(db, action.settings.pieceName);

    // Build execution context
    const { createActionContext } = await import("../plugins/context-factory.js");
    const actionContext = createActionContext({
      db,
      pluginName: action.settings.pieceName,
      auth: credValue,
      propsValue: resolvedInput,
      serverUrl: constants.serverUrl,
    });

    // Execute
    const result = await (pieceAction as { run: (ctx: unknown) => Promise<unknown> }).run({
      ...actionContext,
      executionType: "BEGIN",
    });

    const duration = Date.now() - startTime;
    const stepOutput: StepOutput = {
      type: ActionType.PIECE,
      status: StepStatus.SUCCEEDED,
      input: resolvedInput,
      output: result,
      duration,
    };

    return context.upsertStep(action.name, stepOutput).addDuration(duration);
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Piece execution failed";

    // Check if continueOnFailure is enabled
    if (action.settings.errorHandlingOptions?.continueOnFailure?.value) {
      const stepOutput: StepOutput = {
        type: ActionType.PIECE,
        status: StepStatus.FAILED,
        input: resolvedInput,
        output: { error: errorMessage },
        duration,
        errorMessage,
      };
      return context.upsertStep(action.name, stepOutput).addDuration(duration);
    }

    const stepOutput: StepOutput = {
      type: ActionType.PIECE,
      status: StepStatus.FAILED,
      input: resolvedInput,
      output: null,
      duration,
      errorMessage,
    };
    return context
      .upsertStep(action.name, stepOutput)
      .addDuration(duration)
      .setVerdict("FAILED" as any, errorMessage);
  }
}
