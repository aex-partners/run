import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Database, Type, AlignLeft, FileText, Hash, ToggleLeft,
  Calendar, Clock, Timer, List, ListChecks, CircleDot, Flag, Star,
  DollarSign, Percent, ListOrdered, Mail, Globe, Phone, User,
  Link2, ArrowUpRight, BarChart3, FunctionSquare, Sparkles,
  Paperclip, Braces, Barcode, CalendarPlus, CalendarClock, UserPlus, UserCheck,
  Search, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "../lib/trpc";
import { DatabaseScreen, type DatabaseEntity } from "../components/screens/DatabaseScreen/DatabaseScreen";
import type { GridColumn, GridRow } from "../components/organisms/DataGrid/DataGrid";
import type { EntityField as ManagePanelField, EntityRelationship, EntityVersion } from "../components/organisms/EntityManagePanel/EntityManagePanel";
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

// Field type metadata with Portuguese labels, icons, and examples
interface FieldTypeInfo {
  value: string;
  label: string;
  icon: LucideIcon;
  example: string;
}

interface FieldTypeGroup {
  label: string;
  types: FieldTypeInfo[];
}

const FIELD_TYPE_GROUPS: FieldTypeGroup[] = [
  { label: "Basico", types: [
    { value: "text", label: "Texto", icon: Type, example: "Nome, titulo, codigo" },
    { value: "long_text", label: "Texto longo", icon: AlignLeft, example: "Descricao, observacoes" },
    { value: "rich_text", label: "Texto formatado", icon: FileText, example: "Conteudo com formatacao" },
    { value: "number", label: "Numero", icon: Hash, example: "42, 1500, -7" },
    { value: "decimal", label: "Decimal", icon: Hash, example: "3.14, 99.99" },
    { value: "checkbox", label: "Checkbox", icon: ToggleLeft, example: "Sim / Nao" },
  ]},
  { label: "Data e Hora", types: [
    { value: "date", label: "Data", icon: Calendar, example: "15/03/2026" },
    { value: "datetime", label: "Data e hora", icon: Clock, example: "15/03/2026 14:30" },
    { value: "duration", label: "Duracao", icon: Timer, example: "2h 30min" },
  ]},
  { label: "Selecao", types: [
    { value: "select", label: "Selecao unica", icon: List, example: "Categoria, tipo" },
    { value: "multiselect", label: "Selecao multipla", icon: ListChecks, example: "Tags, habilidades" },
    { value: "status", label: "Status", icon: CircleDot, example: "Ativo, Pendente, Concluido" },
    { value: "priority", label: "Prioridade", icon: Flag, example: "Alta, Media, Baixa" },
    { value: "rating", label: "Avaliacao", icon: Star, example: "1 a 5 estrelas" },
  ]},
  { label: "Numerico", types: [
    { value: "currency", label: "Moeda", icon: DollarSign, example: "R$ 1.500,00" },
    { value: "percent", label: "Porcentagem", icon: Percent, example: "85%" },
    { value: "autonumber", label: "Numero automatico", icon: ListOrdered, example: "#001, #002, #003" },
  ]},
  { label: "Contato", types: [
    { value: "email", label: "Email", icon: Mail, example: "nome@empresa.com" },
    { value: "url", label: "URL", icon: Globe, example: "https://site.com.br" },
    { value: "phone", label: "Telefone", icon: Phone, example: "(11) 99999-0000" },
    { value: "person", label: "Pessoa", icon: User, example: "Usuario do workspace" },
  ]},
  { label: "Relacional", types: [
    { value: "relationship", label: "Relacionamento", icon: Link2, example: "Vincula a outra tabela" },
    { value: "lookup", label: "Lookup", icon: ArrowUpRight, example: "Campo de tabela vinculada" },
    { value: "rollup", label: "Rollup", icon: BarChart3, example: "Soma, media, contagem" },
  ]},
  { label: "Computado", types: [
    { value: "formula", label: "Formula", icon: FunctionSquare, example: "{preco} * {quantidade}" },
    { value: "ai", label: "IA", icon: Sparkles, example: "Gera conteudo via prompt" },
  ]},
  { label: "Outros", types: [
    { value: "attachment", label: "Anexo", icon: Paperclip, example: "Arquivos e imagens" },
    { value: "json", label: "JSON", icon: Braces, example: '{ "chave": "valor" }' },
    { value: "barcode", label: "Codigo de barras", icon: Barcode, example: "7891234567890" },
  ]},
  { label: "Sistema", types: [
    { value: "created_at", label: "Criado em", icon: CalendarPlus, example: "Data de criacao automatica" },
    { value: "updated_at", label: "Atualizado em", icon: CalendarClock, example: "Data de atualizacao automatica" },
    { value: "created_by", label: "Criado por", icon: UserPlus, example: "Autor do registro" },
    { value: "updated_by", label: "Atualizado por", icon: UserCheck, example: "Ultimo editor" },
  ]},
];

