import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Save, Upload, Play, Loader2, History, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFlowBuilderStore } from "../flow-builder-store";

export interface FlowValidationIssue {
  code: string;
  path: string;
  message: string;
}
export interface FlowValidation {
  valid: boolean;
  errors: FlowValidationIssue[];
  warnings: FlowValidationIssue[];
}

export interface FlowToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onExecute: () => void;
  publishing?: boolean;
  executing?: boolean;
  validation?: FlowValidation;
}

export function FlowToolbar({ onBack, onSave, onPublish, onExecute, publishing, executing, validation }: FlowToolbarProps) {
  const { t } = useTranslation();
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const saving = useFlowBuilderStore((s) => s.saving);
  const dirty = useFlowBuilderStore((s) => s.dirty);
  const updateFlowName = useFlowBuilderStore((s) => s.updateFlowName);
  const rightSidebar = useFlowBuilderStore((s) => s.rightSidebar);
  const toggleRunsSidebar = useFlowBuilderStore((s) => s.toggleRunsSidebar);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [validationOpen, setValidationOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  if (!flowVersion) return null;

  const displayName = flowVersion.displayName;

  const commitName = () => {
    setEditingName(false);
    if (draftName.trim() && draftName !== displayName) {
      updateFlowName(draftName.trim());
    }
  };

  const buttonBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "inherit",
    borderRadius: 6,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
  };

  return (
    <div
      style={{
        padding: "0 16px",
        height: 48,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--surface)",
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <button
        onClick={onBack}
        style={{ ...buttonBase, padding: "6px 8px", border: "none", background: "none", color: "var(--text-muted)" }}
        aria-label={t('workflows.backToFlows')}
      >
        <ArrowLeft size={16} />
      </button>

      {/* Flow name */}
      {editingName ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") setEditingName(false);
          }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            background: "var(--surface-2, var(--surface))",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            padding: "2px 8px",
            fontFamily: "inherit",
            outline: "none",
            minWidth: 180,
          }}
        />
      ) : (
        <button
          onClick={() => { setDraftName(displayName); setEditingName(true); }}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 4,
            fontFamily: "inherit",
          }}
          title={t('workflows.clickToRename')}
        >
          {displayName}
        </button>
      )}

      {/* State badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 12,
          background: flowVersion.state === "locked" ? "var(--success-light)" : "var(--warning-light)",
          color: flowVersion.state === "locked" ? "var(--success)" : "var(--warning)",
          border: `1px solid ${flowVersion.state === "locked" ? "#bbf7d0" : "#fde68a"}`,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {flowVersion.state === "locked" ? t('workflows.published') : t('workflows.draft')}
      </span>

      {dirty && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>{t('workflows.unsavedChanges')}</span>
      )}

      <div style={{ flex: 1 }} />

      {/* Validation indicator */}
      {validation && (() => {
        const errs = validation.errors ?? [];
        const warns = validation.warnings ?? [];
        const hasErr = errs.length > 0;
        const hasWarn = warns.length > 0;
        const color = hasErr ? "var(--danger)" : hasWarn ? "var(--warning)" : "var(--success)";
        const bg = hasErr ? "var(--danger-light)" : hasWarn ? "var(--warning-light)" : "var(--success-light)";
        const Icon = hasErr ? XCircle : hasWarn ? AlertTriangle : CheckCircle2;
        const label = hasErr
          ? t("workflows.validationErrors", { count: errs.length, defaultValue: "{{count}} error(s)" })
          : hasWarn
            ? t("workflows.validationWarnings", { count: warns.length, defaultValue: "{{count}} warning(s)" })
            : t("workflows.validationValid", "Valid");
        const items = [...errs.map((e) => ({ ...e, kind: "error" as const })), ...warns.map((w) => ({ ...w, kind: "warn" as const }))];
        return (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setValidationOpen((v) => !v)}
              disabled={items.length === 0}
              style={{
                ...buttonBase,
                background: bg,
                borderColor: color,
                color,
                cursor: items.length === 0 ? "default" : "pointer",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
            {validationOpen && items.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 50,
                  width: 320,
                  maxHeight: 320,
                  overflowY: "auto",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
                  padding: 6,
                }}
              >
                {items.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, padding: "6px 8px", alignItems: "flex-start" }}>
                    {it.kind === "error" ? (
                      <XCircle size={13} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                    ) : (
                      <AlertTriangle size={13} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text)" }}>{it.message}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>{it.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* History toggle */}
      <button
        onClick={toggleRunsSidebar}
        style={{
          ...buttonBase,
          background: rightSidebar === "runs" ? "var(--accent-light)" : "var(--surface)",
          borderColor: rightSidebar === "runs" ? "var(--accent-border)" : "var(--border)",
          color: rightSidebar === "runs" ? "var(--accent)" : "var(--text)",
        }}
      >
        <History size={14} />
        {t('workflows.runs')}
      </button>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        style={{
          ...buttonBase,
          opacity: saving || !dirty ? 0.5 : 1,
          cursor: saving || !dirty ? "default" : "pointer",
        }}
      >
        {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
        {saving ? t('workflows.saving') : t('save')}
      </button>

      {/* Publish */}
      <button
        onClick={onPublish}
        disabled={publishing}
        style={{
          ...buttonBase,
          background: "var(--accent-light)",
          borderColor: "var(--accent-border)",
          color: "var(--accent)",
          fontWeight: 600,
          opacity: publishing ? 0.5 : 1,
        }}
      >
        {publishing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={14} />}
        {t('workflows.publish')}
      </button>

      {/* Execute */}
      <button
        onClick={onExecute}
        disabled={executing}
        style={{
          ...buttonBase,
          background: "var(--accent)",
          borderColor: "var(--accent)",
          color: "#fff",
          fontWeight: 600,
          opacity: executing ? 0.5 : 1,
        }}
      >
        {executing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
        {t('workflows.run')}
      </button>
    </div>
  );
}
