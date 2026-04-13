import { useState } from "react";
import { Bell, X, History } from "lucide-react";
import { trpc } from "../../../lib/trpc";

type StatusFilter = "scheduled" | "fired" | "cancelled";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function relativeFromNow(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = d - now;
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  if (min < 1) return past ? "just now" : "in <1m";
  if (min < 60) return past ? `${min}m ago` : `in ${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`;
  const days = Math.round(h / 24);
  return past ? `${days}d ago` : `in ${days}d`;
}

export function RemindersPanel() {
  const [status, setStatus] = useState<StatusFilter>("scheduled");
  const utils = trpc.useUtils();
  const remindersQuery = trpc.reminders.list.useQuery({ status });
  const cancelMut = trpc.reminders.cancel.useMutation({
    onSuccess: () => utils.reminders.list.invalidate(),
  });

  const rows = remindersQuery.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        {(["scheduled", "fired", "cancelled"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              border: "1px solid var(--border)",
              borderRadius: 999,
              background: status === s ? "var(--accent-light, #fff5f0)" : "transparent",
              color: status === s ? "var(--accent)" : "var(--text-muted)",
              fontWeight: status === s ? 600 : 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textTransform: "capitalize",
              fontFamily: "inherit",
            }}
          >
            {s === "scheduled" ? <Bell size={12} /> : <History size={12} />}
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
            No {status} reminders.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Bell size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 2, wordBreak: "break-word" }}>
                    {r.message}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatWhen(r.scheduledFor)}
                    {" · "}
                    {relativeFromNow(r.scheduledFor)}
                    {r.conversationId ? " · in chat" : " · personal"}
                  </div>
                </div>
                {status === "scheduled" && (
                  <button
                    onClick={() => cancelMut.mutate({ id: r.id })}
                    disabled={cancelMut.isPending}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "inherit",
                    }}
                  >
                    <X size={12} />
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
