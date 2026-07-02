import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  BackgroundVariant,
  type NodeProps,
  type Node,
  type Edge,
  type EdgeProps,
  getBezierPath,
  BaseEdge,
} from "@xyflow/react";
import { Zap, Code, Repeat, GitBranch, Puzzle, Plus, SkipForward, Trash2 } from "lucide-react";
import {
  useFlowBuilderStore,
  collectSteps,
  generateStepName,
  type FlowTrigger,
  type FlowAction,
  type ActionType,
} from "../flow-builder-store";

// ---- Node sizing ----
const NODE_WIDTH = 260;
const NODE_GAP_Y = 100;
const COL_W = NODE_WIDTH + 60;

// ---- Convert linked list to ReactFlow nodes + edges ----

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

interface LayoutCtx {
  nodes: Node[];
  edges: Edge[];
  selectedStep: string | null;
}

function pushActionNode(S: LayoutCtx, action: FlowAction, x: number, y: number): void {
  S.nodes.push({
    id: action.name,
    type: "flowAction",
    position: { x, y },
    data: {
      displayName: action.displayName,
      actionType: action.type,
      selected: S.selectedStep === action.name,
      stepName: action.name,
      skip: action.skip,
      valid: action.valid,
    },
    draggable: false,
  });
}

function getBranchNames(action: FlowAction): string[] {
  const raw = (action.settings.branches as Array<{ branchName?: string; name?: string }>) ?? [];
  return raw.map((b, i) => b.branchName ?? b.name ?? `Branch ${i + 1}`);
}

type EmptyTarget =
  | { kind: "branch"; routerName: string; branchIndex: number }
  | { kind: "loop"; loopName: string }
  | null;

// Recursively lay out a linear chain (main flow, a router branch, or a loop
// body). ROUTER fans its branches into side-by-side columns; LOOP renders its
// body indented under a label; both recurse through the same function, so
// nesting (a router inside a branch, a loop inside a router, …) just works.
// Returns the Y after the chain's trailing "+" add slot.
//   from         — node to connect the first step from, and how (plain vs insert-+)
//   emptyAnchorId— when the chain is empty, the step to append AFTER (main → trigger)
//   emptyTarget  — when empty and no anchor, the branch/loop to append INTO
function layoutChain(
  start: FlowAction | undefined,
  x: number,
  startY: number,
  from: { id: string; mode: "insert" | "plain" },
  emptyAnchorId: string | null,
  emptyTarget: EmptyTarget,
  S: LayoutCtx,
): number {
  let y = startY;
  let prevId = from.id;
  let edgeMode = from.mode;
  let lastRealId: string | null = null;
  let cur = start;

  while (cur) {
    S.edges.push(
      edgeMode === "plain"
        ? { id: `e-${prevId}-${cur.name}`, source: prevId, target: cur.name, type: "default" }
        : { id: `e-${prevId}-${cur.name}`, source: prevId, target: cur.name, type: "addButton", data: { afterStep: prevId } },
    );
    edgeMode = "insert";
    pushActionNode(S, cur, x, y);

    if (cur.type === "ROUTER") {
      const names = getBranchNames(cur);
      const n = Math.max(names.length, 1);
      let maxY = y + NODE_GAP_Y;
      names.forEach((label, i) => {
        const bx = x + (i - (n - 1) / 2) * COL_W;
        const labelY = y + NODE_GAP_Y;
        const labelId = `${cur!.name}__b${i}`;
        S.nodes.push({ id: labelId, type: "branchLabel", position: { x: bx, y: labelY }, data: { label, kind: "branch" }, draggable: false });
        S.edges.push({ id: `e-${cur!.name}-${labelId}`, source: cur!.name, target: labelId, type: "default" });
        const child = (cur!.children ?? [])[i] ?? undefined;
        const endY = layoutChain(child, bx, labelY + NODE_GAP_Y, { id: labelId, mode: "plain" }, null, { kind: "branch", routerName: cur!.name, branchIndex: i }, S);
        if (endY > maxY) maxY = endY;
      });
      lastRealId = cur.name;
      prevId = cur.name;
      y = maxY + NODE_GAP_Y;
      cur = cur.nextAction;
      continue;
    }

    if (cur.type === "LOOP_ON_ITEMS") {
      const bx = x + 40;
      const labelY = y + NODE_GAP_Y;
      const labelId = `${cur.name}__loop`;
      S.nodes.push({ id: labelId, type: "branchLabel", position: { x: bx, y: labelY }, data: { label: "LOOP BODY", kind: "loop" }, draggable: false });
      S.edges.push({ id: `e-${cur.name}-${labelId}`, source: cur.name, target: labelId, type: "default" });
      const endY = layoutChain(cur.firstLoopAction, bx, labelY + NODE_GAP_Y, { id: labelId, mode: "plain" }, null, { kind: "loop", loopName: cur.name }, S);
      lastRealId = cur.name;
      prevId = cur.name;
      y = endY + NODE_GAP_Y;
      cur = cur.nextAction;
      continue;
    }

    lastRealId = cur.name;
    prevId = cur.name;
    y += NODE_GAP_Y;
    cur = cur.nextAction;
  }

  const afterStepId = lastRealId ?? emptyAnchorId;
  const addId = `${from.id}__add`;
  S.nodes.push({
    id: addId,
    type: "chainAdd",
    position: { x: x + NODE_WIDTH / 2 - 16, y },
    data: { afterStepId, empty: afterStepId ? null : emptyTarget },
    draggable: false,
  });
  S.edges.push({ id: `e-${prevId}-${addId}`, source: prevId, target: addId, type: "default" });
  return y + NODE_GAP_Y;
}

