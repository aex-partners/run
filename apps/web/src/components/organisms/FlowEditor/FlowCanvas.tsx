import { useMemo, useCallback, useState, useRef, useEffect } from "react";
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
  type ActionType,
} from "../../../stores/flow-builder-store";

// ---- Node sizing ----
const NODE_WIDTH = 260;
const NODE_GAP_Y = 100;

// ---- Convert linked list to ReactFlow nodes + edges ----

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function triggerToLayout(trigger: FlowTrigger, selectedStep: string | null): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let y = 0;

  // Trigger node
  nodes.push({
    id: trigger.name,
    type: "flowTrigger",
    position: { x: 0, y },
    data: {
      displayName: trigger.displayName,
      triggerType: trigger.type,
      selected: selectedStep === trigger.name,
      stepName: trigger.name,
    },
    draggable: false,
  });

  let prevId = trigger.name;
  let current = trigger.nextAction;
  y += NODE_GAP_Y;

  while (current) {
    // Add edge between prev and current
    edges.push({
      id: `e-${prevId}-${current.name}`,
      source: prevId,
      target: current.name,
      type: "addButton",
      data: { afterStep: prevId },
    });

    nodes.push({
      id: current.name,
      type: "flowAction",
      position: { x: 0, y },
      data: {
        displayName: current.displayName,
        actionType: current.type,
        selected: selectedStep === current.name,
        stepName: current.name,
        skip: current.skip,
        valid: current.valid,
      },
      draggable: false,
    });

    prevId = current.name;
    current = current.nextAction;
    y += NODE_GAP_Y;
  }

  // Final "add step" edge (to a phantom end node)
  const endId = "__end__";
  nodes.push({
    id: endId,
    type: "flowEnd",
    position: { x: NODE_WIDTH / 2 - 16, y },
    data: { afterStep: prevId },
    draggable: false,
  });
  edges.push({
    id: `e-${prevId}-end`,
    source: prevId,
    target: endId,
    type: "addButton",
    data: { afterStep: prevId },
  });

  return { nodes, edges };
}

// ---- Custom Trigger Node ----

function FlowTriggerNode({ data }: NodeProps) {
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
            Trigger
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

const STEP_TYPE_OPTIONS: { value: ActionType; label: string; icon: typeof Code; color: string }[] = [
  { value: "PIECE", label: "Piece", icon: Puzzle, color: "#6366f1" },
  { value: "CODE", label: "Code", icon: Code, color: "#d97706" },
  { value: "LOOP_ON_ITEMS", label: "Loop", icon: Repeat, color: "#16a34a" },
  { value: "ROUTER", label: "Router", icon: GitBranch, color: "#8b5cf6" },
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
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
      {STEP_TYPE_OPTIONS.map(({ value, label, icon: Icon, color }) => (
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
          {label}
        </button>
      ))}
    </div>
  );
}

function FlowActionNode({ data }: NodeProps) {
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
          aria-label="Delete step"
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
                <SkipForward size={9} /> Skipped
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

// ---- End node (just a + button) ----

function FlowEndNode({ data }: NodeProps) {
  const { t } = useTranslation();
  const addStep = useFlowBuilderStore((s) => s.addStep);
  const d = data as { afterStep: string };
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
      PIECE: "New Piece",
      CODE: "New Code",
      LOOP_ON_ITEMS: "New Loop",
      ROUTER: "New Router",
    };
    addStep(d.afterStep, {
      name,
      displayName: labels[type],
      type,
      valid: false,
      skip: false,
      settings: {},
    });
    setPickerOpen(false);
  }, [d.afterStep, addStep]);

  return (
    <div>
      <Handle type="target" position={Position.Top} style={{ background: "var(--border)", border: "2px solid var(--surface)", width: 10, height: 10 }} />
      <button
        onClick={handleClick}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--surface)",
          border: "2px dashed var(--border)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
        aria-label={t('workflows.addStep')}
      >
        <Plus size={16} />
      </button>
      {pickerOpen && (
        <StepTypePicker
          position={pickerPos}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
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

  const handleSelect = useCallback((type: ActionType) => {
    if (!d?.afterStep) return;
    const name = generateStepName();
    const labels: Record<ActionType, string> = {
      PIECE: "New Piece",
      CODE: "New Code",
      LOOP_ON_ITEMS: "New Loop",
      ROUTER: "New Router",
    };
    addStep(d.afterStep, {
      name,
      displayName: labels[type],
      type,
      valid: false,
      skip: false,
      settings: {},
    });
    setPickerOpen(false);
  }, [d, addStep]);

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
  flowEnd: FlowEndNode,
};

const edgeTypes = {
  addButton: AddButtonEdge,
};

// ---- Main Canvas Component ----

export function FlowCanvas() {
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const selectedStep = useFlowBuilderStore((s) => s.selectedStep);

  const { nodes, edges } = useMemo(() => {
    if (!flowVersion) return { nodes: [], edges: [] };
    return triggerToLayout(flowVersion.trigger, selectedStep);
  }, [flowVersion, selectedStep]);

  if (!flowVersion) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Select a flow to edit
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
        elementsSelectable={false}
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
