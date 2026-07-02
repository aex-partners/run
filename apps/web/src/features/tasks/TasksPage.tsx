import { useState } from "react";
import { Activity, CheckCircle2, XCircle, Clock, Bell, Plus } from "lucide-react";
import { trpc } from "../../platform/trpc";
import { TasksScreen, type FilterItem } from "./TasksScreen/TasksScreen";
import { StatsCard } from "./StatsCard/StatsCard";
import type { Task } from "./TaskList/TaskList";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { RemindersPanel } from "./RemindersPanel/RemindersPanel";
import { CreateTaskModal } from "./CreateTaskModal/CreateTaskModal";
import { useAuth } from "../auth/useAuth";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

const SERVER_STATUSES = ["running", "pending", "completed", "failed", "cancelled"] as const;

function formatRelativeTime(date: string | Date, t: TFunction): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('tasks.timeJustNow');
  if (diffMin < 60) return t('tasks.timeMinutesAgo', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('tasks.timeHoursAgo', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  return t('tasks.timeDaysAgo', { n: diffD });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffS = Math.floor((end - start) / 1000);
  if (diffS < 60) return `${diffS}s`;
  const min = Math.floor(diffS / 60);
  const sec = diffS % 60;
  return `${min}m ${sec}s`;
}

export function TasksPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [view, setView] = useState<"tasks" | "reminders">("tasks");
  const [createOpen, setCreateOpen] = useState(false);

  const isServerStatus = (SERVER_STATUSES as readonly string[]).includes(activeFilter);
  const tasksQuery = trpc.tasks.list.useQuery(
    activeFilter === "scheduled"
      ? { scheduledOnly: true }
      : isServerStatus
        ? { status: activeFilter as "pending" | "running" | "completed" | "failed" | "cancelled" }
        : undefined,
  );
  const statsQuery = trpc.tasks.stats.useQuery();
  const cancelMut = trpc.tasks.cancel.useMutation({
    onSuccess: () => {
      tasksQuery.refetch();
      statsQuery.refetch();
    },
  });
  const retryMut = trpc.tasks.retry.useMutation({
    onSuccess: () => {
      tasksQuery.refetch();
      statsQuery.refetch();
    },
  });
  const acknowledgeMut = trpc.tasks.acknowledge.useMutation({
    onSuccess: () => {
      tasksQuery.refetch();
      statsQuery.refetch();
    },
  });
  const snoozeMut = trpc.tasks.snooze.useMutation({
    onSuccess: () => {
      tasksQuery.refetch();
      statsQuery.refetch();
    },
  });

  const stats = statsQuery.data ?? { running: 0, pending: 0, failed: 0, completedToday: 0 };
  const total = stats.running + stats.pending + stats.failed + stats.completedToday;

  const filters: FilterItem[] = [
    { id: "all", label: t('tasks.allTasks'), count: total },
    { id: "assignedToMe", label: t('tasks.assignedToMe'), count: undefined },
    { id: "createdByMe", label: t('tasks.createdByMe'), count: undefined },
    { id: "running", label: t('status.running'), count: stats.running },
    { id: "pending", label: t('status.pending'), count: stats.pending },
    { id: "scheduled", label: t('tasks.scheduled'), count: undefined },
    { id: "acknowledged", label: t('tasks.done'), count: undefined },
    { id: "completed", label: t('tasks.completedToday'), count: stats.completedToday },
    { id: "failed", label: t('status.failed'), count: stats.failed },
  ];

  const agentsQuery = trpc.agents.list.useQuery();
  const agentsMap = new Map((agentsQuery.data ?? []).map((a) => [a.id, a.name]));

  const tasks: Task[] = (tasksQuery.data ?? []).map((row) => {
    const raw = row as typeof row & { type?: string; toolName?: string; agentId?: string };
    let description = row.description ?? undefined;
    if (row.status === "pending" && row.scheduledAt) {
      const scheduled = new Date(row.scheduledAt);
      const now = new Date();
      const diffMin = Math.max(0, Math.round((scheduled.getTime() - now.getTime()) / 60000));
      description = diffMin > 0
        ? t('tasks.scheduledInMinutes', { n: diffMin })
        : description;
    }
    const agentName = raw.agentId ? agentsMap.get(raw.agentId) ?? "Eric" : "Eric";
    return {
      id: row.id,
      title: row.title,
      description,
      status: row.status as Task["status"],
      agent: agentName,
      startTime: formatRelativeTime(row.createdAt, t),
      duration: formatDuration(row.startedAt, row.completedAt),
      progress: row.progress,
      taskType: raw.type as "inference" | "structured" | undefined,
      toolName: raw.toolName,
      executor: row.executor as Task["executor"],
      kind: row.kind as Task["kind"],
      createdBy: row.createdBy ?? undefined,
      assigneeIds: row.assigneeIds ?? [],
      canAcknowledge: row.executor === "human" && (row.assigneeIds ?? []).includes(user.id),
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <StatsCard
          label={t('status.running')}
          value={stats.running}
          icon={<Activity size={16} />}
          iconColor="var(--info)"
        />
        <StatsCard
          label={t('tasks.completedToday')}
          value={stats.completedToday}
          icon={<CheckCircle2 size={16} />}
          iconColor="var(--success)"
        />
        <StatsCard
          label={t('status.failed')}
          value={stats.failed}
          icon={<XCircle size={16} />}
          iconColor="var(--danger)"
        />
        <StatsCard
          label={t('status.pending')}
          value={stats.pending}
          icon={<Clock size={16} />}
          iconColor="var(--warning)"
        />
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 4, padding: "8px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {(["tasks", "reminders"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: view === v ? 600 : 500,
              border: "1px solid var(--border)",
              background: view === v ? "var(--accent-light, #fff5f0)" : "transparent",
              color: view === v ? "var(--accent)" : "var(--text-muted)",
              borderRadius: 8,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            {v === "reminders" ? <Bell size={14} /> : <Activity size={14} />}
            {v === "tasks" ? t('tasks.title') : t('tasks.reminders')}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {view === "tasks" ? (
            <TasksScreen
              tasks={tasks}
              filters={filters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              runningCount={stats.running}
              currentUserId={user.id}
              headerActions={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setCreateOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <Plus size={14} />
                    {t('tasks.createTask')}
                  </button>
                </div>
              }
              onCancel={(id) => cancelMut.mutate({ id })}
              onRetry={(id) => retryMut.mutate({ id })}
              onViewLogs={(id) => setSelectedTaskId(id)}
              onAcknowledge={(id) => acknowledgeMut.mutate({ id })}
              onSnooze={(id) => snoozeMut.mutate({ id, until: new Date(Date.now() + 3600_000).toISOString() })}
            />
          ) : (
            <RemindersPanel />
          )}
        </div>

        {selectedTaskId && view === "tasks" && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onRetry={(id) => {
              retryMut.mutate({ id });
              setSelectedTaskId(null);
            }}
          />
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          tasksQuery.refetch();
          statsQuery.refetch();
        }}
      />
    </div>
  );
}
