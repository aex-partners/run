/**
 * Executor for CODE action type.
 * Runs user-provided JavaScript code in a sandboxed context.
 */

import type { CodeAction, StepOutput, EngineConstants } from "./types.js";
import { StepStatus, ActionType } from "./types.js";
import { FlowExecutionContext } from "./execution-context.js";
import { resolveVariables } from "./variable-service.js";
import vm from "node:vm";

export async function executeCodeAction(
  action: CodeAction,
  context: FlowExecutionContext,
  _constants: EngineConstants,
): Promise<FlowExecutionContext> {
  const startTime = Date.now();

  const state = context.currentState();
  const resolvedInput = resolveVariables(action.settings.input, state) as Record<string, unknown>;

  try {
    const code = action.settings.sourceCode;

    // Run in VM sandbox with timeout
    const sandbox = {
      inputs: resolvedInput,
      console: { log: () => {}, error: () => {}, warn: () => {} },
      fetch: globalThis.fetch,
      setTimeout: globalThis.setTimeout,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      __result: undefined as unknown,
    };

    const wrappedCode = `
      (async () => {
        const exports = {};
        ${code}
        if (typeof exports.code === 'function') {
          __result = await exports.code({ inputs });
        } else if (typeof exports.default === 'function') {
          __result = await exports.default({ inputs });
        } else {
          __result = exports;
        }
      })()
    `;

    const vmContext = vm.createContext(sandbox);
    await vm.runInContext(wrappedCode, vmContext, { timeout: 30_000 });

    const duration = Date.now() - startTime;
    const stepOutput: StepOutput = {
      type: ActionType.CODE,
      status: StepStatus.SUCCEEDED,
      input: resolvedInput,
      output: sandbox.__result,
      duration,
    };

    return context.upsertStep(action.name, stepOutput).addDuration(duration);
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Code execution failed";

    if (action.settings.errorHandlingOptions?.continueOnFailure?.value) {
      const stepOutput: StepOutput = {
        type: ActionType.CODE,
        status: StepStatus.FAILED,
        input: resolvedInput,
        output: { error: errorMessage },
        duration,
        errorMessage,
      };
      return context.upsertStep(action.name, stepOutput).addDuration(duration);
    }

    const stepOutput: StepOutput = {
      type: ActionType.CODE,
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
