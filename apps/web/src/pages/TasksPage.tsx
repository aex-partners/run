import { useState } from "react";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { trpc } from "../lib/trpc";
import { TasksScreen, type FilterItem } from "../components/screens/TasksScreen/TasksScreen";
import { StatsCard } from "../components/molecules/StatsCard/StatsCard";
import type { Task } from "../components/organisms/TaskList/TaskList";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { useTranslation } from "react-i18next";

function formatRelativeTime(date: string | Date): string {
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const tasksQuery = trpc.tasks.list.useQuery(
    activeFilter !== "all"
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

  const stats = statsQuery.data ?? { running: 0, pending: 0, failed: 0, completedToday: 0 };
  const total = stats.running + stats.pending + stats.failed + stats.completedToday;

  const filters: FilterItem[] = [
    { id: "all", label: t('tasks.allTasks'), count: total },
    { id: "running", label: t('status.running'), count: stats.running },
    { id: "pending", label: t('status.pending'), count: stats.pending },
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
        ? `Scheduled in ${diffMin}m`
        : description;
    }
    const agentName = raw.agentId ? agentsMap.get(raw.agentId) ?? "Eric" : "Eric";
    return {
      id: row.id,
      title: row.title,
      description,
      status: row.status as Task["status"],
      agent: agentName,
      startTime: formatRelativeTime(row.createdAt),
      duration: formatDuration(row.startedAt, row.completedAt),
      progress: row.progress,
      taskType: raw.type as "inference" | "structured" | undefined,
      toolName: raw.toolName,
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
        />
        <StatsCard
          label={t('tasks.completedToday')}
          value={stats.completedToday}
          icon={<CheckCircle2 size={16} />}
        />
        <StatsCard
          label={t('status.failed')}
          value={stats.failed}
          icon={<XCircle size={16} />}
        />
        <StatsCard
          label={t('status.pending')}
          value={stats.pending}
          icon={<Clock size={16} />}
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <TasksScreen
            tasks={tasks}
            filters={filters}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            runningCount={stats.running}
            onCancel={(id) => cancelMut.mutate({ id })}
            onRetry={(id) => retryMut.mutate({ id })}
            onViewLogs={(id) => setSelectedTaskId(id)}
          />
        </div>

        {selectedTaskId && (
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
    </div>
  );
}