function triggerToLayout(trigger: FlowTrigger, selectedStep: string | null): LayoutResult {
  const S: LayoutCtx = { nodes: [], edges: [], selectedStep };

  S.nodes.push({
    id: trigger.name,
    type: "flowTrigger",
    position: { x: 0, y: 0 },
    data: { displayName: trigger.displayName, triggerType: trigger.type, selected: selectedStep === trigger.name, stepName: trigger.name },
    draggable: false,
  });

  layoutChain(trigger.nextAction, 0, NODE_GAP_Y, { id: trigger.name, mode: "insert" }, trigger.name, null, S);

  return { nodes: S.nodes, edges: S.edges };
}

// ---- Custom Trigger Node ----

function FlowTriggerNode({ data }: NodeProps) {
  const { t } = useTranslation();
  const selectStep = useFlowBuilderStore((s) => s.selectStep);
  const d = data as { displayName: string; triggerType: string; selected: boolean; stepName: string };

  return (
    <div
      onClick={() => selectStep(d.stepName)}
      style={{
        background: "var(--surface)",
        border: d.selected ? "2px solid var(--accent)" : "1.5px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
        width: NODE_WIDTH,
        boxShadow: d.selected ? "0 0 0 3px var(--accent-light)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--accent-light)",
            border: "1px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}
        >
          <Zap size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            {t('workflows.legend.trigger')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {d.displayName}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--accent)", border: "2px solid var(--surface)", width: 10, height: 10 }} />
    </div>
  );
}

// ---- Custom Action Node ----

const ACTION_ICONS: Record<ActionType, typeof Code> = {
  PIECE: Puzzle,
  CODE: Code,
  LOOP_ON_ITEMS: Repeat,
  ROUTER: GitBranch,
};

const ACTION_COLORS: Record<ActionType, { bg: string; border: string; text: string }> = {
  PIECE: { bg: "#eef2ff", border: "#c7d2fe", text: "#6366f1" },
  CODE: { bg: "#fef3c7", border: "#fde68a", text: "#d97706" },
  LOOP_ON_ITEMS: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a" },
  ROUTER: { bg: "#f5f3ff", border: "#ddd6fe", text: "#8b5cf6" },
};

// ---- Step Type Picker (shared by + buttons) ----

const STEP_TYPE_OPTIONS: { value: ActionType; icon: typeof Code; color: string }[] = [
  { value: "PIECE", icon: Puzzle, color: "#6366f1" },
  { value: "CODE", icon: Code, color: "#d97706" },
  { value: "LOOP_ON_ITEMS", icon: Repeat, color: "#16a34a" },
  { value: "ROUTER", icon: GitBranch, color: "#8b5cf6" },
];

function StepTypePicker({
  onSelect,
  onClose,
  position,
}: {
  onSelect: (type: ActionType) => void;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  const LABELS: Record<ActionType, string> = {
    PIECE: t('flowCanvas.piece'),
    CODE: t('workflows.code'),
    LOOP_ON_ITEMS: t('flowCanvas.loop'),
    ROUTER: t('flowCanvas.router'),
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Render into a portal on <body>. The picker is `position: fixed`, but React
  // Flow nodes/edges live inside `.react-flow__viewport`, which has a CSS
  // `transform`. A transformed ancestor becomes the containing block for fixed
  // children, so top/left (computed from getBoundingClientRect, i.e. viewport
  // coords) would be offset by the node transform and land off-screen. The
  // portal escapes that transform so fixed positioning is relative to the real
  // viewport again.
  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 140,
      }}
    >
      {STEP_TYPE_OPTIONS.map(({ value, icon: Icon, color }) => (
        <button
          key={value}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(value);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            fontSize: 13,
            fontFamily: "inherit",
            fontWeight: 500,
            color: "var(--text)",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2, #f3f4f6)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Icon size={14} color={color} />
          {LABELS[value]}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function FlowActionNode({ data }: NodeProps) {
  const { t } = useTranslation();
  const selectStep = useFlowBuilderStore((s) => s.selectStep);
  const deleteStep = useFlowBuilderStore((s) => s.deleteStep);
  const [hovered, setHovered] = useState(false);
  const d = data as {
    displayName: string;
    actionType: ActionType;
    selected: boolean;
    stepName: string;
    skip: boolean;
    valid: boolean;
  };

  const Icon = ACTION_ICONS[d.actionType] ?? Puzzle;
  const colors = ACTION_COLORS[d.actionType] ?? ACTION_COLORS.PIECE;

  return (
    <div
      onClick={() => selectStep(d.stepName)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: d.selected ? "2px solid var(--accent)" : "1.5px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
        width: NODE_WIDTH,
        boxShadow: d.selected ? "0 0 0 3px var(--accent-light)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer",
        opacity: d.skip ? 0.5 : 1,
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.text, border: "2px solid var(--surface)", width: 10, height: 10 }} />
      {/* Delete button on hover */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteStep(d.stepName);
          }}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--danger, #ef4444)",
            border: "2px solid var(--surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            padding: 0,
            zIndex: 10,
          }}
          aria-label={t('flowCanvas.deleteStep')}
        >
          <Trash2 size={11} />
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.text,
          }}
        >
          <Icon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: colors.text, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
              {d.actionType.replace("_", " ")}
            </span>
            {d.skip && (
              <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, color: "var(--text-muted)" }}>
                <SkipForward size={9} /> {t('flowCanvas.skipped')}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {d.displayName}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: colors.text, border: "2px solid var(--surface)", width: 10, height: 10 }} />
    </div>
  );
}

