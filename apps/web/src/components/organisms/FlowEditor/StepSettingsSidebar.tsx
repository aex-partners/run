import { useMemo } from "react";
import {
  X,
  Trash2,
  SkipForward,
  Zap,
  Code,
  Repeat,
  GitBranch,
  Puzzle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useFlowBuilderStore,
  collectSteps,
  type FlowAction,
  type FlowTrigger,
  type ActionType,
  type TriggerType,
} from "../../../stores/flow-builder-store";

// ---- Shared input style ----

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--text)",
  background: "var(--surface-2, var(--surface))",
  border: "1px solid var(--border)",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
};

// ---- Trigger Settings Panel ----

function TriggerSettings({ trigger }: { trigger: FlowTrigger }) {
  const { t } = useTranslation();
  const updateTriggerSettings = useFlowBuilderStore((s) => s.updateTriggerSettings);
  const updateTriggerType = useFlowBuilderStore((s) => s.updateTriggerType);
  const updateStepDisplayName = useFlowBuilderStore((s) => s.updateStepDisplayName);

  return (
    <div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t('workflows.displayName')}</label>
        <input
          style={inputStyle}
          value={trigger.displayName}
          onChange={(e) => updateStepDisplayName(trigger.name, e.target.value)}
        />
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t('workflows.triggerType')}</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={trigger.type}
          onChange={(e) => updateTriggerType(e.target.value as TriggerType)}
        >
          <option value="EMPTY">Empty (Manual)</option>
          <option value="PIECE">Plugin Trigger</option>
        </select>
      </div>
      {trigger.type === "PIECE" && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>{t('workflows.pluginName')}</label>
            <input
              style={inputStyle}
              placeholder={t('workflows.pluginNamePlaceholder')}
              value={(trigger.settings.pieceName as string) ?? ""}
              onChange={(e) => updateTriggerSettings({ pieceName: e.target.value })}
            />
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>{t('workflows.pluginTrigger')}</label>
            <input
              style={inputStyle}
              placeholder={t('workflows.triggerNamePlaceholder')}
              value={(trigger.settings.triggerName as string) ?? ""}
              onChange={(e) => updateTriggerSettings({ triggerName: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---- Piece Action Settings ----

function PieceSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  return (
    <>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t('workflows.pluginName')}</label>
        <input
          style={inputStyle}
          placeholder={t('workflows.pluginNamePlaceholder')}
          value={(action.settings.pieceName as string) ?? ""}
          onChange={(e) => updateStepSettings(action.name, { pieceName: e.target.value })}
        />
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t('workflows.actionName')}</label>
        <input
          style={inputStyle}
          placeholder={t('workflows.actionNamePlaceholder')}
          value={(action.settings.actionName as string) ?? ""}
          onChange={(e) => updateStepSettings(action.name, { actionName: e.target.value })}
        />
      </div>
      <div style={sectionStyle}>
        <label style={labelStyle}>{t('workflows.inputJson')}</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}
          placeholder='{"url": "https://..."}'
          value={(action.settings.input as string) ?? ""}
          onChange={(e) => updateStepSettings(action.name, { input: e.target.value })}
        />
      </div>
    </>
  );
}

// ---- Code Action Settings ----

function CodeSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.code')}</label>
      <textarea
        style={{
          ...inputStyle,
          minHeight: 180,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.5,
        }}
        placeholder="// Write your code here..."
        value={(action.settings.sourceCode as string) ?? ""}
        onChange={(e) => updateStepSettings(action.name, { sourceCode: e.target.value })}
      />
    </div>
  );
}

// ---- Loop Settings ----

function LoopSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.itemsExpression')}</label>
      <input
        style={inputStyle}
        placeholder="{{trigger.items}}"
        value={(action.settings.items as string) ?? ""}
        onChange={(e) => updateStepSettings(action.name, { items: e.target.value })}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        Expression that returns an array to iterate over.
      </div>
    </div>
  );
}

// ---- Router Settings ----

function RouterSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  const branches = (action.settings.branches as Array<{ condition: string; name: string }>) ?? [];

  const updateBranch = (index: number, field: string, value: string) => {
    const updated = [...branches];
    updated[index] = { ...updated[index], [field]: value };
    updateStepSettings(action.name, { branches: updated });
  };

  const addBranch = () => {
    updateStepSettings(action.name, {
      branches: [...branches, { name: `Branch ${branches.length + 1}`, condition: "" }],
    });
  };

  const removeBranch = (index: number) => {
    const updated = branches.filter((_, i) => i !== index);
    updateStepSettings(action.name, { branches: updated });
  };

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.branches')}</label>
      {branches.map((branch, i) => (
        <div key={i} style={{ marginBottom: 8, padding: 8, background: "var(--surface-2, var(--surface))", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <input
              style={{ ...inputStyle, fontSize: 12, fontWeight: 600 }}
              value={branch.name}
              onChange={(e) => updateBranch(i, "name", e.target.value)}
              placeholder="Branch name"
            />
            <button
              onClick={() => removeBranch(i)}
              style={{
                background: "none",
                border: "none",
                color: "var(--danger)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
              }}
              aria-label="Remove branch"
            >
              <X size={14} />
            </button>
          </div>
          <input
            style={{ ...inputStyle, fontSize: 12 }}
            value={branch.condition}
            onChange={(e) => updateBranch(i, "condition", e.target.value)}
            placeholder="{{step.value}} > 10"
          />
        </div>
      ))}
      <button
        onClick={addBranch}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          fontFamily: "inherit",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 6,
          cursor: "pointer",
          color: "var(--text-muted)",
          marginTop: 4,
        }}
      >
        + Add Branch
      </button>
    </div>
  );
}

