import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Database, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
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

  // Navigation state lives in the URL so it is deep-linkable and survives
  // reload/back-forward: `?entity=<id>` = active entity, `?new=1` = the
  // entity-creation screen. Other params (?tab, ?tabs, ?c) are preserved.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeEntityId = searchParams.get("entity") ?? undefined;
  const creating = searchParams.get("new") === "1";
  const setActiveEntityId = useCallback(
    (id?: string, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("entity", id);
          else next.delete("entity");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );
  const setCreating = useCallback(
    (v: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set("new", "1");
        else next.delete("new");
        return next;
      });
    },
    [setSearchParams],
  );

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

  // Bumped on a failed mutation to force `fetchPage` to a new identity, so the
  // Table View re-runs its fetch effect and reconciles the optimistic grid with
  // the server truth (paired with invalidating the query cache below).
  const [reloadToken, setReloadToken] = useState(0);

  // Mutation failure feedback: a clear PT toast + invalidate the affected caches
  // and bump the reload token so the grid refetches (undoing the optimistic edit/
  // delete/create). Threaded into the adapter's makeCallbacks as `onError`.
  const handleMutationError = useCallback(
    (message: string) => {
      toast.error(message);
      void utils.entities.query.invalidate();
      void utils.entities.resolveLabels.invalidate();
      setReloadToken((t) => t + 1);
    },
    [utils],
  );

  const runHexFields = useMemo(
    () => (entityDetail.data?.fields ?? []) as RunHexField[],
    [entityDetail.data],
  );

  // Workspace users for the Person field: any authenticated user may list peers.
  // Fed into toFields so `person` (and created_by/updated_by) become a user picker
  // (avatar + name), storing the user id.
  const assignableUsers = trpc.users.listAssignable.useQuery();
  const personOptions = useMemo(
    () =>
      (assignableUsers.data ?? []).map((u) => ({
        value: u.id,
        label: u.name,
        image: u.image ?? undefined,
      })),
    [assignableUsers.data],
  );

  const tableFields = useMemo(() => {
    const fields = toFields(runHexFields, personOptions);
    // Máscara por campo-irmão (config web-only por entidade): em Meios de Contato,
    // `valor` mascara conforme `tipo` (Telefone/Celular/WhatsApp -> phone, Email -> email).
    if (entityDetail.data?.slug === "meios_de_contato") {
      const valor = fields.find((f) => f.id === "valor");
      if (valor) {
        valor.formatByField = "tipo";
        valor.formatMap = { Telefone: "phone", Celular: "phone", WhatsApp: "phone", Email: "email" };
      }
    }
    return fields;
  }, [runHexFields, personOptions, entityDetail.data?.slug]);

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
            // números do rodapé em SQL (sem teto) + resolução de campos lookup
            (input) => utils.entities.aggregate.fetch(input),
            (input) => utils.entities.resolveFieldValues.fetch(input),
          )
        : undefined,
    // reloadToken força nova identidade após falha de mutation -> a grade refaz o fetch
    [activeEntityId, utils, cache, runHexFields, labelCache, reloadToken],
  );

  const callbacks = useMemo(
    () =>
      activeEntityId
        ? makeCallbacks(
            activeEntityId,
            tableFields,
            cache,
            {
              update: (i) => updateRecord.mutateAsync(i),
              remove: (i) => deleteRecord.mutateAsync(i),
              create: (i) => createRecord.mutateAsync(i),
            },
            { onError: handleMutationError },
          )
        : undefined,
    [activeEntityId, tableFields, cache, updateRecord, deleteRecord, createRecord, handleMutationError],
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

  // Field-editor loader: the fields of ANOTHER entity (id/slug/name/type) for the
  // popover's "Campo a exibir" (relation label) and "Campo a puxar" (lookup) selects.
  const loadEntityFields = useMemo<
    (entityId: string) => Promise<{ id: string; slug: string; name: string; type: string }[]>
  >(
    () => (entityId) =>
      utils.entities.getById
        .fetch({ id: entityId })
        .then((e) =>
          (e?.fields ?? []).map((f) => ({ id: f.id, slug: f.slug, name: f.name, type: f.type })),
        ),
    [utils],
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
                // relation: target id (+ name resolved from the entity list) + label + multi
                ...(updates.relationshipEntityId !== undefined
                  ? {
                      relationshipEntityId: updates.relationshipEntityId,
                      relationshipEntityName: entities.find((e) => e.id === updates.relationshipEntityId)?.name,
                    }
                  : {}),
                ...(updates.labelFieldId !== undefined ? { labelFieldId: updates.labelFieldId } : {}),
                ...(updates.multiple !== undefined ? { multiple: updates.multiple } : {}),
                // lookup: via relation + field to pull
                ...(updates.viaFieldId !== undefined ? { viaFieldId: updates.viaFieldId } : {}),
                ...(updates.lookupFieldId !== undefined ? { lookupFieldId: updates.lookupFieldId } : {}),
                // rating / currency
                ...(updates.maxRating !== undefined ? { maxRating: updates.maxRating } : {}),
                ...(updates.currencyCode !== undefined ? { currencyCode: updates.currencyCode } : {}),
                // valor padrão (seletor: choice / relação)
                ...(updates.defaultValue !== undefined ? { defaultValue: updates.defaultValue } : {}),
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
        onFieldAdd: (spec) => {
          addField.mutate(
            {
              entityId: activeEntityId,
              name: spec.name,
              type: toAexType(spec.type),
              required: spec.required ?? false,
              ...(spec.options ? { options: spec.options } : {}),
              ...(spec.defaultValue ? { defaultValue: spec.defaultValue } : {}),
              ...(spec.relationshipEntityId
                ? {
                    relationshipEntityId: spec.relationshipEntityId,
                    relationshipEntityName: entities.find((e) => e.id === spec.relationshipEntityId)?.name,
                  }
                : {}),
              ...(spec.labelFieldId ? { labelFieldId: spec.labelFieldId } : {}),
              ...(spec.multiple ? { multiple: spec.multiple } : {}),
              ...(spec.viaFieldId ? { viaFieldId: spec.viaFieldId } : {}),
              ...(spec.lookupFieldId ? { lookupFieldId: spec.lookupFieldId } : {}),
              ...(spec.maxRating !== undefined ? { maxRating: spec.maxRating } : {}),
              ...(spec.currencyCode ? { currencyCode: spec.currencyCode } : {}),
            },
            { onSuccess: invalidateSchema },
          );
        },
        loadRelationOptions,
        loadEntityFields,
      }
    : undefined;

  const createEntity = trpc.entities.createEntity.useMutation({
    onSuccess: (data) => {
      entitiesQuery.refetch();
      // Atomic URL update: select the new entity + leave the creation screen.
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("entity", data.id);
        next.delete("new");
        return next;
      });
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
        required: f.required ?? false,
        ...(f.options ? { options: f.options } : {}),
        ...(f.defaultValue ? { defaultValue: f.defaultValue } : {}),
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

  // Auto-select first entity when loaded and none selected (replace: no history
  // entry for the default pick).
  useEffect(() => {
    if (!activeEntityId && entities.length > 0) {
      setActiveEntityId(entities[0].id, true);
    }
  }, [activeEntityId, entities, setActiveEntityId]);

  const handleDeleteEntity = (id: string) => {
    deleteEntity.mutate({ id });
    if (activeEntityId === id) {
      setActiveEntityId(undefined);
    }
  };

  const handleRenameEntity = (id: string, name: string) => {
    renameEntity.mutate({ id, name });
  };

  // No entities yet (and not mid-creation): a centered empty state WITH a create
  // button. When `creating`, fall through to the normal render so the creation
  // screen shows (the sidebar just lists zero entities).
  if (entitiesQuery.isSuccess && entities.length === 0 && !creating) {
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
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <Plus size={15} /> Nova entidade
        </button>
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
