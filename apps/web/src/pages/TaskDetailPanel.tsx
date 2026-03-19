import { X, RefreshCw } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { trpc } from "../lib/trpc";
import { HistoryEntry } from "../components/molecules/HistoryEntry/HistoryEntry";

function formatTimestamp(date: string | Date): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const statusColors: Record<string, string> = {
  running: "var(--accent)",
  pending: "var(--warning)",
  completed: "var(--success)",
  failed: "var(--danger)",
  cancelled: "var(--text-muted)",
};

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onRetry?: (id: string) => void;
}

export function TaskDetailPanel({ taskId, onClose, onRetry }: TaskDetailPanelProps) {
  const taskQuery = trpc.tasks.getById.useQuery({ id: taskId });
  const logsQuery = trpc.tasks.getLogs.useQuery({ taskId });

  const task = taskQuery.data;
  const logs = logsQuery.data ?? [];

  if (!task) {
    return (
      <div
        style={{
          width: 400,
          borderLeft: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    );
  }

  const statusColor = statusColors[task.status] ?? "var(--text-muted)";

  return (
    <div
      style={{
        width: 400,
        minWidth: 400,
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
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{task.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 500,
                color: statusColor,
                background: `${statusColor}15`,
                border: `1px solid ${statusColor}30`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
              {task.status}
            </span>
            {task.progress > 0 && task.status === "running" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{task.progress}%</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {task.status === "failed" && onRetry && (
            <button
              onClick={() => onRetry(task.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "none",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "inherit",
              }}
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {task.description}
        </div>
      )}

      {/* Logs */}
      <div style={{ padding: "10px 16px 6px", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Execution Logs
        </span>
      </div>
      <ScrollArea.Root style={{ flex: 1, overflow: "hidden" }}>
        <ScrollArea.Viewport style={{ height: "100%" }}>
          {logs.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No logs yet
            </div>
          ) : (
            logs.map((log) => (
              <HistoryEntry
                key={log.id}
                timestamp={formatTimestamp(log.createdAt)}
                status={log.level === "error" ? "failed" : "success"}
                message={log.message}
                duration=""
                details={log.metadata ?? undefined}
              />
            ))
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
          <ScrollArea.Thumb style={{ background: "var(--border)", borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {/* Result / Error */}
      {(task.result || task.error) && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: task.error ? "var(--danger)" : "var(--success)", marginBottom: 4 }}>
            {task.error ? "Error" : "Result"}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text)",
              lineHeight: 1.5,
              maxHeight: 100,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {task.error ?? task.result}
          </div>
        </div>
      )}
    </div>
  );
}
