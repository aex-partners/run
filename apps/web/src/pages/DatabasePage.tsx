import { useState, useCallback, useEffect, useMemo } from "react";
import { Database } from "lucide-react";
import { trpc } from "../lib/trpc";
import { DatabaseScreen, type DatabaseEntity } from "../components/screens/DatabaseScreen/DatabaseScreen";
import type { GridColumn, GridRow } from "../components/organisms/DataGrid/DataGrid";
import type { EntityField as ManagePanelField } from "../components/organisms/EntityManagePanel/EntityManagePanel";
interface EntityField {
  id: string;
  name: string;
  slug: string;
  type: "text" | "number" | "email" | "phone" | "date" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
] as const;

function fieldToColumn(field: EntityField): GridColumn {
  const typeMap: Record<string, GridColumn["type"]> = {
    text: "text",
    email: "email",
    phone: "phone",
    number: "number",
    date: "date",
    select: "select",
    checkbox: "checkbox",
  };
  const col: GridColumn = { id: field.slug, label: field.name, type: typeMap[field.type] ?? "text", width: 160 };
  if (field.type === "select" && field.options) {
    col.options = field.options.map((o) => ({ value: o, label: o }));
  }
  return col;
}

export function DatabasePage() {
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<string>("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [newRecordData, setNewRecordData] = useState<Record<string, string>>({});

  // AI chat for database context
  const createContextConv = trpc.conversations.getOrCreateContext.useMutation();
  const sendAI = trpc.messages.send.useMutation();

  const handleAISend = useCallback(
    async (message: string) => {
      const result = await createContextConv.mutateAsync({ context: "Database" });
      sendAI.mutate({ conversationId: result.id, content: message });
    },
    [createContextConv, sendAI],
  );

  const entitiesQuery = trpc.entities.list.useQuery();
  const entityDetail = trpc.entities.getById.useQuery(
    { id: activeEntityId! },
    { enabled: !!activeEntityId },
  );
  const recordsQuery = trpc.entities.records.useQuery(
    { entityId: activeEntityId! },
    { enabled: !!activeEntityId },
  );

  const createEntity = trpc.entities.createEntity.useMutation({
    onSuccess: (data) => {
      entitiesQuery.refetch();
      setActiveEntityId(data.id);
    },
  });

  const createRecord = trpc.entities.createRecord.useMutation({
    onSuccess: () => {
      recordsQuery.refetch();
      entitiesQuery.refetch();
    },
  });
  const updateRecord = trpc.entities.updateRecord.useMutation({
    onSuccess: () => recordsQuery.refetch(),
  });
  const deleteRecord = trpc.entities.deleteRecord.useMutation({
    onSuccess: () => {
      recordsQuery.refetch();
      entitiesQuery.refetch();
    },
  });
  const deleteEntity = trpc.entities.deleteEntity.useMutation({
    onSuccess: () => entitiesQuery.refetch(),
  });
  const renameEntity = trpc.entities.renameEntity.useMutation({
    onSuccess: () => entitiesQuery.refetch(),
  });
  const addField = trpc.entities.addField.useMutation({
    onSuccess: () => {
      entityDetail.refetch();
      recordsQuery.refetch();
    },
  });
  const updateField = trpc.entities.updateField.useMutation({
    onSuccess: () => entityDetail.refetch(),
  });
  const removeField = trpc.entities.removeField.useMutation({
    onSuccess: () => {
      entityDetail.refetch();
      recordsQuery.refetch();
    },
  });
  const updateDescription = trpc.entities.updateDescription.useMutation({
    onSuccess: () => {
      entityDetail.refetch();
      entitiesQuery.refetch();
    },
  });

  const entities: DatabaseEntity[] = (entitiesQuery.data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    count: e.recordCount,
  }));

  // Auto-select first entity when loaded and none selected
  useEffect(() => {
    if (!activeEntityId && entities.length > 0) {
      setActiveEntityId(entities[0].id);
    }
  }, [activeEntityId, entities]);

  // Clear selected rows when switching entities
  useEffect(() => {
    setSelectedRows([]);
  }, [activeEntityId]);

  const fields: EntityField[] = entityDetail.data?.fields ?? [];
  const columns: GridColumn[] = fields.map(fieldToColumn);

  const rows: GridRow[] = (recordsQuery.data ?? []).map((r) => {
    const row: GridRow = { id: r.id };
    for (const field of fields) {
      const val = r.data[field.slug];
      row[field.slug] = val != null ? (typeof val === "number" ? val : String(val)) : "";
    }
    return row;
  });

  const handleAddRow = useCallback(() => {
    if (!activeEntityId) return;
    setNewRecordData({});
    setShowNewRecord(true);
  }, [activeEntityId]);

  const handleSubmitNewRecord = useCallback(() => {
    if (!activeEntityId) return;
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const val = newRecordData[field.slug];
      if (val === undefined || val === "") continue;
      if (field.type === "number") {
        data[field.slug] = Number(val);
      } else if (field.type === "checkbox") {
        data[field.slug] = val === "true";
      } else {
        data[field.slug] = val;
      }
    }
    createRecord.mutate({ entityId: activeEntityId, data });
    setShowNewRecord(false);
    setNewRecordData({});
  }, [activeEntityId, fields, newRecordData, createRecord]);

  const handleCellEdit = useCallback(
    (rowId: string, colId: string, value: string | number) => {
      updateRecord.mutate({ recordId: rowId, data: { [colId]: value } });
    },
    [updateRecord],
  );

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      deleteRecord.mutate({ recordId: rowId });
    },
    [deleteRecord],
  );

  const handleDeleteEntity = useCallback(
    (id: string) => {
      deleteEntity.mutate({ id });
      if (activeEntityId === id) {
        setActiveEntityId(undefined);
      }
    },
    [deleteEntity, activeEntityId],
  );

  const handleRenameEntity = useCallback(
    (id: string, name: string) => {
      renameEntity.mutate({ id, name });
    },
    [renameEntity],
  );

  const handleAddField = useCallback(() => {
    if (!activeEntityId || !newFieldName.trim()) return;
    addField.mutate({
      entityId: activeEntityId,
      name: newFieldName.trim(),
      type: newFieldType as EntityField["type"],
      required: newFieldRequired,
    });
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setShowAddField(false);
  }, [activeEntityId, newFieldName, newFieldType, newFieldRequired, addField]);

  // Map API fields to EntityManagePanel format, keyed by entity ID
  const entityManageFields = useMemo<Record<string, ManagePanelField[]>>(() => {
    if (!activeEntityId || !fields.length) return {};
    return {
      [activeEntityId]: fields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type as ManagePanelField["type"],
        required: f.required,
        options: f.options?.map((o) => ({ value: o, label: o })),
      })),
    };
  }, [activeEntityId, fields]);

  const entityDescriptions = useMemo<Record<string, string>>(() => {
    if (!activeEntityId || !entityDetail.data?.description) return {};
    return { [activeEntityId]: entityDetail.data.description };
  }, [activeEntityId, entityDetail.data?.description]);

  const handleManageAddField = useCallback(
    (entityId: string, field: Omit<ManagePanelField, "id">) => {
      addField.mutate({
        entityId,
        name: field.name,
        type: field.type as EntityField["type"],
        required: field.required ?? false,
      });
    },
    [addField],
  );

  const handleManageUpdateField = useCallback(
    (entityId: string, fieldId: string, updates: Partial<ManagePanelField>) => {
      updateField.mutate({
        entityId,
        fieldId,
        updates: {
          name: updates.name,
          type: updates.type as EntityField["type"] | undefined,
          required: updates.required,
        },
      });
    },
    [updateField],
  );

  const handleManageDeleteField = useCallback(
    (entityId: string, fieldId: string) => {
      removeField.mutate({ entityId, fieldId });
    },
    [removeField],
  );

  const handleUpdateEntityDescription = useCallback(
    (entityId: string, description: string) => {
      updateDescription.mutate({ id: entityId, description });
    },
    [updateDescription],
  );

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
            No entities yet
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, maxWidth: 320 }}>
            Create your first entity by asking the AI in the chat. Try something like "Create a Customers table with name, email, and phone fields".
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
        columns={columns}
        rows={rows}
        onEntitySelect={setActiveEntityId}
        onNewEntity={() => createEntity.mutate({ name: "New Entity" })}
        onAddRow={handleAddRow}
        onAddColumn={() => setShowAddField(true)}
        selectedRows={selectedRows}
        onSelectRow={(id, selected) => setSelectedRows(prev => selected ? [...prev, id] : prev.filter(r => r !== id))}
        onCellEdit={handleCellEdit}
        onDeleteRow={handleDeleteRow}
        onDeleteEntity={handleDeleteEntity}
        onRenameEntity={handleRenameEntity}
        onAISend={handleAISend}
        entityFields={fields}
        entityManageFields={entityManageFields}
        entityDescriptions={entityDescriptions}
        onUpdateEntityDescription={handleUpdateEntityDescription}
        onAddEntityField={handleManageAddField}
        onUpdateEntityField={handleManageUpdateField}
        onDeleteEntityField={handleManageDeleteField}
      />

      {/* Add Field Dialog */}
      {showAddField && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowAddField(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              width: 360,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>Add Field</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                  Name
                </label>
                <input
                  autoFocus
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                  placeholder="Field name"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text)",
                    background: "var(--surface-2)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                  Type
                </label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text)",
                    background: "var(--surface-2)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                Required
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setShowAddField(false)}
                  style={{
                    padding: "7px 16px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "var(--text)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddField}
                  disabled={!newFieldName.trim()}
                  style={{
                    padding: "7px 16px",
                    background: newFieldName.trim() ? "var(--accent)" : "var(--surface-2)",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: newFieldName.trim() ? "pointer" : "default",
                    fontFamily: "inherit",
                    color: newFieldName.trim() ? "#fff" : "var(--text-muted)",
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Record Dialog */}
      {showNewRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowNewRecord(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              width: 420,
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>
              New Record
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {fields.map((field, i) => (
                <div key={field.id}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                    {field.name}{field.required ? " *" : ""}
                  </label>
                  {field.type === "select" && field.options ? (
                    <select
                      value={newRecordData[field.slug] ?? ""}
                      onChange={(e) => setNewRecordData((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "var(--text)",
                        background: "var(--surface-2)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={newRecordData[field.slug] === "true"}
                        onChange={(e) => setNewRecordData((prev) => ({ ...prev, [field.slug]: String(e.target.checked) }))}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {field.name}
                    </label>
                  ) : (
                    <input
                      autoFocus={i === 0}
                      type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
                      value={newRecordData[field.slug] ?? ""}
                      onChange={(e) => setNewRecordData((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmitNewRecord()}
                      placeholder={field.name}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "var(--text)",
                        background: "var(--surface-2)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setShowNewRecord(false)}
                  style={{
                    padding: "7px 16px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "var(--text)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNewRecord}
                  style={{
                    padding: "7px 16px",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "#fff",
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