// ---- Branch / loop label ----

function BranchLabelNode({ data }: NodeProps) {
  const d = data as { label: string; kind: "branch" | "loop" };
  const color = d.kind === "loop" ? "#16a34a" : "#8b5cf6";
  const border = d.kind === "loop" ? "#bbf7d0" : "#ddd6fe";
  const Icon = d.kind === "loop" ? Repeat : GitBranch;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", width: NODE_WIDTH,
        background: "var(--surface-2, #f3f4f6)", border: `1px dashed ${border}`, borderRadius: 999,
        color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: "2px solid var(--surface)", width: 8, height: 8 }} />
      <Icon size={12} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: "2px solid var(--surface)", width: 8, height: 8 }} />
    </div>
  );
}

// ---- Unified "add step" button. Appends after a step (afterStepId), or, for an
// empty branch/loop with no anchor step, into that container. ----

function ChainAddNode({ data }: NodeProps) {
  const { t } = useTranslation();
  const addStep = useFlowBuilderStore((s) => s.addStep);
  const addBranchStep = useFlowBuilderStore((s) => s.addBranchStep);
  const addLoopStep = useFlowBuilderStore((s) => s.addLoopStep);
  const d = data as {
    afterStepId: string | null;
    empty: { kind: "branch"; routerName: string; branchIndex: number } | { kind: "loop"; loopName: string } | null;
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 4, left: rect.left });
    setPickerOpen(true);
  }, []);

  const handleSelect = useCallback((type: ActionType) => {
    const name = generateStepName();
    const labels: Record<ActionType, string> = {
      PIECE: t('flowCanvas.newPiece'),
      CODE: t('flowCanvas.newCode'),
      LOOP_ON_ITEMS: t('flowCanvas.newLoop'),
      ROUTER: t('flowCanvas.newRouter'),
    };
    const step = { name, displayName: labels[type], type, valid: false, skip: false, settings: {} };
    if (d.afterStepId) addStep(d.afterStepId, step);
    else if (d.empty?.kind === "branch") addBranchStep(d.empty.routerName, d.empty.branchIndex, step);
    else if (d.empty?.kind === "loop") addLoopStep(d.empty.loopName, step);
    setPickerOpen(false);
  }, [d, addStep, addBranchStep, addLoopStep, t]);

  return (
    <div>
      <Handle type="target" position={Position.Top} style={{ background: "var(--border)", border: "2px solid var(--surface)", width: 10, height: 10 }} />
      <button
        onClick={handleClick}
        style={{
          width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "2px dashed var(--border)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)",
        }}
        aria-label={t('workflows.addStep')}
      >
        <Plus size={16} />
      </button>
      {pickerOpen && (
        <StepTypePicker position={pickerPos} onSelect={handleSelect} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// ---- Custom Edge with Add Button ----

function AddButtonEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const { t } = useTranslation();
  const addStep = useFlowBuilderStore((s) => s.addStep);
  const d = data as { afterStep: string } | undefined;
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!d?.afterStep) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 4, left: rect.left });
    setPickerOpen(true);
  }, [d]);

  const afterStepRef = useRef(d?.afterStep);
  useEffect(() => {
    afterStepRef.current = d?.afterStep;
  }, [d?.afterStep]);

  const handleSelect = useCallback((type: ActionType) => {
    const afterStep = afterStepRef.current;
    if (!afterStep) return;
    const name = generateStepName();
    const labels: Record<ActionType, string> = {
      PIECE: t('flowCanvas.newPiece'),
      CODE: t('flowCanvas.newCode'),
      LOOP_ON_ITEMS: t('flowCanvas.newLoop'),
      ROUTER: t('flowCanvas.newRouter'),
    };
    addStep(afterStep, {
      name,
      displayName: labels[type],
      type,
      valid: false,
      skip: false,
      settings: {},
    });
    setPickerOpen(false);
  }, [addStep, t]);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "var(--border)", strokeWidth: 1.5 }} />
      <foreignObject
        width={24}
        height={24}
        x={labelX - 12}
        y={labelY - 12}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ overflow: "visible" }}
      >
        <button
          onClick={handleClick}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: hovered ? "var(--accent)" : "var(--surface)",
            border: `1.5px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: hovered ? "#fff" : "var(--text-muted)",
            padding: 0,
            transition: "all 0.15s",
          }}
          aria-label={t('workflows.addStepBetween')}
        >
          <Plus size={12} />
        </button>
      </foreignObject>
      {pickerOpen && (
        <foreignObject width={0} height={0} x={0} y={0} style={{ overflow: "visible" }}>
          <StepTypePicker
            position={pickerPos}
            onSelect={handleSelect}
            onClose={() => setPickerOpen(false)}
          />
        </foreignObject>
      )}
    </>
  );
}

// ---- Node + Edge type maps ----

const nodeTypes = {
  flowTrigger: FlowTriggerNode,
  flowAction: FlowActionNode,
  branchLabel: BranchLabelNode,
  chainAdd: ChainAddNode,
};

const edgeTypes = {
  addButton: AddButtonEdge,
};

// ---- Main Canvas Component ----

export function FlowCanvas() {
  const { t } = useTranslation();
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const selectedStep = useFlowBuilderStore((s) => s.selectedStep);

  const { nodes, edges } = useMemo(() => {
    if (!flowVersion) return { nodes: [], edges: [] };
    return triggerToLayout(flowVersion.trigger, selectedStep);
  }, [flowVersion, selectedStep]);

  if (!flowVersion) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        {t('flowCanvas.selectFlowToEdit')}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

// Re-export for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { collectSteps };