// ---- Action type selector ----

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string; icon: typeof Code }[] = [
  { value: "PIECE", label: "Plugin", icon: Puzzle },
  { value: "CODE", label: "Code", icon: Code },
  { value: "LOOP_ON_ITEMS", label: "Loop", icon: Repeat },
  { value: "ROUTER", label: "Router", icon: GitBranch },
];

function ActionTypeSelector({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);

  // We need to update the type in the linked list. Since type isn't in settings,
  // we manipulate the trigger clone in the store action.
  // For simplicity, re-create the step via the store's internal approach.
  // Actually, let's just update settings and type together via a dedicated approach.
  // The cleanest way: store settings.actionType as a proxy, but let's use a simpler approach.
  // We'll use updateStepSettings to store a "_type" hint and handle it in save.
  // Actually, the simplest: just show current type as read-only for now, with a selector.

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.stepType')}</label>
      <div style={{ display: "flex", gap: 4 }}>
        {ACTION_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            style={{
              flex: 1,
              padding: "6px 4px",
              fontSize: 11,
              fontWeight: action.type === value ? 600 : 400,
              fontFamily: "inherit",
              background: action.type === value ? "var(--accent-light)" : "var(--surface)",
              border: `1px solid ${action.type === value ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 6,
              cursor: "pointer",
              color: action.type === value ? "var(--accent)" : "var(--text-muted)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
            onClick={() => {
              // Update the type by cloning the trigger and setting it
              if (!flowVersion) return;
              const trigger = JSON.parse(JSON.stringify(flowVersion.trigger));
              const steps = collectSteps(trigger);
              const step = steps.find((s) => s.name === action.name);
              if (step && "type" in step && step !== trigger) {
                (step as FlowAction).type = value;
                useFlowBuilderStore.setState({
                  flowVersion: { ...flowVersion, trigger },
                  dirty: true,
                });
              }
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Main Sidebar Component ----

export function StepSettingsSidebar() {
  const { t } = useTranslation();
  const selectedStep = useFlowBuilderStore((s) => s.selectedStep);
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const rightSidebar = useFlowBuilderStore((s) => s.rightSidebar);
  const selectStep = useFlowBuilderStore((s) => s.selectStep);
  const deleteStep = useFlowBuilderStore((s) => s.deleteStep);
  const updateStepDisplayName = useFlowBuilderStore((s) => s.updateStepDisplayName);
  const updateStepSkip = useFlowBuilderStore((s) => s.updateStepSkip);

  const step = useMemo(() => {
    if (!flowVersion || !selectedStep) return null;
    const steps = collectSteps(flowVersion.trigger);
    return steps.find((s) => s.name === selectedStep) ?? null;
  }, [flowVersion, selectedStep]);

  if (rightSidebar !== "settings" || !step) return null;

  const isTrigger = step === flowVersion?.trigger;
  const action = isTrigger ? null : (step as FlowAction);

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isTrigger ? <Zap size={14} color="var(--accent)" /> : null}
          {action?.type === "PIECE" ? <Puzzle size={14} color="#6366f1" /> : null}
          {action?.type === "CODE" ? <Code size={14} color="#d97706" /> : null}
          {action?.type === "LOOP_ON_ITEMS" ? <Repeat size={14} color="#16a34a" /> : null}
          {action?.type === "ROUTER" ? <GitBranch size={14} color="#8b5cf6" /> : null}
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
            {isTrigger ? "Trigger Settings" : "Step Settings"}
          </span>
        </div>
        <button
          onClick={() => selectStep(null)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 2,
            display: "flex",
          }}
          aria-label={t('workflows.closeSettings')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isTrigger && flowVersion && (
          <TriggerSettings trigger={flowVersion.trigger} />
        )}

        {action && (
          <>
            {/* Display Name */}
            <div style={sectionStyle}>
              <label style={labelStyle}>{t('workflows.displayName')}</label>
              <input
                style={inputStyle}
                value={action.displayName}
                onChange={(e) => updateStepDisplayName(action.name, e.target.value)}
              />
            </div>

            {/* Action type selector */}
            <ActionTypeSelector action={action} />

            {/* Type-specific settings */}
            {action.type === "PIECE" && <PieceSettings action={action} />}
            {action.type === "CODE" && <CodeSettings action={action} />}
            {action.type === "LOOP_ON_ITEMS" && <LoopSettings action={action} />}
            {action.type === "ROUTER" && <RouterSettings action={action} />}

            {/* Skip toggle */}
            <div style={{ ...sectionStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <SkipForward size={14} color="var(--text-muted)" />
                <span style={{ fontSize: 13, color: "var(--text)" }}>{t('workflows.skipStep')}</span>
              </div>
              <button
                onClick={() => updateStepSkip(action.name, !action.skip)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: action.skip ? "var(--accent)" : "var(--border)",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.15s",
                }}
                aria-label={action.skip ? t('workflows.enableStep') : t('workflows.skipStep')}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: action.skip ? 18 : 2,
                    transition: "left 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {/* Delete step */}
            <div style={{ padding: "16px" }}>
              <button
                onClick={() => deleteStep(action.name)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  background: "var(--danger-light)",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Trash2 size={14} />
                Delete Step
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
