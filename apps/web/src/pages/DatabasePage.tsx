import { useState, useCallback, useEffect, useMemo } from "react";
import { Database } from "lucide-react";
import { trpc } from "../lib/trpc";
import { DatabaseScreen, type DatabaseEntity } from "../components/screens/DatabaseScreen/DatabaseScreen";
import type { GridColumn, GridRow } from "../components/organisms/DataGrid/DataGrid";
import type { EntityField as ManagePanelField } from "../components/organisms/EntityManagePanel/EntityManagePanel";
import type { EntityFieldType as SharedFieldType } from "@aex/shared";

// The backend EntityField shape (from tRPC response)
interface EntityField {
  id: string;
  name: string;
  slug: string;
  type: SharedFieldType;
  required: boolean;
  unique?: boolean;
  description?: string;
  options?: { value: string; label: string; color?: string }[];
  formula?: string;
  relationshipEntityId?: string;
  relationshipEntityName?: string;
  lookupFieldId?: string;
  rollupFunction?: string;
  currencyCode?: string;
  aiPrompt?: string;
  maxRating?: number;
  decimalPlaces?: number;
}

// Grouped field type options for the add-field dialog
const FIELD_TYPE_GROUPS: { label: string; types: { value: string; label: string }[] }[] = [
  { label: "Basic", types: [
    { value: "text", label: "Text" },
    { value: "long_text", label: "Long Text" },
    { value: "rich_text", label: "Rich Text" },
    { value: "number", label: "Number" },
    { value: "decimal", label: "Decimal" },
    { value: "checkbox", label: "Checkbox" },
  ]},
  { label: "Date & Time", types: [
    { value: "date", label: "Date" },
    { value: "datetime", label: "Date & Time" },
    { value: "duration", label: "Duration" },
  ]},
  { label: "Selection", types: [
    { value: "select", label: "Select" },
    { value: "multiselect", label: "Multi-select" },
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
    { value: "rating", label: "Rating" },
  ]},
  { label: "Numeric", types: [
    { value: "currency", label: "Currency" },
    { value: "percent", label: "Percent" },
    { value: "autonumber", label: "Auto Number" },
  ]},
  { label: "Contact", types: [
    { value: "email", label: "Email" },
    { value: "url", label: "URL" },
    { value: "phone", label: "Phone" },
    { value: "person", label: "Person" },
  ]},
  { label: "Relational", types: [
    { value: "relationship", label: "Relationship" },
    { value: "lookup", label: "Lookup" },
    { value: "rollup", label: "Rollup" },
  ]},
  { label: "Computed", types: [
    { value: "formula", label: "Formula" },
    { value: "ai", label: "AI" },
  ]},
  { label: "Other", types: [
    { value: "attachment", label: "Attachment" },
    { value: "json", label: "JSON" },
    { value: "barcode", label: "Barcode" },
  ]},
  { label: "System", types: [
    { value: "created_at", label: "Created At" },
    { value: "updated_at", label: "Updated At" },
    { value: "created_by", label: "Created By" },
    { value: "updated_by", label: "Updated By" },
  ]},
];

/** Map a backend EntityField to a DataGrid GridColumn with full metadata */
function fieldToColumn(field: EntityField): GridColumn {
  const col: GridColumn = {
    id: field.slug,
    label: field.name,
    type: field.type as GridColumn["type"],
    width: 160,
  };

  // Pass through metadata
  if (field.options && field.options.length > 0) {
    col.options = field.options;
  }
  if (field.currencyCode) col.currencyCode = field.currencyCode;
  if (field.aiPrompt) col.aiPrompt = field.aiPrompt;
  if (field.relationshipEntityId) col.relationshipEntityId = field.relationshipEntityId;
  if (field.maxRating) col.maxRating = field.maxRating;
  if (field.decimalPlaces !== undefined) col.decimalPlaces = field.decimalPlaces;
  if (field.formula) col.formula = field.formula;
  if (field.rollupFunction) col.rollupFunction = field.rollupFunction;
  if (field.lookupFieldId) col.lookupFieldId = field.lookupFieldId;

  // Set sensible widths per type
  switch (field.type) {
    case "checkbox": col.width = 60; break;
    case "autonumber": col.width = 80; break;
    case "rating": col.width = 120; break;
    case "percent": col.width = 100; break;
    case "number": case "decimal": col.width = 120; break;
    case "currency": col.width = 130; break;
    case "date": col.width = 130; break;
    case "datetime": col.width = 180; break;
    case "email": case "url": col.width = 200; break;
    case "long_text": case "rich_text": col.width = 220; break;
    case "multiselect": col.width = 200; break;
    case "ai": col.width = 200; break;
    case "json": col.width = 200; break;
    case "created_at": case "updated_at": col.width = 160; break;
  }

  return col;
}

