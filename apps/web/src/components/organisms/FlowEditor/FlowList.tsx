import { GitBranch, Plus, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface FlowListItem {
  id: string;
  displayName: string;
  status: "enabled" | "disabled";
  publishedVersionId: string | null;
  updatedAt: string;
  lastRunStatus?: "running" | "completed" | "failed" | null;
}

export interface FlowListProps {
  flows: FlowListItem[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function RunStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  const config: Record<string, { bg: string; color: string; border: string; icon: typeof CheckCircle2; label: string }> = {
    completed: { bg: "var(--success-light)", color: "var(--success)", border: "#bbf7d0", icon: CheckCircle2, label: "Last run: OK" },
    failed: { bg: "var(--danger-light)", color: "var(--danger)", border: "#fecaca", icon: XCircle, label: "Last run: Failed" },
    running: { bg: "var(--warning-light)", color: "var(--warning)", border: "#fde68a", icon: Clock, label: "Running" },
  };

  const c = config[status];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 500,
        padding: "1px 6px",
        borderRadius: 12,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon size={10} />
      {c.label}
    </span>
  );
}

export function FlowList({ flows, onSelect, onCreate, onDelete }: FlowListProps) {
  const { t } = useTranslation();
  if (flows.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 40,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
          }}
        >
          <GitBranch size={28} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
            No flows yet
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px", maxWidth: 320 }}>
            Create your first flow to automate tasks with triggers and actions.
          </p>
          <button
            onClick={onCreate}
            style={{
              padding: "8px 20px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Create Flow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GitBranch size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{t('workflows.flows')}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-muted)",
              background: "var(--surface-2)",
              padding: "1px 8px",
              borderRadius: 12,
            }}
          >
            {flows.length}
          </span>
        </div>
        <button
          onClick={onCreate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 14px",
            background: "var(--accent)",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={14} />
          New Flow
        </button>
      </div>

      {/* Flow cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {flows.map((flow) => (
            <div
              key={flow.id}
              onClick={() => onSelect(flow.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px var(--accent-light)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {flow.displayName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {/* Status badge */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 12,
                        background: flow.status === "enabled" ? "var(--success-light)" : "var(--surface-2)",
                        color: flow.status === "enabled" ? "var(--success)" : "var(--text-muted)",
                        border: `1px solid ${flow.status === "enabled" ? "#bbf7d0" : "var(--border)"}`,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: flow.status === "enabled" ? "var(--success)" : "var(--text-muted)",
                        }}
                      />
                      {flow.status === "enabled" ? "Enabled" : "Disabled"}
                    </span>
                    <RunStatusBadge status={flow.lastRunStatus} />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(flow.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    opacity: 0.5,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                  aria-label={t('workflows.deleteFlow')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                Updated {formatRelativeTime(flow.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
