import { X, CheckCircle2, XCircle, Loader2, Clock, PauseCircle, StopCircle } from "lucide-react";
import { useFlowBuilderStore } from "../../../stores/flow-builder-store";

export interface FlowRun {
  id: string;
  status: "running" | "succeeded" | "failed" | "paused" | "stopped";
  duration: number | null;
  error: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
}

interface FlowRunHistoryProps {
  runs: FlowRun[];
  loading?: boolean;
}

const statusConfig: Record<FlowRun["status"], { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  succeeded: { icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4", label: "Succeeded" },
  failed: { icon: XCircle, color: "#dc2626", bg: "#fef2f2", label: "Failed" },
  running: { icon: Loader2, color: "#ea580c", bg: "#fff7ed", label: "Running" },
  paused: { icon: PauseCircle, color: "#ca8a04", bg: "#fefce8", label: "Paused" },
  stopped: { icon: StopCircle, color: "#6b7280", bg: "#f9fafb", label: "Stopped" },
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function FlowRunHistory({ runs, loading }: FlowRunHistoryProps) {
  const toggleRunsSidebar = useFlowBuilderStore((s) => s.toggleRunsSidebar);

  return (
    <div
      style={{
        width: 340,
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
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
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Run History</span>
        <button
          onClick={toggleRunsSidebar}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {loading && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
            Loading runs...
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No runs yet. Click "Run" to execute this flow.
          </div>
        )}

        {runs.map((run) => {
          const cfg = statusConfig[run.status];
          const Icon = cfg.icon;
          return (
            <div
              key={run.id}
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Status row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: cfg.bg,
                    color: cfg.color,
                  }}
                >
                  <Icon
                    size={12}
                    style={run.status === "running" ? { animation: "spin 1s linear infinite" } : undefined}
                  />
                  {cfg.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                  <Clock size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                  {formatDuration(run.duration)}
                </span>
              </div>

              {/* Time */}
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {formatTime(run.startedAt ?? run.createdAt)}
              </div>

              {/* Error */}
              {run.error && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#dc2626",
                    background: "#fef2f2",
                    borderRadius: 4,
                    padding: "4px 8px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 60,
                    overflow: "hidden",
                  }}
                >
                  {run.error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
