import { create } from "zustand";

// ---- Flow engine types (linked-list model) ----

export type TriggerType = "EMPTY" | "PIECE";
export type ActionType = "PIECE" | "CODE" | "LOOP_ON_ITEMS" | "ROUTER";

export interface FlowAction {
  name: string;
  displayName: string;
  type: ActionType;
  valid: boolean;
  skip: boolean;
  settings: Record<string, unknown>;
  nextAction?: FlowAction;
  // ROUTER children (slots can be undefined when a branch is deleted)
  children?: (FlowAction | undefined)[];
  // LOOP first action
  firstLoopAction?: FlowAction;
}

export interface FlowTrigger {
  name: string;
  displayName: string;
  type: TriggerType;
  valid: boolean;
  settings: Record<string, unknown>;
  nextAction?: FlowAction;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  displayName: string;
  trigger: FlowTrigger;
  state: "draft" | "locked";
  valid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RightSidebar = "none" | "settings";

export interface FlowBuilderState {
  flowId: string | null;
  flowVersion: FlowVersion | null;
  selectedStep: string | null; // step name
  rightSidebar: RightSidebar;
  saving: boolean;
  dirty: boolean;
}

export interface FlowBuilderActions {
  loadFlow: (flowId: string, version: FlowVersion) => void;
  reset: () => void;
  selectStep: (stepName: string | null) => void;
  addStep: (afterStepName: string, step: FlowAction) => void;
  deleteStep: (stepName: string) => void;
  updateStepSettings: (stepName: string, settings: Record<string, unknown>) => void;
  updateStepDisplayName: (stepName: string, displayName: string) => void;
  updateStepSkip: (stepName: string, skip: boolean) => void;
  updateFlowName: (displayName: string) => void;
  updateTriggerSettings: (settings: Record<string, unknown>) => void;
  updateTriggerType: (type: TriggerType) => void;
  setSaving: (saving: boolean) => void;
  setDirty: (dirty: boolean) => void;
  getTriggerJson: () => string;
}

// Walk the linked list to find a step and its parent
function findStep(
  trigger: FlowTrigger,
  stepName: string,
): { step: FlowAction | FlowTrigger; parent: FlowAction | FlowTrigger | null; parentKey: string } | null {
  if (trigger.name === stepName) {
    return { step: trigger, parent: null, parentKey: "" };
  }

  function walkAction(
    action: FlowAction,
    parent: FlowAction | FlowTrigger,
    key: string,
  ): { step: FlowAction | FlowTrigger; parent: FlowAction | FlowTrigger; parentKey: string } | null {
    if (action.name === stepName) {
      return { step: action, parent, parentKey: key };
    }
    if (action.nextAction) {
      const found = walkAction(action.nextAction, action, "nextAction");
      if (found) return found;
    }
    if (action.children) {
      for (let i = 0; i < action.children.length; i++) {
        const child = action.children[i];
        if (!child) continue;
        const found = walkAction(child, action, `children[${i}]`);
        if (found) return found;
      }
    }
    if (action.firstLoopAction) {
      const found = walkAction(action.firstLoopAction, action, "firstLoopAction");
      if (found) return found;
    }
    return null;
  }

  if (trigger.nextAction) {
    return walkAction(trigger.nextAction, trigger, "nextAction");
  }
  return null;
}

// Collect all steps in order (for flattening)
export function collectSteps(trigger: FlowTrigger): (FlowTrigger | FlowAction)[] {
  const steps: (FlowTrigger | FlowAction)[] = [trigger];
  function walkAction(action: FlowAction) {
    steps.push(action);
    if (action.type === "ROUTER" && action.children) {
      for (const child of action.children) {
        if (child) walkAction(child);
      }
    }
    if (action.type === "LOOP_ON_ITEMS" && action.firstLoopAction) {
      walkAction(action.firstLoopAction);
    }
    if (action.nextAction) {
      walkAction(action.nextAction);
    }
  }
  if (trigger.nextAction) {
    walkAction(trigger.nextAction);
  }
  return steps;
}

// Deep clone trigger to avoid mutation issues
function cloneTrigger(trigger: FlowTrigger): FlowTrigger {
  return JSON.parse(JSON.stringify(trigger));
}

let stepCounter = 0;

export function generateStepName(): string {
  stepCounter++;
  return `step_${Date.now()}_${stepCounter}`;
}

export const useFlowBuilderStore = create<FlowBuilderState & FlowBuilderActions>()((set, get) => ({
  flowId: null,
  flowVersion: null,
  selectedStep: null,
  rightSidebar: "none",
  saving: false,
  dirty: false,

  loadFlow: (flowId, version) => {
    set({
      flowId,
      flowVersion: version,
      selectedStep: null,
      rightSidebar: "none",
      saving: false,
      dirty: false,
    });
  },

  reset: () => {
    set({
      flowId: null,
      flowVersion: null,
      selectedStep: null,
      rightSidebar: "none",
      saving: false,
      dirty: false,
    });
  },

  selectStep: (stepName) => {
    set({
      selectedStep: stepName,
      rightSidebar: stepName ? "settings" : "none",
    });
  },

  addStep: (afterStepName, step) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    const found = findStep(trigger, afterStepName);
    if (!found) return;

    const parent = found.step as FlowAction | FlowTrigger;
    // Preserve chain: new step's nextAction = old nextAction
    step.nextAction = parent.nextAction;
    parent.nextAction = step;

    set({
      flowVersion: { ...flowVersion, trigger },
      dirty: true,
      selectedStep: step.name,
      rightSidebar: "settings",
    });
  },

  deleteStep: (stepName) => {
    const { flowVersion, selectedStep } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    const found = findStep(trigger, stepName);
    if (!found || !found.parent) return; // Can't delete trigger

    const action = found.step as FlowAction;
    const parent = found.parent as Record<string, unknown>;

    // Reconnect: parent's link -> deleted step's nextAction
    if (found.parentKey === "nextAction") {
      parent.nextAction = action.nextAction ?? undefined;
    } else if (found.parentKey === "firstLoopAction") {
      parent.firstLoopAction = action.nextAction ?? undefined;
    } else if (found.parentKey.startsWith("children[")) {
      const match = found.parentKey.match(/\d+/);
      if (!match) return;
      const idx = parseInt(match[0], 10);
      const parentAction = found.parent as FlowAction;
      if (parentAction.children) {
        parentAction.children[idx] = action.nextAction;
      }
    }

    set({
      flowVersion: { ...flowVersion, trigger },
      dirty: true,
      selectedStep: selectedStep === stepName ? null : selectedStep,
      rightSidebar: selectedStep === stepName ? "none" : get().rightSidebar,
    });
  },

  updateStepSettings: (stepName, settings) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    const found = findStep(trigger, stepName);
    if (!found) return;

    (found.step as FlowAction).settings = { ...found.step.settings, ...settings };
    set({ flowVersion: { ...flowVersion, trigger }, dirty: true });
  },

  updateStepDisplayName: (stepName, displayName) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    const found = findStep(trigger, stepName);
    if (!found) return;

    found.step.displayName = displayName;
    set({ flowVersion: { ...flowVersion, trigger }, dirty: true });
  },

  updateStepSkip: (stepName, skip) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    const found = findStep(trigger, stepName);
    if (!found) return;

    (found.step as FlowAction).skip = skip;
    set({ flowVersion: { ...flowVersion, trigger }, dirty: true });
  },

  updateFlowName: (displayName) => {
    const { flowVersion } = get();
    if (!flowVersion) return;
    set({ flowVersion: { ...flowVersion, displayName }, dirty: true });
  },

  updateTriggerSettings: (settings) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    trigger.settings = { ...trigger.settings, ...settings };
    set({ flowVersion: { ...flowVersion, trigger }, dirty: true });
  },

  updateTriggerType: (type) => {
    const { flowVersion } = get();
    if (!flowVersion) return;

    const trigger = cloneTrigger(flowVersion.trigger);
    trigger.type = type;
    set({ flowVersion: { ...flowVersion, trigger }, dirty: true });
  },

  setSaving: (saving) => set({ saving }),
  setDirty: (dirty) => set({ dirty }),

  getTriggerJson: () => {
    const { flowVersion } = get();
    if (!flowVersion) return "{}";
    return JSON.stringify(flowVersion.trigger);
  },
}));
