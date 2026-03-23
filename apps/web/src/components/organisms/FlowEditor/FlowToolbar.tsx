import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Save, Upload, Play, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFlowBuilderStore } from "../../../stores/flow-builder-store";

export interface FlowToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onExecute: () => void;
  publishing?: boolean;
  executing?: boolean;
}

export function FlowToolbar({ onBack, onSave, onPublish, onExecute, publishing, executing }: FlowToolbarProps) {
  const { t } = useTranslation();
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const saving = useFlowBuilderStore((s) => s.saving);
  const dirty = useFlowBuilderStore((s) => s.dirty);
  const updateFlowName = useFlowBuilderStore((s) => s.updateFlowName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
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
        {flowVersion.state === "locked" ? "Published" : "Draft"}
      </span>

      {dirty && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>{t('workflows.unsavedChanges')}</span>
      )}

      <div style={{ flex: 1 }} />

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
        {saving ? "Saving..." : "Save"}
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
        Publish
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
        Run
      </button>
    </div>
  );
}
