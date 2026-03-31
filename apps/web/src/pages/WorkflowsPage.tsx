import { useState, useCallback, useEffect } from "react";
import { GitBranch } from "lucide-react";
import { trpc } from "../lib/trpc";
import { WorkflowsScreen, type WorkflowGraph } from "../components/screens/WorkflowsScreen/WorkflowsScreen";
import type { Workflow } from "../components/organisms/WorkflowSidebar/WorkflowSidebar";
import type { HistoryEntryProps } from "../components/molecules/HistoryEntry/HistoryEntry";

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

function triggerLabel(triggerType: string, triggerConfig: Record<string, unknown>): string {
  if (triggerType === "cron" && triggerConfig?.cronExpression) {
    return `Cron: ${triggerConfig.cronExpression}`;
  }
  if (triggerType === "event" && triggerConfig?.eventType) {
    return `Event: ${triggerConfig.eventType}`;
  }
  return triggerType.charAt(0).toUpperCase() + triggerType.slice(1);
}

export function WorkflowsPage() {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | undefined>();

  const workflowsQuery = trpc.workflows.list.useQuery();
  const workflowDetail = trpc.workflows.getById.useQuery(
    { id: activeWorkflowId! },
    { enabled: !!activeWorkflowId },
  );
  const historyQuery = trpc.workflows.executionHistory.useQuery(
    { workflowId: activeWorkflowId! },
    { enabled: !!activeWorkflowId },
  );

  const createMut = trpc.workflows.create.useMutation({
    onSuccess: (data) => {
      workflowsQuery.refetch();
      setActiveWorkflowId(data.id);
    },
  });
  const updateMut = trpc.workflows.update.useMutation({
    onSuccess: () => workflowsQuery.refetch(),
  });
  const deleteMut = trpc.workflows.delete.useMutation({
    onSuccess: () => {
      workflowsQuery.refetch();
      setActiveWorkflowId(undefined);
    },
  });
  const executeMut = trpc.workflows.execute.useMutation({
    onSuccess: () => historyQuery.refetch(),
  });
  const saveGraphMut = trpc.workflows.saveGraph.useMutation();

  // AI chat for workflows context
  const createContextConv = trpc.conversations.getOrCreateContext.useMutation();
  const sendAI = trpc.messages.send.useMutation();

  const handleAISend = useCallback(
    async (message: string) => {
      const result = await createContextConv.mutateAsync({ context: "Workflows" });
      sendAI.mutate({ conversationId: result.id, content: message });
    },
    [createContextConv, sendAI],
  );

  // Duplicate workflow
  const handleDuplicateWorkflow = useCallback(
    (id: string) => {
      const wf = workflowsQuery.data?.find((w) => w.id === id);
      if (!wf) return;
      createMut.mutate({
        name: `${wf.name} (copy)`,
        triggerType: wf.triggerType as "manual" | "cron" | "event",
        triggerConfig: wf.triggerConfig as Record<string, unknown>,
      });
    },
    [workflowsQuery.data, createMut],
  );

  // Map server data to Workflow[]
  const workflows: Workflow[] = (workflowsQuery.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    trigger: triggerLabel(w.triggerType, w.triggerConfig as Record<string, unknown>),
    status: w.status as "active" | "paused",
  }));

  // Auto-select first workflow
  useEffect(() => {
    if (!activeWorkflowId && workflows.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional auto-select
      setActiveWorkflowId(workflows[0].id);
    }
  }, [activeWorkflowId, workflows]);

  // Build workflow graphs map
  const workflowGraphs: Record<string, WorkflowGraph> = {};
  if (workflowDetail.data && activeWorkflowId) {
    workflowGraphs[activeWorkflowId] = workflowDetail.data.graph as WorkflowGraph;
  }

  // Map execution history to HistoryEntryProps
  const historyEntries: HistoryEntryProps[] = (historyQuery.data ?? []).map((exec) => ({
    timestamp: formatRelativeTime(exec.createdAt),
    status: exec.status === "completed" ? "success" as const : "failed" as const,
    duration: formatDuration(exec.startedAt, exec.completedAt),
    message: exec.status === "completed"
      ? "Completed successfully"
      : exec.error || "Execution failed",
    details: exec.result || undefined,
    onRetry: exec.status === "failed"
      ? () => executeMut.mutate({ id: exec.workflowId })
      : undefined,
  }));

  const handleNewWorkflow = useCallback(() => {
    createMut.mutate({ name: "New Workflow", triggerType: "manual" });
  }, [createMut]);

  const handleToggleStatus = useCallback(
    (id: string) => {
      const wf = workflowsQuery.data?.find((w) => w.id === id);
      if (!wf) return;
      const newStatus = wf.status === "active" ? "paused" : "active";
      updateMut.mutate({ id, status: newStatus as "active" | "paused" });
    },
    [workflowsQuery.data, updateMut],
  );

  const handleDeleteWorkflow = useCallback(
    (id: string) => {
      deleteMut.mutate({ id });
    },
    [deleteMut],
  );

  const handleWorkflowSelect = useCallback((id: string) => {
    setActiveWorkflowId(id);
  }, []);

  // Empty state
  if (workflowsQuery.isSuccess && workflows.length === 0) {
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
            No workflows yet
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px", maxWidth: 320 }}>
            Create your first workflow by asking the AI in the chat or click the button below.
          </p>
          <button
            onClick={handleNewWorkflow}
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
            Create Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <WorkflowsScreen
        workflows={workflows}
        workflowGraphs={workflowGraphs}
        historyEntries={historyEntries}
        activeWorkflowId={activeWorkflowId}
        onWorkflowSelect={handleWorkflowSelect}
        onNewWorkflow={handleNewWorkflow}
        onToggleStatus={handleToggleStatus}
        onDeleteWorkflow={handleDeleteWorkflow}
        onDuplicateWorkflow={handleDuplicateWorkflow}
        onAISend={handleAISend}
        onGraphChange={(workflowId, graph) => saveGraphMut.mutate({ id: workflowId, graph })}
      />
    </div>
  );
}
