import { useMemo, useCallback } from "react";
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
import { VariablePicker } from "./VariablePicker";
import { PieceSettings } from "./PieceStepSettings";
import { useTranslation } from "react-i18next";
import {
  useFlowBuilderStore,
  collectSteps,
  type FlowAction,
  type FlowTrigger,
  type ActionType,
  type TriggerType,
} from "../flow-builder-store";

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

const CRON_PRESETS: { key: string; fallback: string; cron: string }[] = [
  { key: "workflows.cronPreset.every15", fallback: "Every 15 min", cron: "*/15 * * * *" },
  { key: "workflows.cronPreset.hourly", fallback: "Hourly", cron: "0 * * * *" },
  { key: "workflows.cronPreset.daily9", fallback: "Daily 9am", cron: "0 9 * * *" },
  { key: "workflows.cronPreset.mon9", fallback: "Mondays 9am", cron: "0 9 * * 1" },
];

function TriggerSettings({ trigger }: { trigger: FlowTrigger }) {
  const { t } = useTranslation();
  const updateTriggerSettings = useFlowBuilderStore((s) => s.updateTriggerSettings);
  const updateTriggerType = useFlowBuilderStore((s) => s.updateTriggerType);
  const updateStepDisplayName = useFlowBuilderStore((s) => s.updateStepDisplayName);
  const flowId = useFlowBuilderStore((s) => s.flowId);

  const input = (trigger.settings.input as Record<string, unknown> | undefined) ?? {};
  const cron = (input.cronExpression as string) ?? "";
  const setCron = (v: string) => updateTriggerSettings({ input: { ...input, cronExpression: v } });

  const webhookUrl = flowId ? `${window.location.origin}/api/flows/${flowId}/webhook` : "";

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
          <option value="EMPTY">{t('workflows.emptyManual')}</option>
          <option value="SCHEDULE">{t('workflows.triggerSchedule', 'Schedule (cron)')}</option>
          <option value="WEBHOOK">{t('workflows.triggerWebhook', 'Webhook (HTTP)')}</option>
          <option value="PIECE">{t('workflows.pluginTrigger')}</option>
        </select>
      </div>

      {trigger.type === "SCHEDULE" && (
        <div style={sectionStyle}>
          <label style={labelStyle}>{t('workflows.cronExpression', 'Cron expression')}</label>
          <input
            style={{ ...inputStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            placeholder="0 9 * * 1"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {CRON_PRESETS.map((p) => {
              const active = cron === p.cron;
              return (
                <button
                  key={p.cron}
                  onClick={() => setCron(p.cron)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 11,
                    fontFamily: "inherit",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--accent-light)" : "var(--surface)",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {t(p.key, p.fallback)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            {t('workflows.cronHint', 'min hour day month weekday. Runs on this schedule once the flow is published and enabled.')}
          </div>
        </div>
      )}

      {trigger.type === "WEBHOOK" && (
        <div style={sectionStyle}>
          <label style={labelStyle}>{t('workflows.webhookUrl', 'Webhook URL')}</label>
          {flowId ? (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  readOnly
                  style={{ ...inputStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 11 }}
                  value={webhookUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => { void navigator.clipboard?.writeText(webhookUrl); }}
                  style={{
                    padding: "0 12px",
                    fontSize: 12,
                    fontFamily: "inherit",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t('copy', 'Copy')}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                {t('workflows.webhookHint', 'POST to this URL to trigger the flow. The JSON body is available downstream as {{trigger.body}}.')}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t('workflows.webhookSaveFirst', 'Save the flow first to get its webhook URL.')}
            </div>
          )}
        </div>
      )}

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
        placeholder={t('workflows.writeCodeHere')}
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{t('workflows.itemsExpression')}</label>
        <VariablePicker stepName={action.name} onInsert={(tok) => updateStepSettings(action.name, { items: ((action.settings.items as string) ?? "") + tok })} />
      </div>
      <input
        style={inputStyle}
        placeholder="{{trigger.items}}"
        value={(action.settings.items as string) ?? ""}
        onChange={(e) => updateStepSettings(action.name, { items: e.target.value })}
      />
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        {t('workflows.itemsExpressionHint')}
      </div>
    </div>
  );
}

// ---- Router Settings ----
// Structured branch/condition editor matching the engine DSL exactly:
//   settings.branches: { branchName, branchType: 'CONDITION'|'FALLBACK',
//                        conditions?: { operator, firstValue, secondValue? }[] }[]
//   settings.executionType: 'EXECUTE_FIRST_MATCH'
// (was a free-text `{ name, condition }` shape the engine could not evaluate.)

interface RouterCondition { operator: string; firstValue: string; secondValue?: string }
interface RouterBranchModel { branchName: string; branchType: "CONDITION" | "FALLBACK"; conditions?: RouterCondition[] }

const ROUTER_OPERATORS: { value: string; label: string; unary?: boolean }[] = [
  { value: "TEXT_CONTAINS", label: "Text contains" },
  { value: "TEXT_DOES_NOT_CONTAIN", label: "Text does not contain" },
  { value: "TEXT_EXACTLY_MATCHES", label: "Text equals" },
  { value: "TEXT_STARTS_WITH", label: "Text starts with" },
  { value: "TEXT_ENDS_WITH", label: "Text ends with" },
  { value: "TEXT_IS_EMPTY", label: "Text is empty", unary: true },
  { value: "TEXT_IS_NOT_EMPTY", label: "Text is not empty", unary: true },
  { value: "NUMBER_IS_GREATER_THAN", label: "Number >" },
  { value: "NUMBER_IS_LESS_THAN", label: "Number <" },
  { value: "NUMBER_IS_EQUAL_TO", label: "Number =" },
  { value: "NUMBER_IS_GREATER_THAN_OR_EQUAL", label: "Number ≥" },
  { value: "NUMBER_IS_LESS_THAN_OR_EQUAL", label: "Number ≤" },
  { value: "BOOLEAN_IS_TRUE", label: "Is true", unary: true },
  { value: "BOOLEAN_IS_FALSE", label: "Is false", unary: true },
  { value: "EXISTS", label: "Exists", unary: true },
  { value: "DOES_NOT_EXIST", label: "Does not exist", unary: true },
  { value: "LIST_CONTAINS", label: "List contains" },
  { value: "LIST_DOES_NOT_CONTAIN", label: "List does not contain" },
  { value: "LIST_IS_EMPTY", label: "List is empty", unary: true },
  { value: "LIST_IS_NOT_EMPTY", label: "List is not empty", unary: true },
];
const isUnaryOperator = (op: string) => ROUTER_OPERATORS.find((o) => o.value === op)?.unary === true;

// Coerce any legacy `{ name, condition }` branches into the structured shape.
function normalizeBranches(raw: unknown): RouterBranchModel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b, i) => {
    const rec = (b ?? {}) as Record<string, unknown>;
    if (rec.branchType === "FALLBACK") {
      return { branchName: (rec.branchName as string) ?? "Otherwise", branchType: "FALLBACK" };
    }
    if (Array.isArray(rec.conditions)) {
      return {
        branchName: (rec.branchName as string) ?? (rec.name as string) ?? `Branch ${i + 1}`,
        branchType: "CONDITION",
        conditions: (rec.conditions as RouterCondition[]).map((c) => ({
          operator: c.operator ?? "TEXT_EXACTLY_MATCHES",
          firstValue: c.firstValue ?? "",
          secondValue: c.secondValue ?? "",
        })),
      };
    }
    // legacy { name, condition } -> a single equals condition seeded from the text
    return {
      branchName: (rec.name as string) ?? `Branch ${i + 1}`,
      branchType: "CONDITION",
      conditions: [{ operator: "TEXT_EXACTLY_MATCHES", firstValue: (rec.condition as string) ?? "", secondValue: "" }],
    };
  });
}

function RouterSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  const branches = normalizeBranches(action.settings.branches);

  const commit = (next: RouterBranchModel[]) =>
    updateStepSettings(action.name, { branches: next, executionType: "EXECUTE_FIRST_MATCH" });

  const setBranchName = (bi: number, name: string) => {
    const next = branches.map((b, i) => (i === bi ? { ...b, branchName: name } : b));
    commit(next);
  };
  const setCondition = (bi: number, ci: number, patch: Partial<RouterCondition>) => {
    const next = branches.map((b, i) => {
      if (i !== bi) return b;
      const conds = (b.conditions ?? []).map((c, j) => (j === ci ? { ...c, ...patch } : c));
      return { ...b, conditions: conds };
    });
    commit(next);
  };
  const addCondition = (bi: number) => {
    const next = branches.map((b, i) =>
      i === bi ? { ...b, conditions: [...(b.conditions ?? []), { operator: "TEXT_EXACTLY_MATCHES", firstValue: "", secondValue: "" }] } : b,
    );
    commit(next);
  };
  const removeCondition = (bi: number, ci: number) => {
    const next = branches.map((b, i) =>
      i === bi ? { ...b, conditions: (b.conditions ?? []).filter((_, j) => j !== ci) } : b,
    );
    commit(next);
  };
  const addBranch = () =>
    commit([
      ...branches,
      { branchName: `${t("workflows.branch", "Branch")} ${branches.length + 1}`, branchType: "CONDITION", conditions: [{ operator: "TEXT_EXACTLY_MATCHES", firstValue: "", secondValue: "" }] },
    ]);
  const removeBranch = (bi: number) => commit(branches.filter((_, i) => i !== bi));

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.branches')}</label>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {t('workflows.routerHint', 'First branch whose conditions match runs. Reference step data with {{step.field}}.')}
      </div>
      {branches.map((branch, bi) => (
        <div key={bi} style={{ marginBottom: 10, padding: 8, background: "var(--surface-2, var(--surface))", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <input
              style={{ ...inputStyle, fontSize: 12, fontWeight: 600 }}
              value={branch.branchName}
              onChange={(e) => setBranchName(bi, e.target.value)}
              placeholder={t('workflows.branchName')}
            />
            <button
              onClick={() => removeBranch(bi)}
              style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 2, display: "flex" }}
              aria-label={t('workflows.removeBranch')}
            >
              <X size={14} />
            </button>
          </div>

          {(branch.conditions ?? []).map((cond, ci) => {
            const unary = isUnaryOperator(cond.operator);
            return (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6, paddingLeft: 6, borderLeft: "2px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", flex: 1 }}
                    value={cond.firstValue}
                    onChange={(e) => setCondition(bi, ci, { firstValue: e.target.value })}
                    placeholder="{{step.field}}"
                  />
                  <VariablePicker stepName={action.name} onInsert={(tok) => setCondition(bi, ci, { firstValue: (cond.firstValue ?? "") + tok })} />
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <select
                    style={{ ...inputStyle, fontSize: 12, cursor: "pointer", flex: 1 }}
                    value={cond.operator}
                    onChange={(e) => setCondition(bi, ci, { operator: e.target.value })}
                  >
                    {ROUTER_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeCondition(bi, ci)}
                    style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", padding: "0 6px", display: "flex", alignItems: "center" }}
                    aria-label={t('workflows.removeCondition', 'Remove condition')}
                  >
                    <X size={12} />
                  </button>
                </div>
                {!unary && (
                  <input
                    style={{ ...inputStyle, fontSize: 12 }}
                    value={cond.secondValue ?? ""}
                    onChange={(e) => setCondition(bi, ci, { secondValue: e.target.value })}
                    placeholder={t('workflows.compareValue', 'value to compare')}
                  />
                )}
              </div>
            );
          })}

          <button
            onClick={() => addCondition(bi)}
            style={{ padding: "3px 8px", fontSize: 11, fontFamily: "inherit", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)" }}
          >
            + {t('workflows.addCondition', 'Add condition (OR)')}
          </button>
        </div>
      ))}
      <button
        onClick={addBranch}
        style={{ padding: "4px 10px", fontSize: 12, fontFamily: "inherit", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", marginTop: 4 }}
      >
        {t('workflows.addBranch')}
      </button>
    </div>
  );
}

// ---- Action type selector ----

const ACTION_TYPE_OPTIONS: { value: ActionType; labelKey: string; icon: typeof Code }[] = [
  { value: "PIECE", labelKey: "workflows.plugin", icon: Puzzle },
  { value: "CODE", labelKey: "workflows.code", icon: Code },
  { value: "LOOP_ON_ITEMS", labelKey: "workflows.loop", icon: Repeat },
  { value: "ROUTER", labelKey: "workflows.router", icon: GitBranch },
];

function ActionTypeSelector({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepType = useFlowBuilderStore((s) => s.updateStepType);

  const handleTypeChange = useCallback(
    (type: ActionType) => {
      updateStepType(action.name, type);
    },
    [action.name, updateStepType],
  );

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{t('workflows.stepType')}</label>
      <div style={{ display: "flex", gap: 4 }}>
        {ACTION_TYPE_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
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
            onClick={() => handleTypeChange(value)}
          >
            <Icon size={14} />
            {t(labelKey)}
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
            {isTrigger ? t('workflows.triggerSettings') : t('workflows.stepSettings')}
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
                {t('workflows.deleteStep')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