// Flat list for lookup
const ALL_FIELD_TYPES = FIELD_TYPE_GROUPS.flatMap(g => g.types);
function getFieldTypeInfo(value: string): FieldTypeInfo | undefined {
  return ALL_FIELD_TYPES.find(t => t.value === value);
}

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

  // Inline new row state (Issue #16)
  const [inlineNewRowActive, setInlineNewRowActive] = useState(false);
  const [inlineNewRowValues, setInlineNewRowValues] = useState<Record<string, string>>({});

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional auto-select
      setActiveEntityId(entities[0].id);
    }
  }, [activeEntityId, entities]);

  // Clear selected rows when switching entities
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on entity change
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

  const entityManageRelationships = useMemo<Record<string, EntityRelationship[]>>(() => {
    if (!activeEntityId || !fields.length) return {};

    const relationships: EntityRelationship[] = [];
    const entityName = entities.find(e => e.id === activeEntityId)?.name ?? "";

    for (const field of fields) {
      if (field.type === "relationship" && field.relationshipEntityName) {
        relationships.push({
          id: field.id,
          name: field.name,
          type: "one_to_many",
          sourceEntityId: activeEntityId,
          sourceEntityName: entityName,
          sourceFieldId: field.id,
          sourceFieldName: field.name,
          targetEntityId: field.relationshipEntityId ?? "",
          targetEntityName: field.relationshipEntityName,
        });
      }
      if (field.type === "lookup" && field.relationshipEntityName) {
        relationships.push({
          id: field.id,
          name: `${field.name} (lookup)`,
          type: "one_to_many",
          sourceEntityId: activeEntityId,
          sourceEntityName: entityName,
          sourceFieldId: field.id,
          sourceFieldName: field.name,
          targetEntityId: field.relationshipEntityId ?? "",
          targetEntityName: field.relationshipEntityName,
        });
      }
      if (field.type === "rollup" && field.relationshipEntityName) {
        relationships.push({
          id: field.id,
          name: `${field.name} (rollup)`,
          type: "one_to_many",
          sourceEntityId: activeEntityId,
          sourceEntityName: entityName,
          sourceFieldId: field.id,
          sourceFieldName: field.name,
          targetEntityId: field.relationshipEntityId ?? "",
          targetEntityName: field.relationshipEntityName,
        });
      }
    }

    return { [activeEntityId]: relationships };
  }, [activeEntityId, fields, entities]);

  const entityManageVersions = useMemo<Record<string, EntityVersion[]>>(() => {
    if (!activeEntityId || !entityDetail.data) return {};

    const entity = entityDetail.data;
    const versions: EntityVersion[] = [
      {
        id: "v1",
        version: 1,
        createdAt: entity.createdAt ? new Date(entity.createdAt).toLocaleDateString("pt-BR") : "Data desconhecida",
        createdBy: "Sistema",
        changes: "Schema inicial criado",
        fieldCount: fields.length,
      },
    ];

    return { [activeEntityId]: versions };
  }, [activeEntityId, entityDetail.data, fields.length]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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

  // Issue #10: Column rename callback
  const handleColumnRename = useCallback(
    (colId: string, newLabel: string) => {
      if (!activeEntityId || !newLabel) return;
      const field = fields.find((f) => f.slug === colId);
      if (!field) return;
      updateField.mutate({
        entityId: activeEntityId,
        fieldId: field.id,
        updates: { name: newLabel },
      });
    },
    [activeEntityId, fields, updateField],
  );

  // Issue #10: Column delete callback
  const handleColumnDelete = useCallback(
    (colId: string) => {
      if (!activeEntityId) return;
      const field = fields.find((f) => f.slug === colId);
      if (!field) return;
      const confirmed = window.confirm(`Delete column "${field.name}"? This cannot be undone.`);
      if (!confirmed) return;
      removeField.mutate({ entityId: activeEntityId, fieldId: field.id });
    },
    [activeEntityId, fields, removeField],
  );

  // Issue #10: Column insert callback (opens AddField dialog)
  const handleColumnInsert = useCallback(
    (_position: 'left' | 'right', _referenceColId: string) => {
      setShowAddField(true);
    },
    [],
  );

  // Issue #16: Inline new row commit
  const handleInlineNewRowCommit = useCallback(() => {
    if (!activeEntityId) return;
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const val = inlineNewRowValues[field.slug];
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
    if (Object.keys(data).length > 0) {
      createRecord.mutate({ entityId: activeEntityId, data });
    }
    setInlineNewRowActive(false);
    setInlineNewRowValues({});
  }, [activeEntityId, fields, inlineNewRowValues, createRecord]);

  const inlineNewRow = useMemo(() => ({
    isActive: inlineNewRowActive,
    values: inlineNewRowValues,
    onStart: () => setInlineNewRowActive(true),
    onValueChange: (colId: string, value: string) =>
      setInlineNewRowValues((prev) => ({ ...prev, [colId]: value })),
    onCommit: handleInlineNewRowCommit,
    onCancel: () => {
      setInlineNewRowActive(false);
      setInlineNewRowValues({});
    },
  }), [inlineNewRowActive, inlineNewRowValues, handleInlineNewRowCommit]);

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
        entityManageRelationships={entityManageRelationships}
        entityManageVersions={entityManageVersions}
        entityDescriptions={entityDescriptions}
        onUpdateEntityDescription={handleUpdateEntityDescription}
        onAddEntityField={handleManageAddField}
        onUpdateEntityField={handleManageUpdateField}
        onDeleteEntityField={handleManageDeleteField}
        onColumnRename={handleColumnRename}
        onColumnDelete={handleColumnDelete}
        onColumnInsert={handleColumnInsert}
        inlineNewRow={inlineNewRow}
        onFetchRelationshipRecords={handleFetchRelationshipRecords}
        workspaceUsers={workspaceUsers}
        onAIGenerate={handleAIGenerate}
      />

      {/* Add Field Dialog */}
      {showAddField && (
        <AddFieldDialog
          fieldName={newFieldName}
          fieldType={newFieldType}
          fieldRequired={newFieldRequired}
          onFieldNameChange={setNewFieldName}
          onFieldTypeChange={setNewFieldType}
          onFieldRequiredChange={setNewFieldRequired}
          onSubmit={handleAddField}
          onClose={() => setShowAddField(false)}
        />
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

// ─── Add Field Dialog with searchable type picker ────────────────────────────

interface AddFieldDialogProps {
  fieldName: string;
  fieldType: string;
  fieldRequired: boolean;
  onFieldNameChange: (v: string) => void;
  onFieldTypeChange: (v: string) => void;
  onFieldRequiredChange: (v: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function AddFieldDialog({
  fieldName, fieldType, fieldRequired,
  onFieldNameChange, onFieldTypeChange, onFieldRequiredChange,
  onSubmit, onClose,
}: AddFieldDialogProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedInfo = getFieldTypeInfo(fieldType);
  const SelectedIcon = selectedInfo?.icon ?? Type;

  // Close picker on click outside
  useEffect(() => {
    if (!typePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setTypePickerOpen(false);
        setTypeSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [typePickerOpen]);

  // Focus search when picker opens
  useEffect(() => {
    if (typePickerOpen) searchRef.current?.focus();
  }, [typePickerOpen]);

  const searchLower = typeSearch.toLowerCase();
  const filteredGroups = FIELD_TYPE_GROUPS
    .map(g => ({
      ...g,
      types: g.types.filter(t =>
        t.label.toLowerCase().includes(searchLower) ||
        t.example.toLowerCase().includes(searchLower) ||
        t.value.includes(searchLower)
      ),
    }))
    .filter(g => g.types.length > 0);

  const inputStyle: React.CSSProperties = {
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
  };

  return (
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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          width: 400,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
          Novo campo
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Field name */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>
              Nome do campo
            </label>
            <input
              autoFocus
              value={fieldName}
              onChange={(e) => onFieldNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              placeholder="Ex: Nome do cliente, Valor total..."
              style={inputStyle}
            />
          </div>

          {/* Field type picker */}
          <div style={{ position: "relative" }} ref={pickerRef}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>
              Tipo de campo
            </label>
            <button
              type="button"
              onClick={() => setTypePickerOpen(!typePickerOpen)}
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                textAlign: "left",
                background: "var(--surface-2)",
              }}
            >
              <SelectedIcon size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{selectedInfo?.label ?? fieldType}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{selectedInfo?.example}</span>
              <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </button>

            {/* Dropdown picker */}
            {typePickerOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                  zIndex: 100,
                  maxHeight: 360,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* Search */}
                <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", borderRadius: 6, padding: "6px 8px" }}>
                    <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      placeholder="Buscar tipo de campo..."
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "var(--text)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Results */}
                <div style={{ overflowY: "auto", padding: "4px 0" }}>
                  {filteredGroups.length === 0 && (
                    <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                      Nenhum tipo encontrado
                    </div>
                  )}
                  {filteredGroups.map((group) => (
                    <div key={group.label}>
                      <div style={{
                        padding: "6px 12px 2px",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}>
                        {group.label}
                      </div>
                      {group.types.map((t) => {
                        const Icon = t.icon;
                        const isSelected = t.value === fieldType;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              onFieldTypeChange(t.value);
                              setTypePickerOpen(false);
                              setTypeSearch("");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: "7px 12px",
                              border: "none",
                              background: isSelected ? "var(--accent-light)" : "transparent",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left",
                              borderRadius: 0,
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = "var(--surface-2)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isSelected ? "var(--accent-light)" : "transparent";
                            }}
                          >
                            <Icon size={15} style={{ color: isSelected ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: isSelected ? "var(--accent)" : "var(--text)", fontWeight: isSelected ? 500 : 400 }}>
                                {t.label}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                              {t.example}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Required */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={fieldRequired}
              onChange={(e) => onFieldRequiredChange(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Obrigatorio
          </label>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
            <button
              onClick={onClose}
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
              Cancelar
            </button>
            <button
              onClick={onSubmit}
              disabled={!fieldName.trim()}
              style={{
                padding: "7px 16px",
                background: fieldName.trim() ? "var(--accent)" : "var(--surface-2)",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: fieldName.trim() ? "pointer" : "default",
                fontFamily: "inherit",
                color: fieldName.trim() ? "#fff" : "var(--text-muted)",
              }}
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
