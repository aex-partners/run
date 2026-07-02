import { useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { trpc } from "../../platform/trpc";
import { DatabaseScreen, type DatabaseEntity } from "./DatabaseScreen/DatabaseScreen";
import {
  toFields,
  makeFetchPage,
  makeCallbacks,
  type RowCache,
  type RunHexField,
} from "./goodviews/adapter";

export function DatabasePage() {
  const { t } = useTranslation();
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>();

  const entitiesQuery = trpc.entities.list.useQuery();

  // Active entity's field schema (drives the Table View's columns + editors).
  const entityDetail = trpc.entities.getById.useQuery(
    { id: activeEntityId ?? "" },
    { enabled: !!activeEntityId },
  );

  // Imperative caller + record mutations for the good-views adapter.
  const utils = trpc.useUtils();
  const updateRecord = trpc.entities.updateRecord.useMutation();
  const deleteRecord = trpc.entities.deleteRecord.useMutation();
  const createRecord = trpc.entities.createRecord.useMutation();

  // Shared cache (id -> version + full data) so inline edits can echo the CAS
  // token and merge the whole record. Reset when the active entity changes.
  const cache = useMemo<RowCache>(() => new Map(), [activeEntityId]);

  const tableFields = useMemo(
    () => toFields((entityDetail.data?.fields ?? []) as RunHexField[]),
    [entityDetail.data],
  );

  const fetchPage = useMemo(
    () =>
      activeEntityId
        ? makeFetchPage(activeEntityId, (input) => utils.entities.query.fetch(input), cache)
        : undefined,
    [activeEntityId, utils, cache],
  );

  const callbacks = useMemo(
    () =>
      activeEntityId
        ? makeCallbacks(activeEntityId, tableFields, cache, {
            update: (i) => updateRecord.mutateAsync(i),
            remove: (i) => deleteRecord.mutateAsync(i),
            create: (i) => createRecord.mutateAsync(i),
          })
        : undefined,
    [activeEntityId, tableFields, cache, updateRecord, deleteRecord, createRecord],
  );

  const createEntity = trpc.entities.createEntity.useMutation({
    onSuccess: (data) => {
      entitiesQuery.refetch();
      setActiveEntityId(data.id);
    },
  });
  const deleteEntity = trpc.entities.deleteEntity.useMutation({
    onSuccess: () => entitiesQuery.refetch(),
  });
  const renameEntity = trpc.entities.renameEntity.useMutation({
    onSuccess: () => entitiesQuery.refetch(),
  });

  const entities: DatabaseEntity[] = (entitiesQuery.data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    count: e.recordCount,
  }));

  // Auto-select first entity when loaded and none selected
  useEffect(() => {
    if (!activeEntityId && entities.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional auto-select
      setActiveEntityId(entities[0].id);
    }
  }, [activeEntityId, entities]);

  const handleDeleteEntity = (id: string) => {
    deleteEntity.mutate({ id });
    if (activeEntityId === id) {
      setActiveEntityId(undefined);
    }
  };

  const handleRenameEntity = (id: string, name: string) => {
    renameEntity.mutate({ id, name });
  };

  if (entitiesQuery.isSuccess && entities.length === 0) {
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
          <Database size={28} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
            {t('databasePage.emptyTitle')}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, maxWidth: 320 }}>
            {t('databasePage.emptyDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <DatabaseScreen
        entities={entities}
        activeEntityId={activeEntityId}
        onEntitySelect={setActiveEntityId}
        onNewEntity={() => createEntity.mutate({ name: t('databasePage.newEntityName') })}
        onRenameEntity={handleRenameEntity}
        onDeleteEntity={handleDeleteEntity}
        tableFields={tableFields}
        fetchPage={fetchPage}
        callbacks={callbacks}
      />
      {/* Feedback (copy / CSV export / save) for the good-views Table View. */}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
