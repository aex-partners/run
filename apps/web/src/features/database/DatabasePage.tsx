import { useCallback, useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import { Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { trpc } from "../../platform/trpc";
import {
  DatabaseScreen,
  type DatabaseEntity,
  type SchemaCallbacks,
} from "./DatabaseScreen/DatabaseScreen";
import {
  toFields,
  toAexType,
  makeFetchPage,
  makeCallbacks,
  type RowCache,
  type RunHexField,
  type LabelCache,
} from "./goodviews/adapter";
import type { CreateEntityPayload } from "./CreateEntityScreen/CreateEntityScreen";

export function DatabasePage() {
  const { t } = useTranslation();
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

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
  // Schema mutations (Part A): rename/retype/options + add/duplicate + remove field.
  const updateField = trpc.entities.updateField.useMutation();
  const removeField = trpc.entities.removeField.useMutation();
  const addField = trpc.entities.addField.useMutation();

  // Shared cache (id -> version + full data) so inline edits can echo the CAS
  // token and merge the whole record. Reset when the active entity changes.
  const cache = useMemo<RowCache>(() => new Map(), [activeEntityId]);
  // Relation label cache (target id -> title). Persists across pages/sorts so
  // known ids are not re-resolved. Reset when the active entity changes.
  const labelCache = useMemo<LabelCache>(() => new Map(), [activeEntityId]);

  const runHexFields = useMemo(
    () => (entityDetail.data?.fields ?? []) as RunHexField[],
    [entityDetail.data],
  );

  const tableFields = useMemo(() => toFields(runHexFields), [runHexFields]);

  const fetchPage = useMemo(
    () =>
      activeEntityId
        ? makeFetchPage(
            activeEntityId,
            (input) => utils.entities.query.fetch(input),
            cache,
            runHexFields,
            (input) => utils.entities.resolveLabels.fetch(input),
            labelCache,
          )
        : undefined,
    [activeEntityId, utils, cache, runHexFields, labelCache],
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

  // good-views field id (slug) -> run-hex field (carries the real backend field id
  // and options), for the schema-edit callbacks.
  const bySlug = useMemo(() => {
    const m = new Map<string, RunHexField>();
    for (const f of runHexFields) m.set(f.slug, f);
    return m;
  }, [runHexFields]);

  // relation field slug -> TARGET entity id, so the relation picker can list the
  // target entity's records (Part B).
  const relationTargetBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of runHexFields) {
      if ((f.type === "relation" || f.type === "relationship") && f.relationshipEntityId) {
        m.set(f.slug, f.relationshipEntityId);
      }
    }
    return m;
  }, [runHexFields]);

  // After a schema mutation: refetch the active entity's schema (getById) + the
  // page/labels/options caches, so the grid reflects the new/renamed/retyped/removed
  // column. getById invalidation cascades to tableFields -> fetchPage -> the grid.
  const invalidateSchema = useCallback(() => {
    if (activeEntityId) void utils.entities.getById.invalidate({ id: activeEntityId });
    void utils.entities.query.invalidate();
    void utils.entities.resolveLabels.invalidate();
    void utils.entities.listOptions.invalidate();
    void utils.entities.list.invalidate();
  }, [utils, activeEntityId]);

  // Relation edit picker (Part B): async loader of a relation field's TARGET entity
  // options (id + label), with server-side search. Memoized so the picker's load
  // effect stays stable; react-query caches per (target entity id, search).
  const loadRelationOptions = useMemo<
    (fieldId: string, search: string) => Promise<{ value: string; label: string }[]>
  >(
    () => (fieldId, search) => {
      const target = relationTargetBySlug.get(fieldId);
      if (!target) return Promise.resolve([]);
      return utils.entities.listOptions
        .fetch({ entityId: target, search, limit: 50 })
        .then((r) => r.options);
    },
    [relationTargetBySlug, utils],
  );

  const schema: SchemaCallbacks | undefined = activeEntityId
    ? {
        onFieldUpdate: (fieldId, updates) => {
          const f = bySlug.get(fieldId);
          if (!f) return;
          updateField.mutate(
            {
              entityId: activeEntityId,
              fieldId: f.id,
              updates: {
                ...(updates.name !== undefined ? { name: updates.name } : {}),
                ...(updates.type !== undefined ? { type: toAexType(updates.type) } : {}),
                ...(updates.required !== undefined ? { required: updates.required } : {}),
                ...(updates.options !== undefined ? { options: updates.options } : {}),
              },
            },
            { onSuccess: invalidateSchema },
          );
        },
        onFieldDelete: (fieldId) => {
          const f = bySlug.get(fieldId);
          if (!f) return;
          removeField.mutate(
            { entityId: activeEntityId, fieldId: f.id },
            { onSuccess: invalidateSchema },
          );
        },
        onFieldDuplicate: (fieldId) => {
          const f = bySlug.get(fieldId);
          if (!f) return;
          addField.mutate(
            {
              entityId: activeEntityId,
              name: `${f.name} (cópia)`,
              type: f.type,
              required: false,
              ...(f.options ? { options: f.options } : {}),
              ...(f.relationshipEntityId ? { relationshipEntityId: f.relationshipEntityId } : {}),
              ...(f.relationshipEntityName ? { relationshipEntityName: f.relationshipEntityName } : {}),
            },
            { onSuccess: invalidateSchema },
          );
        },
        onFieldAdd: ({ name, type, options }) => {
          addField.mutate(
            {
              entityId: activeEntityId,
              name,
              type: toAexType(type),
              required: false,
              ...(options ? { options } : {}),
            },
            { onSuccess: invalidateSchema },
          );
        },
        loadRelationOptions,
      }
    : undefined;

  const createEntity = trpc.entities.createEntity.useMutation({
    onSuccess: (data) => {
      entitiesQuery.refetch();
      setActiveEntityId(data.id);
      setCreating(false);
    },
  });

  // Map the dialog payload → createEntity input (good-views FieldType → AEX type
  // string; relation target id → id + name so the field carries both).
  const handleCreateEntity = (payload: CreateEntityPayload) => {
    createEntity.mutate({
      name: payload.name,
      ...(payload.description ? { description: payload.description } : {}),
      fields: payload.fields.map((f) => ({
        name: f.name,
        type: toAexType(f.type),
        required: false,
        ...(f.options ? { options: f.options } : {}),
        ...(f.relationshipEntityId
          ? {
              relationshipEntityId: f.relationshipEntityId,
              relationshipEntityName: entities.find((e) => e.id === f.relationshipEntityId)?.name,
            }
          : {}),
      })),
    });
  };
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
        onNewEntity={() => setCreating(true)}
        onRenameEntity={handleRenameEntity}
        onDeleteEntity={handleDeleteEntity}
        tableFields={tableFields}
        fetchPage={fetchPage}
        callbacks={callbacks}
        schema={schema}
        creating={creating}
        onCreateEntity={handleCreateEntity}
        onCancelCreate={() => setCreating(false)}
        createBusy={createEntity.isPending}
      />
      {/* Feedback (copy / CSV export / save) for the good-views Table View. */}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
