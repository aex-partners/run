import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";
import { FlowList, type FlowListItem } from "../components/organisms/FlowEditor/FlowList";
import { FlowEditorScreen } from "../components/screens/FlowEditorScreen/FlowEditorScreen";
import {
  useFlowBuilderStore,
  type FlowVersion,
  type FlowTrigger,
} from "../stores/flow-builder-store";

type View = "list" | "editor";

export function FlowsPage() {
  const [view, setView] = useState<View>("list");
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  // Store actions
  const loadFlow = useFlowBuilderStore((s) => s.loadFlow);
  const reset = useFlowBuilderStore((s) => s.reset);
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const dirty = useFlowBuilderStore((s) => s.dirty);
  const setSaving = useFlowBuilderStore((s) => s.setSaving);
  const setDirty = useFlowBuilderStore((s) => s.setDirty);
  const getTriggerJson = useFlowBuilderStore((s) => s.getTriggerJson);

  // tRPC queries
  const flowsQuery = trpc.flows.list.useQuery();

  const flowDetailQuery = trpc.flows.getById.useQuery(
    { id: editingFlowId! },
    { enabled: !!editingFlowId },
  );

  const runsQuery = trpc.flows.listRuns.useQuery(
    { flowId: editingFlowId!, limit: 10 },
    { enabled: !!editingFlowId },
  );

  // tRPC mutations
  const createMut = trpc.flows.create.useMutation({
    onSuccess: (data) => {
      flowsQuery.refetch();
      setEditingFlowId(data.id);
      setView("editor");
    },
  });

  const deleteMut = trpc.flows.delete.useMutation({
    onSuccess: () => {
      flowsQuery.refetch();
    },
  });

  const saveVersionMut = trpc.flows.saveVersion.useMutation({
    onSuccess: () => {
      setSaving(false);
      setDirty(false);
      flowDetailQuery.refetch();
    },
    onError: () => {
      setSaving(false);
    },
  });

  const publishMut = trpc.flows.publish.useMutation({
    onSuccess: () => {
      flowDetailQuery.refetch();
      flowsQuery.refetch();
    },
  });

  const executeMut = trpc.flows.execute.useMutation({
    onSuccess: () => {
      runsQuery.refetch();
    },
  });

  // Auto-save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!dirty || !editingFlowId || !flowVersion) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, flowVersion?.trigger]);

  // Load flow detail into store when it arrives
  useEffect(() => {
    if (flowDetailQuery.data && editingFlowId) {
      const detail = flowDetailQuery.data;
      const versions = detail.versions;
      // Find draft version (latest draft) or latest locked
      const draftVersion = versions.find((v) => v.state === "draft") ?? versions[0];
      if (draftVersion) {
        let trigger: FlowTrigger;
        try {
          trigger = JSON.parse(draftVersion.trigger as string) as FlowTrigger;
        } catch {
          trigger = {
            name: "trigger",
            displayName: "Trigger",
            type: "EMPTY",
            valid: true,
            settings: {},
          };
        }

        const fv: FlowVersion = {
          id: draftVersion.id,
          flowId: editingFlowId,
          displayName: draftVersion.displayName,
          trigger,
          state: draftVersion.state as "draft" | "locked",
          valid: draftVersion.valid,
          createdAt: String(draftVersion.createdAt),
          updatedAt: String(draftVersion.updatedAt),
        };

        loadFlow(editingFlowId, fv);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowDetailQuery.data, editingFlowId]);

  // Map flows to list items
  const flowListItems: FlowListItem[] = (flowsQuery.data ?? []).map((f) => {
    return {
      id: f.id,
      displayName: (f as Record<string, unknown>).displayName as string ?? "Untitled",
      status: f.status as "enabled" | "disabled",
      publishedVersionId: f.publishedVersionId,
      updatedAt: String(f.updatedAt),
      lastRunStatus: null,
    };
  });

  // Handlers
  const handleCreate = useCallback(() => {
    createMut.mutate({ displayName: "New Flow" });
  }, [createMut]);

  const handleDelete = useCallback((id: string) => {
    deleteMut.mutate({ id });
  }, [deleteMut]);

  const handleSelect = useCallback((id: string) => {
    setEditingFlowId(id);
    setView("editor");
  }, []);

  const handleBack = useCallback(() => {
    reset();
    setEditingFlowId(null);
    setView("list");
    flowsQuery.refetch();
  }, [reset, flowsQuery]);

  const handleSave = useCallback(() => {
    if (!editingFlowId || !flowVersion) return;
    setSaving(true);
    saveVersionMut.mutate({
      flowId: editingFlowId,
      displayName: flowVersion.displayName,
      trigger: getTriggerJson(),
    });
  }, [editingFlowId, flowVersion, setSaving, saveVersionMut, getTriggerJson]);

  const handlePublish = useCallback(() => {
    if (!editingFlowId || !flowVersion) return;
    // Save first, then publish
    saveVersionMut.mutate(
      {
        flowId: editingFlowId,
        displayName: flowVersion.displayName,
        trigger: getTriggerJson(),
      },
      {
        onSuccess: (data) => {
          setSaving(false);
          setDirty(false);
          publishMut.mutate({ flowId: editingFlowId, versionId: data.versionId });
        },
      },
    );
  }, [editingFlowId, flowVersion, saveVersionMut, publishMut, getTriggerJson, setSaving, setDirty]);

  const handleExecute = useCallback(() => {
    if (!editingFlowId) return;
    executeMut.mutate({ flowId: editingFlowId });
  }, [editingFlowId, executeMut]);

  // Render
  if (view === "editor" && editingFlowId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <FlowEditorScreen
          onBack={handleBack}
          onSave={handleSave}
          onPublish={handlePublish}
          onExecute={handleExecute}
          publishing={publishMut.isPending}
          executing={executeMut.isPending}
          runs={runsQuery.data as import("../components/organisms/FlowEditor/FlowRunHistory").FlowRun[] | undefined}
          runsLoading={runsQuery.isLoading}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FlowList
        flows={flowListItems}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
    </div>
  );
}