/** Map a backend EntityField to EntityManagePanel format */
function fieldToManagePanel(field: EntityField): ManagePanelField {
  return {
    id: field.id,
    name: field.name,
    type: field.type as ManagePanelField["type"],
    description: field.description,
    required: field.required,
    unique: field.unique,
    options: field.options,
    formula: field.formula,
    relationshipEntityId: field.relationshipEntityId,
    relationshipEntityName: field.relationshipEntityName,
    lookupFieldId: field.lookupFieldId,
    rollupFunction: field.rollupFunction as ManagePanelField["rollupFunction"],
    currencyCode: field.currencyCode,
    aiPrompt: field.aiPrompt,
    maxRating: field.maxRating,
    decimalPlaces: field.decimalPlaces,
  };
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

  // Fetch workspace users for person fields
  const usersQuery = trpc.users.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
  const workspaceUsers = useMemo(
    () => (usersQuery.data ?? []).map((u) => ({ id: u.id, name: u.name, avatar: undefined as string | undefined })),
    [usersQuery.data],
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
  const generateFieldValue = trpc.entities.generateFieldValue.useMutation({
    onSuccess: () => recordsQuery.refetch(),
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
      if (val === null || val === undefined) {
        row[field.slug] = "";
      } else if (typeof val === "boolean") {
        row[field.slug] = val;
      } else if (typeof val === "number") {
        row[field.slug] = val;
      } else {
        row[field.slug] = String(val);
      }
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
      if (field.type === "number" || field.type === "decimal" || field.type === "currency" || field.type === "percent" || field.type === "duration") {
        data[field.slug] = Number(val);
      } else if (field.type === "checkbox") {
        data[field.slug] = val === "true";
      } else if (field.type === "rating") {
        data[field.slug] = Number(val);
      } else {
        data[field.slug] = val;
      }
    }
    createRecord.mutate({ entityId: activeEntityId, data });
    setShowNewRecord(false);
    setNewRecordData({});
  }, [activeEntityId, fields, newRecordData, createRecord]);

  const handleCellEdit = useCallback(
    (rowId: string, colId: string, value: string | number | boolean) => {
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
      type: newFieldType as SharedFieldType,
      required: newFieldRequired,
    });
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setShowAddField(false);
  }, [activeEntityId, newFieldName, newFieldType, newFieldRequired, addField]);

  // Map API fields to EntityManagePanel format
  const entityManageFields = useMemo<Record<string, ManagePanelField[]>>(() => {
    if (!activeEntityId || !fields.length) return {};
    return { [activeEntityId]: fields.map(fieldToManagePanel) };
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
        type: field.type as SharedFieldType,
        required: field.required ?? false,
        options: field.options,
        formula: field.formula,
        relationshipEntityId: field.relationshipEntityId,
        relationshipEntityName: field.relationshipEntityName,
        lookupFieldId: field.lookupFieldId,
        rollupFunction: field.rollupFunction,
        currencyCode: field.currencyCode,
        aiPrompt: field.aiPrompt,
        maxRating: field.maxRating,
        decimalPlaces: field.decimalPlaces,
        description: field.description,
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
          type: updates.type as SharedFieldType | undefined,
          required: updates.required,
          description: updates.description,
          options: updates.options,
          formula: updates.formula,
          relationshipEntityId: updates.relationshipEntityId,
          relationshipEntityName: updates.relationshipEntityName,
          lookupFieldId: updates.lookupFieldId,
          rollupFunction: updates.rollupFunction,
          currencyCode: updates.currencyCode,
          aiPrompt: updates.aiPrompt,
          maxRating: updates.maxRating,
          decimalPlaces: updates.decimalPlaces,
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

  // Relationship picker: search records of a related entity
  const trpcUtils = trpc.useUtils();
  const handleFetchRelationshipRecords = useCallback(
    async (entityId: string, search: string): Promise<{ id: string; label: string }[]> => {
      try {
        return await trpcUtils.entities.searchRecords.fetch({ entityId, search, limit: 20 });
      } catch {
        return [];
      }
    },
    [trpcUtils],
  );

  // AI field generation callback
  const handleAIGenerate = useCallback(
    async (rowId: string, colId: string, prompt: string): Promise<string> => {
      if (!activeEntityId) return "";
      const field = fields.find((f) => f.slug === colId);
      if (!field) return "";
      const result = await generateFieldValue.mutateAsync({
        entityId: activeEntityId,
        recordId: rowId,
        fieldId: field.id,
        prompt: prompt || `Generate a value for the "${field.name}" field`,
      });
      return result.value;
    },
    [activeEntityId, fields, generateFieldValue],
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
        onFetchRelationshipRecords={handleFetchRelationshipRecords}
        workspaceUsers={workspaceUsers}
        onAIGenerate={handleAIGenerate}
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
                  {FIELD_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
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
              {fields
                .filter((f) => !["created_at", "updated_at", "created_by", "updated_by", "autonumber", "formula", "lookup", "rollup"].includes(f.type))
                .map((field, i) => (
                <div key={field.id}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                    {field.name}{field.required ? " *" : ""}
                  </label>
                  {(field.type === "select" || field.type === "status" || field.type === "priority") && field.options ? (
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
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                  ) : field.type === "long_text" || field.type === "rich_text" ? (
                    <textarea
                      rows={3}
                      value={newRecordData[field.slug] ?? ""}
                      onChange={(e) => setNewRecordData((prev) => ({ ...prev, [field.slug]: e.target.value }))}
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
                        resize: "vertical",
                      }}
                    />
                  ) : (
                    <input
                      autoFocus={i === 0}
                      type={
                        field.type === "number" || field.type === "decimal" || field.type === "currency" || field.type === "percent" || field.type === "rating"
                          ? "number"
                          : field.type === "email" ? "email"
                          : field.type === "date" ? "date"
                          : field.type === "datetime" ? "datetime-local"
                          : field.type === "url" ? "url"
                          : field.type === "phone" ? "tel"
                          : "text"
                      }
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
