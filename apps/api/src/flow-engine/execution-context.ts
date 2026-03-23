/**
 * Immutable execution context that flows through the engine.
 * Each step returns a new context with updated state.
 */

import type { StepOutput, ExecutionVerdict } from "./types.js";

export interface ExecutionPath {
  stepName: string;
  iteration: number;
}

export class FlowExecutionContext {
  readonly steps: Record<string, StepOutput>;
  readonly verdict: ExecutionVerdict;
  readonly currentPath: ExecutionPath[];
  readonly tags: string[];
  readonly duration: number;
  readonly error?: string;

  constructor(opts?: Partial<FlowExecutionContext>) {
    this.steps = opts?.steps ?? {};
    this.verdict = opts?.verdict ?? "RUNNING" as ExecutionVerdict;
    this.currentPath = opts?.currentPath ?? [];
    this.tags = opts?.tags ?? [];
    this.duration = opts?.duration ?? 0;
    this.error = opts?.error;
  }

  upsertStep(name: string, output: StepOutput): FlowExecutionContext {
    const steps = { ...this.steps };

    if (this.currentPath.length > 0) {
      // We're inside a loop; store in the loop step's iterations
      const loopStep = this.currentPath[0];
      const existingLoop = steps[loopStep.stepName];
      if (existingLoop) {
        const iterations = { ...(existingLoop.iterations ?? {}) };
        const iterSteps = { ...(iterations[loopStep.iteration] ?? {}) };
        iterSteps[name] = output;
        iterations[loopStep.iteration] = iterSteps;
        steps[loopStep.stepName] = { ...existingLoop, iterations };
      }
    } else {
      steps[name] = output;
    }

    return new FlowExecutionContext({ ...this, steps });
  }

  setVerdict(verdict: ExecutionVerdict, error?: string): FlowExecutionContext {
    return new FlowExecutionContext({ ...this, verdict, error });
  }

  setCurrentPath(path: ExecutionPath[]): FlowExecutionContext {
    return new FlowExecutionContext({ ...this, currentPath: path });
  }

  addDuration(ms: number): FlowExecutionContext {
    return new FlowExecutionContext({ ...this, duration: this.duration + ms });
  }

  addTags(tags: string[]): FlowExecutionContext {
    return new FlowExecutionContext({ ...this, tags: [...this.tags, ...tags] });
  }

  /**
   * Get the current state object for variable resolution.
   * Flattens loop iterations into a single object.
   */
  currentState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};

    for (const [name, step] of Object.entries(this.steps)) {
      state[name] = step.output;
    }

    // Overlay loop-scoped variables
    for (const pathEntry of this.currentPath) {
      const loopStep = this.steps[pathEntry.stepName];
      if (loopStep?.iterations?.[pathEntry.iteration]) {
        for (const [name, step] of Object.entries(loopStep.iterations[pathEntry.iteration])) {
          state[name] = step.output;
        }
      }
    }

    return state;
  }
}
