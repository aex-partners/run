import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Link2,
  History,
  Table2,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  ArrowRight,
} from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

// ─── Field type definitions ─────────────────────────────────────────────────

export type EntityFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'status'
  | 'priority'
  | 'email'
  | 'url'
  | 'phone'
  | 'person'
  | 'relationship'
  | 'lookup'
  | 'rollup'
  | 'formula'
  | 'autonumber'
  | 'attachment'
  | 'rating'
  | 'duration'
  | 'json'
  | 'rich_text'
  | 'barcode'
  | 'created_at'
  | 'updated_at'
  | 'created_by'
  | 'updated_by'
  | 'ai'

export const FIELD_TYPE_LABELS: Record<EntityFieldType, string> = {
  text: 'Text',
  long_text: 'Long Text',
  number: 'Number',
  decimal: 'Decimal',
  currency: 'Currency',
  percent: 'Percent',
  date: 'Date',
  datetime: 'Date & Time',
  checkbox: 'Checkbox',
  select: 'Select',
  multiselect: 'Multi-select',
  status: 'Status',
  priority: 'Priority',
  email: 'Email',
  url: 'URL',
  phone: 'Phone',
  person: 'Person',
  relationship: 'Relationship',
  lookup: 'Lookup',
  rollup: 'Rollup',
  formula: 'Formula',
  autonumber: 'Auto Number',
  attachment: 'Attachment',
  rating: 'Rating',
  duration: 'Duration',
  json: 'JSON',
  rich_text: 'Rich Text',
  barcode: 'Barcode',
  created_at: 'Created At',
  updated_at: 'Updated At',
  created_by: 'Created By',
  updated_by: 'Updated By',
  ai: 'AI',
}

const FIELD_TYPE_GROUPS: { label: string; types: EntityFieldType[] }[] = [
  { label: 'Basic', types: ['text', 'long_text', 'rich_text', 'number', 'decimal', 'checkbox'] },
  { label: 'Date & Time', types: ['date', 'datetime', 'duration'] },
  { label: 'Selection', types: ['select', 'multiselect', 'status', 'priority', 'rating'] },
  { label: 'Numeric', types: ['currency', 'percent', 'autonumber'] },
  { label: 'Contact', types: ['email', 'url', 'phone', 'person'] },
  { label: 'Relational', types: ['relationship', 'lookup', 'rollup'] },
  { label: 'Computed', types: ['formula', 'ai'] },
  { label: 'Other', types: ['attachment', 'json', 'barcode'] },
  { label: 'System', types: ['created_at', 'updated_at', 'created_by', 'updated_by'] },
]

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface EntityField {
  id: string
  name: string
  type: EntityFieldType
  description?: string
  required?: boolean
  unique?: boolean
  defaultValue?: string
  formula?: string
  relationshipEntityId?: string
  relationshipEntityName?: string
  lookupFieldId?: string
  rollupFunction?: 'count' | 'sum' | 'avg' | 'min' | 'max'
  options?: { value: string; label: string; color?: string }[]
  currencyCode?: string
  aiPrompt?: string
  maxRating?: number
  decimalPlaces?: number
}

export interface EntityRelationship {
  id: string
  name: string
  type: 'one_to_one' | 'one_to_many' | 'many_to_many'
  sourceEntityId: string
  sourceEntityName: string
  sourceFieldId: string
  sourceFieldName: string
  targetEntityId: string
  targetEntityName: string
  targetFieldId?: string
  targetFieldName?: string
}

export interface EntityVersion {
  id: string
  version: number
  createdAt: string
  createdBy: string
  changes: string
  fieldCount: number
}

export interface EntityManagePanelProps {
  entityId: string
  entityName: string
  entityDescription?: string
  fields: EntityField[]
  relationships?: EntityRelationship[]
  versions?: EntityVersion[]
  availableEntities?: { id: string; name: string; fields?: { id: string; name: string }[] }[]
  onBack?: () => void
  onUpdateDescription?: (description: string) => void
  onAddField?: (field: Omit<EntityField, 'id'>) => void
  onUpdateField?: (fieldId: string, updates: Partial<EntityField>) => void
  onDeleteField?: (fieldId: string) => void
  onReorderFields?: (fieldIds: string[]) => void
}

type Tab = 'fields' | 'relationships' | 'versions'

// ─── Component ──────────────────────────────────────────────────────────────

export function EntityManagePanel({
  entityId,
  entityName,
  entityDescription = '',
  fields,
  relationships = [],
  versions = [],
  onBack,
  onUpdateDescription,
  onAddField,
  onUpdateField,
  onDeleteField,
}: EntityManagePanelProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('fields')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(entityDescription)
  const [showAddField, setShowAddField] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  // New field form state
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<EntityFieldType>('text')
  const [newFieldDesc, setNewFieldDesc] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldFormula, setNewFieldFormula] = useState('')
  const [newFieldOptions, setNewFieldOptions] = useState<{ value: string; label: string; color?: string }[]>([])
  const [newFieldCurrencyCode, setNewFieldCurrencyCode] = useState('BRL')
  const [newFieldRelationshipEntityId, setNewFieldRelationshipEntityId] = useState('')
  const [newFieldRelationshipEntityName, setNewFieldRelationshipEntityName] = useState('')
  const [newFieldLookupFieldId, setNewFieldLookupFieldId] = useState('')
  const [newFieldRollupFunction, setNewFieldRollupFunction] = useState<string>('count')
  const [newFieldAiPrompt, setNewFieldAiPrompt] = useState('')
  const [newFieldMaxRating, setNewFieldMaxRating] = useState(5)
  const [newFieldDecimalPlaces, setNewFieldDecimalPlaces] = useState(2)

  const resetNewFieldForm = () => {
    setNewFieldName('')
    setNewFieldType('text')
    setNewFieldDesc('')
    setNewFieldRequired(false)
    setNewFieldFormula('')
    setNewFieldOptions([])
    setNewFieldCurrencyCode('BRL')
    setNewFieldRelationshipEntityId('')
    setNewFieldRelationshipEntityName('')
    setNewFieldLookupFieldId('')
    setNewFieldRollupFunction('count')
    setNewFieldAiPrompt('')
    setNewFieldMaxRating(5)
    setNewFieldDecimalPlaces(2)
    setShowAddField(false)
  }

  const handleAddField = () => {
    if (!newFieldName.trim()) return
    const needsOptions = ['select', 'multiselect', 'status', 'priority'].includes(newFieldType)
    onAddField?.({
      name: newFieldName.trim(),
      type: newFieldType,
      description: newFieldDesc.trim() || undefined,
      required: newFieldRequired,
      formula: newFieldType === 'formula' ? newFieldFormula : undefined,
      options: needsOptions && newFieldOptions.length > 0 ? newFieldOptions : undefined,
      currencyCode: newFieldType === 'currency' ? newFieldCurrencyCode : undefined,
      relationshipEntityId: ['relationship', 'lookup', 'rollup'].includes(newFieldType) ? newFieldRelationshipEntityId || undefined : undefined,
      relationshipEntityName: ['relationship', 'lookup', 'rollup'].includes(newFieldType) ? newFieldRelationshipEntityName || undefined : undefined,
      lookupFieldId: newFieldType === 'lookup' ? newFieldLookupFieldId || undefined : undefined,
      rollupFunction: newFieldType === 'rollup' ? newFieldRollupFunction as any : undefined,
      aiPrompt: newFieldType === 'ai' ? newFieldAiPrompt || undefined : undefined,
      maxRating: newFieldType === 'rating' ? newFieldMaxRating : undefined,
      decimalPlaces: ['decimal', 'percent'].includes(newFieldType) ? newFieldDecimalPlaces : undefined,
    })
    resetNewFieldForm()
  }

  const commitDescription = () => {
    onUpdateDescription?.(descriptionValue.trim())
    setEditingDescription(false)
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'fields', label: 'Fields', icon: <Table2 size={14} />, count: fields.length },
    { key: 'relationships', label: 'Relationships', icon: <Link2 size={14} />, count: relationships.length },
    { key: 'versions', label: 'Versions', icon: <History size={14} />, count: versions.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              color: 'var(--text-muted)',
            }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            {entityName}
          </h2>
          {editingDescription ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <input
                autoFocus
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDescription()
                  if (e.key === 'Escape') {
                    setDescriptionValue(entityDescription)
                    setEditingDescription(false)
                  }
                }}
                placeholder="Add a description..."
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: 'var(--text)',
                  border: '1px solid var(--accent)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                }}
              />
              <button onClick={commitDescription} style={iconBtnStyle}><Check size={13} color="var(--accent)" /></button>
              <button onClick={() => { setDescriptionValue(entityDescription); setEditingDescription(false) }} style={iconBtnStyle}><X size={13} /></button>
            </div>
          ) : (
            <p
              onClick={() => setEditingDescription(true)}
              style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: entityDescription ? 'var(--text-muted)' : 'var(--text-muted)',
                cursor: 'pointer',
                opacity: entityDescription ? 1 : 0.6,
              }}
            >
              {entityDescription || t('database.entityManage.addDescription')}
            </p>
          )}
        </div>
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          padding: '2px 8px',
          borderRadius: 10,
        }}>
          ID: {entityId}
        </span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        paddingLeft: 24,
        flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 500 : 400,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'inherit',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: 10,
                background: activeTab === tab.key ? 'var(--accent-light)' : 'var(--surface-2)',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: 10,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          {activeTab === 'fields' && (
            <FieldsTab
              fields={fields}
              showAddField={showAddField}
              onShowAddField={() => setShowAddField(true)}
              editingFieldId={editingFieldId}
              onSetEditingFieldId={setEditingFieldId}
              expandedFieldId={expandedFieldId}
              onSetExpandedFieldId={setExpandedFieldId}
              newFieldName={newFieldName}
              newFieldType={newFieldType}
              newFieldDesc={newFieldDesc}
              newFieldRequired={newFieldRequired}
              newFieldFormula={newFieldFormula}
              newFieldOptions={newFieldOptions}
              newFieldCurrencyCode={newFieldCurrencyCode}
              newFieldAiPrompt={newFieldAiPrompt}
              newFieldMaxRating={newFieldMaxRating}
              newFieldDecimalPlaces={newFieldDecimalPlaces}
              onNewFieldNameChange={setNewFieldName}
              onNewFieldTypeChange={(type) => {
                setNewFieldType(type)
                if (type === 'status' && newFieldOptions.length === 0) {
                  setNewFieldOptions([
                    { value: 'todo', label: 'To Do', color: '#6b7280' },
                    { value: 'in_progress', label: 'In Progress', color: '#d97706' },
                    { value: 'done', label: 'Done', color: '#16a34a' },
                  ])
                } else if (type === 'priority' && newFieldOptions.length === 0) {
                  setNewFieldOptions([
                    { value: 'critical', label: 'Critical', color: '#dc2626' },
                    { value: 'high', label: 'High', color: '#ea580c' },
                    { value: 'medium', label: 'Medium', color: '#d97706' },
                    { value: 'low', label: 'Low', color: '#2563eb' },
                  ])
                } else if (!['select', 'multiselect', 'status', 'priority'].includes(type)) {
                  setNewFieldOptions([])
                }
              }}
              onNewFieldDescChange={setNewFieldDesc}
              onNewFieldRequiredChange={setNewFieldRequired}
              onNewFieldFormulaChange={setNewFieldFormula}
              onNewFieldOptionsChange={setNewFieldOptions}
              onNewFieldCurrencyCodeChange={setNewFieldCurrencyCode}
              onNewFieldAiPromptChange={setNewFieldAiPrompt}
              onNewFieldMaxRatingChange={setNewFieldMaxRating}
              onNewFieldDecimalPlacesChange={setNewFieldDecimalPlaces}
              onNewFieldRelationshipEntityNameChange={setNewFieldRelationshipEntityName}
              newFieldRelationshipEntityName={newFieldRelationshipEntityName}
              onAddField={handleAddField}
              onCancelAdd={resetNewFieldForm}
              onUpdateField={onUpdateField}
              onDeleteField={onDeleteField}
            />
          )}
          {activeTab === 'relationships' && (
            <RelationshipsTab relationships={relationships} />
          )}
          {activeTab === 'versions' && (
            <VersionsTab versions={versions} />
          )}
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    </div>
  )
}

// ─── Field Config Section ───────────────────────────────────────────────────

const PRESET_COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#8b5cf6', '#6b7280', '#ec4899']

const CURRENCY_OPTIONS = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'ARS', 'CLP', 'COP', 'MXN']

interface FieldConfigSectionProps {
  type: EntityFieldType
  options: { value: string; label: string; color?: string }[]
  onOptionsChange: (opts: { value: string; label: string; color?: string }[]) => void
  currencyCode: string
  onCurrencyCodeChange: (code: string) => void
  aiPrompt: string
  onAiPromptChange: (prompt: string) => void
  maxRating: number
  onMaxRatingChange: (max: number) => void
  decimalPlaces: number
  onDecimalPlacesChange: (places: number) => void
  relationshipEntityName: string
  onRelationshipEntityNameChange: (name: string) => void
}

function FieldConfigSection({
  type,
  options,
  onOptionsChange,
  currencyCode,
  onCurrencyCodeChange,
  aiPrompt,
  onAiPromptChange,
  maxRating,
  onMaxRatingChange,
  decimalPlaces,
  onDecimalPlacesChange,
  relationshipEntityName,
  onRelationshipEntityNameChange,
}: FieldConfigSectionProps) {
  const needsOptions = ['select', 'multiselect', 'status', 'priority'].includes(type)

  if (needsOptions) {
    const addOption = () => {
      onOptionsChange([...options, { value: '', label: '', color: PRESET_COLORS[options.length % PRESET_COLORS.length] }])
    }

    const updateOption = (index: number, updates: Partial<{ value: string; label: string; color?: string }>) => {
      const updated = options.map((opt, i) => {
        if (i !== index) return opt
        const newOpt = { ...opt, ...updates }
        if (updates.label !== undefined) {
          newOpt.value = updates.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        }
        return newOpt
      })
      onOptionsChange(updated)
    }

    const removeOption = (index: number) => {
      onOptionsChange(options.filter((_, i) => i !== index))
    }

    const cycleColor = (index: number) => {
      const currentColor = options[index].color || PRESET_COLORS[0]
      const currentIdx = PRESET_COLORS.indexOf(currentColor)
      const nextIdx = (currentIdx + 1) % PRESET_COLORS.length
      updateOption(index, { color: PRESET_COLORS[nextIdx] })
    }

    return (
      <div style={{ marginTop: 12 }}>
        <span style={labelTextStyle}>Options</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => cycleColor(i)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: opt.color || PRESET_COLORS[0],
                  border: '2px solid var(--border)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
                title="Click to change color"
              />
              <input
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                placeholder="Option label"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                style={iconBtnStyle}
                title="Remove option"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: 'fit-content',
            }}
          >
            <Plus size={12} /> Add option
          </button>
        </div>
      </div>
    )
  }

  if (type === 'currency') {
    return (
      <label style={{ ...labelStyle, marginTop: 12 }}>
        <span style={labelTextStyle}>Currency</span>
        <select
          value={currencyCode}
          onChange={(e) => onCurrencyCodeChange(e.target.value)}
          style={inputStyle}
        >
          {CURRENCY_OPTIONS.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </label>
    )
  }

  if (type === 'ai') {
    return (
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>AI Prompt Template</span>
          <textarea
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder="Describe what the AI should generate for this field..."
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 60,
            }}
          />
        </label>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
          Use {'{field_name}'} to reference other fields
        </span>
      </div>
    )
  }

  if (type === 'rating') {
    return (
      <label style={{ ...labelStyle, marginTop: 12, maxWidth: 200 }}>
        <span style={labelTextStyle}>Max Rating</span>
        <input
          type="number"
          min={1}
          max={10}
          value={maxRating}
          onChange={(e) => onMaxRatingChange(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
          style={inputStyle}
        />
      </label>
    )
  }

  if (type === 'decimal' || type === 'percent') {
    return (
      <label style={{ ...labelStyle, marginTop: 12, maxWidth: 200 }}>
        <span style={labelTextStyle}>Decimal Places</span>
        <input
          type="number"
          min={0}
          max={10}
          value={decimalPlaces}
          onChange={(e) => onDecimalPlacesChange(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
          style={inputStyle}
        />
      </label>
    )
  }

  if (['relationship', 'lookup', 'rollup'].includes(type)) {
    return (
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Related Entity Name</span>
          <input
            value={relationshipEntityName}
            onChange={(e) => onRelationshipEntityNameChange(e.target.value)}
            placeholder="e.g. Orders, Products..."
            style={inputStyle}
          />
        </label>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
          Full relationship setup available after the field is created
        </span>
      </div>
    )
  }

  return null
}

// ─── Fields Tab ─────────────────────────────────────────────────────────────

interface FieldsTabProps {
  fields: EntityField[]
  showAddField: boolean
  onShowAddField: () => void
  editingFieldId: string | null
  onSetEditingFieldId: (id: string | null) => void
  expandedFieldId: string | null
  onSetExpandedFieldId: (id: string | null) => void
  newFieldName: string
  newFieldType: EntityFieldType
  newFieldDesc: string
  newFieldRequired: boolean
  newFieldFormula: string
  newFieldOptions: { value: string; label: string; color?: string }[]
  newFieldCurrencyCode: string
  newFieldAiPrompt: string
  newFieldMaxRating: number
  newFieldDecimalPlaces: number
  onNewFieldNameChange: (v: string) => void
  onNewFieldTypeChange: (v: EntityFieldType) => void
  onNewFieldDescChange: (v: string) => void
  onNewFieldRequiredChange: (v: boolean) => void
  onNewFieldFormulaChange: (v: string) => void
  onNewFieldOptionsChange: (v: { value: string; label: string; color?: string }[]) => void
  onNewFieldCurrencyCodeChange: (v: string) => void
  onNewFieldAiPromptChange: (v: string) => void
  onNewFieldMaxRatingChange: (v: number) => void
  onNewFieldDecimalPlacesChange: (v: number) => void
  newFieldRelationshipEntityName: string
  onNewFieldRelationshipEntityNameChange: (v: string) => void
  onAddField: () => void
  onCancelAdd: () => void
  onUpdateField?: (id: string, updates: Partial<EntityField>) => void
  onDeleteField?: (id: string) => void
}

function FieldsTab({
  fields,
  showAddField,
  onShowAddField,
  editingFieldId,
  onSetEditingFieldId,
  expandedFieldId,
  onSetExpandedFieldId,
  newFieldName,
  newFieldType,
  newFieldDesc,
  newFieldRequired,
  newFieldFormula,
  newFieldOptions,
  newFieldCurrencyCode,
  newFieldAiPrompt,
  newFieldMaxRating,
  newFieldDecimalPlaces,
  onNewFieldNameChange,
  onNewFieldTypeChange,
  onNewFieldDescChange,
  onNewFieldRequiredChange,
  onNewFieldFormulaChange,
  onNewFieldOptionsChange,
  onNewFieldCurrencyCodeChange,
  onNewFieldAiPromptChange,
  onNewFieldMaxRatingChange,
  onNewFieldDecimalPlacesChange,
  newFieldRelationshipEntityName,
  onNewFieldRelationshipEntityNameChange,
  onAddField,
  onCancelAdd,
  onUpdateField,
  onDeleteField,
}: FieldsTabProps) {
  const { t } = useTranslation()
  return (
    <div style={{ padding: 24 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
        </span>
        <button
          onClick={onShowAddField}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} /> {t('database.entityManage.addField')}
        </button>
      </div>

      {/* Add field form */}
      {showAddField && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--accent-border)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--text)' }}>{t('database.entityManage.newField')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldName')}</span>
              <input
                autoFocus
                value={newFieldName}
                onChange={(e) => onNewFieldNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddField()
                  if (e.key === 'Escape') onCancelAdd()
                }}
                placeholder={t('database.entityManage.fieldName')}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldType')}</span>
              <select
                value={newFieldType}
                onChange={(e) => onNewFieldTypeChange(e.target.value as EntityFieldType)}
                style={inputStyle}
              >
                {FIELD_TYPE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.types.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>
            <span style={labelTextStyle}>{t('database.entityManage.fieldDescription')}</span>
            <input
              value={newFieldDesc}
              onChange={(e) => onNewFieldDescChange(e.target.value)}
              placeholder={t('database.entityManage.fieldDescriptionPlaceholder')}
              style={inputStyle}
            />
          </label>

          {newFieldType === 'formula' && (
            <label style={{ ...labelStyle, marginTop: 12 }}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldFormula')}</span>
              <input
                value={newFieldFormula}
                onChange={(e) => onNewFieldFormulaChange(e.target.value)}
                placeholder="e.g. {price} * {quantity}"
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
            </label>
          )}

          <FieldConfigSection
            type={newFieldType}
            options={newFieldOptions}
            onOptionsChange={onNewFieldOptionsChange}
            currencyCode={newFieldCurrencyCode}
            onCurrencyCodeChange={onNewFieldCurrencyCodeChange}
            aiPrompt={newFieldAiPrompt}
            onAiPromptChange={onNewFieldAiPromptChange}
            maxRating={newFieldMaxRating}
            onMaxRatingChange={onNewFieldMaxRatingChange}
            decimalPlaces={newFieldDecimalPlaces}
            onDecimalPlacesChange={onNewFieldDecimalPlacesChange}
            relationshipEntityName={newFieldRelationshipEntityName}
            onRelationshipEntityNameChange={onNewFieldRelationshipEntityNameChange}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newFieldRequired}
                onChange={(e) => onNewFieldRequiredChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Required
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={onCancelAdd} style={secondaryBtnStyle}>{t('cancel')}</button>
            <button onClick={onAddField} disabled={!newFieldName.trim()} style={{
              ...primaryBtnStyle,
              opacity: newFieldName.trim() ? 1 : 0.5,
            }}>{t('database.entityManage.addField')}</button>
          </div>
        </div>
      )}

      {/* Field list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 140px 60px 60px 80px',
          gap: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border)',
        }}>
          <span />
          <span>Name</span>
          <span>Type</span>
          <span style={{ textAlign: 'center' }}>Req.</span>
          <span style={{ textAlign: 'center' }}>Uniq.</span>
          <span />
        </div>

        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            isExpanded={expandedFieldId === field.id}
            isEditing={editingFieldId === field.id}
            onToggleExpand={() => onSetExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
            onStartEdit={() => onSetEditingFieldId(field.id)}
            onStopEdit={() => onSetEditingFieldId(null)}
            onUpdate={onUpdateField}
            onDelete={onDeleteField}
          />
        ))}

        {fields.length === 0 && !showAddField && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No fields defined yet. Click "Add Field" to create one.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Field Row ──────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: EntityField
  isExpanded: boolean
  isEditing: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onStopEdit: () => void
  onUpdate?: (id: string, updates: Partial<EntityField>) => void
  onDelete?: (id: string) => void
}

function FieldRow({ field, isExpanded, isEditing, onToggleExpand, onStartEdit, onStopEdit, onUpdate, onDelete }: FieldRowProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [editName, setEditName] = useState(field.name)
  const [editDesc, setEditDesc] = useState(field.description || '')
  const [editType, setEditType] = useState<EntityFieldType>(field.type)
  const [editFormula, setEditFormula] = useState(field.formula || '')
  const [editRequired, setEditRequired] = useState(field.required || false)
  const [editOptions, setEditOptions] = useState<{ value: string; label: string; color?: string }[]>(field.options || [])
  const [editCurrencyCode, setEditCurrencyCode] = useState(field.currencyCode || 'BRL')
  const [editAiPrompt, setEditAiPrompt] = useState(field.aiPrompt || '')
  const [editMaxRating, setEditMaxRating] = useState(field.maxRating || 5)
  const [editDecimalPlaces, setEditDecimalPlaces] = useState(field.decimalPlaces ?? 2)
  const [editRelationshipEntityId, setEditRelationshipEntityId] = useState(field.relationshipEntityId || '')
  const [editRelationshipEntityName, setEditRelationshipEntityName] = useState(field.relationshipEntityName || '')
  const [editLookupFieldId, setEditLookupFieldId] = useState(field.lookupFieldId || '')
  const [editRollupFunction, setEditRollupFunction] = useState(field.rollupFunction || 'count')

  const isSystem = ['created_at', 'updated_at', 'created_by', 'updated_by', 'autonumber'].includes(field.type)

  const commitEdit = () => {
    const needsOptions = ['select', 'multiselect', 'status', 'priority'].includes(editType)
    onUpdate?.(field.id, {
      name: editName.trim() || field.name,
      description: editDesc.trim() || undefined,
      type: editType,
      formula: editType === 'formula' ? editFormula : undefined,
      required: editRequired,
      options: needsOptions && editOptions.length > 0 ? editOptions : undefined,
      currencyCode: editType === 'currency' ? editCurrencyCode : undefined,
      aiPrompt: editType === 'ai' ? editAiPrompt || undefined : undefined,
      maxRating: editType === 'rating' ? editMaxRating : undefined,
      decimalPlaces: ['decimal', 'percent'].includes(editType) ? editDecimalPlaces : undefined,
      relationshipEntityId: ['relationship', 'lookup', 'rollup'].includes(editType) ? editRelationshipEntityId || undefined : undefined,
      relationshipEntityName: ['relationship', 'lookup', 'rollup'].includes(editType) ? editRelationshipEntityName || undefined : undefined,
      lookupFieldId: editType === 'lookup' ? editLookupFieldId || undefined : undefined,
      rollupFunction: editType === 'rollup' ? editRollupFunction as any : undefined,
    })
    onStopEdit()
  }

  const cancelEdit = () => {
    setEditName(field.name)
    setEditDesc(field.description || '')
    setEditType(field.type)
    setEditFormula(field.formula || '')
    setEditRequired(field.required || false)
    setEditOptions(field.options || [])
    setEditCurrencyCode(field.currencyCode || 'BRL')
    setEditAiPrompt(field.aiPrompt || '')
    setEditMaxRating(field.maxRating || 5)
    setEditDecimalPlaces(field.decimalPlaces ?? 2)
    setEditRelationshipEntityId(field.relationshipEntityId || '')
    setEditRelationshipEntityName(field.relationshipEntityName || '')
    setEditLookupFieldId(field.lookupFieldId || '')
    setEditRollupFunction(field.rollupFunction || 'count')
    onStopEdit()
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface)' : 'transparent',
        borderRadius: 6,
        transition: 'background 0.1s',
      }}
    >
      {/* Main row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 140px 60px 60px 80px',
        gap: 8,
        padding: '10px 12px',
        alignItems: 'center',
        cursor: 'pointer',
      }}
        onClick={onToggleExpand}
      >
        <span style={{ display: 'flex', color: 'var(--text-muted)' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{field.name}</span>
          {field.description && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{field.description}</span>
          )}
        </div>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'var(--surface-2)',
          color: 'var(--text-muted)',
          display: 'inline-block',
          width: 'fit-content',
        }}>
          {FIELD_TYPE_LABELS[field.type]}
        </span>
        <span style={{ textAlign: 'center', fontSize: 12, color: field.required ? 'var(--accent)' : 'var(--text-muted)' }}>
          {field.required ? 'Yes' : '-'}
        </span>
        <span style={{ textAlign: 'center', fontSize: 12, color: field.unique ? 'var(--accent)' : 'var(--text-muted)' }}>
          {field.unique ? 'Yes' : '-'}
        </span>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}>
          {!isSystem && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit() }}
                style={iconBtnStyle}
                title={t('database.entityManage.editField')}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(field.name) }}
                style={iconBtnStyle}
                title={t('database.entityManage.copyFieldName')}
              >
                <Copy size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(field.id) }}
                style={{ ...iconBtnStyle, color: 'var(--danger)' }}
                title={t('database.entityManage.deleteField')}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded detail / Edit mode */}
      {isExpanded && !isEditing && (
        <div style={{ padding: '0 12px 12px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <DetailItem label="Type" value={FIELD_TYPE_LABELS[field.type]} />
            {field.defaultValue !== undefined && <DetailItem label="Default" value={field.defaultValue} />}
            {field.formula && <DetailItem label="Formula" value={field.formula} mono />}
            {field.relationshipEntityName && <DetailItem label="Related Entity" value={field.relationshipEntityName} />}
            {field.lookupFieldId && <DetailItem label="Lookup Field" value={field.lookupFieldId} />}
            {field.rollupFunction && <DetailItem label="Rollup" value={field.rollupFunction} />}
            {field.currencyCode && <DetailItem label="Currency" value={field.currencyCode} />}
            {field.aiPrompt && <DetailItem label="AI Prompt" value={field.aiPrompt} />}
            {field.options && field.options.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Options:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {field.options.map((opt) => (
                    <span key={opt.value} style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: opt.color ? `${opt.color}20` : 'var(--surface-2)',
                      color: opt.color || 'var(--text)',
                      border: `1px solid ${opt.color || 'var(--border)'}`,
                    }}>
                      {opt.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditing && (
        <div style={{
          padding: '12px 12px 12px 40px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldName')}</span>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldType')}</span>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as EntityFieldType)}
                style={inputStyle}
              >
                {FIELD_TYPE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.types.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>
            <span style={labelTextStyle}>{t('database.entityManage.fieldDescription')}</span>
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder={t('database.entityManage.fieldDescriptionPlaceholder')}
              style={inputStyle}
            />
          </label>
          {editType === 'formula' && (
            <label style={{ ...labelStyle, marginTop: 12 }}>
              <span style={labelTextStyle}>{t('database.entityManage.fieldFormula')}</span>
              <input
                value={editFormula}
                onChange={(e) => setEditFormula(e.target.value)}
                placeholder="e.g. {price} * {quantity}"
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
            </label>
          )}
          <FieldConfigSection
            type={editType}
            options={editOptions}
            onOptionsChange={setEditOptions}
            currencyCode={editCurrencyCode}
            onCurrencyCodeChange={setEditCurrencyCode}
            aiPrompt={editAiPrompt}
            onAiPromptChange={setEditAiPrompt}
            maxRating={editMaxRating}
            onMaxRatingChange={setEditMaxRating}
            decimalPlaces={editDecimalPlaces}
            onDecimalPlacesChange={setEditDecimalPlaces}
            relationshipEntityName={editRelationshipEntityName}
            onRelationshipEntityNameChange={setEditRelationshipEntityName}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editRequired}
                onChange={(e) => setEditRequired(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Required
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={cancelEdit} style={secondaryBtnStyle}>{t('cancel')}</button>
            <button onClick={commitEdit} style={primaryBtnStyle}>{t('database.entityManage.saveChanges')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail Item ────────────────────────────────────────────────────────────

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{
        fontSize: 12,
        color: 'var(--text)',
        marginTop: 2,
        fontFamily: mono ? 'monospace' : 'inherit',
        background: mono ? 'var(--surface-2)' : undefined,
        padding: mono ? '2px 6px' : undefined,
        borderRadius: mono ? 4 : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

// ─── Relationships Tab ──────────────────────────────────────────────────────

function RelationshipsTab({ relationships }: { relationships: EntityRelationship[] }) {
  const typeLabels: Record<string, string> = {
    one_to_one: '1:1',
    one_to_many: '1:N',
    many_to_many: 'N:N',
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {relationships.length} {relationships.length === 1 ? 'relationship' : 'relationships'}
      </div>

      {relationships.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No relationships defined. Relationships are created when you add a Relationship, Lookup, or Rollup field.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {relationships.map((rel) => (
          <div key={rel.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            {/* Source */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{rel.sourceEntityName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rel.sourceFieldName}</div>
            </div>

            {/* Type badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 12,
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              <ArrowRight size={12} />
              {typeLabels[rel.type] || rel.type}
            </div>

            {/* Target */}
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{rel.targetEntityName}</div>
              {rel.targetFieldName && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rel.targetFieldName}</div>
              )}
            </div>

            {/* Relationship name */}
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}>
              {rel.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Versions Tab ───────────────────────────────────────────────────────────

function VersionsTab({ versions }: { versions: EntityVersion[] }) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        {versions.length} {versions.length === 1 ? 'version' : 'versions'}
      </div>

      {versions.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No version history yet. Changes to entity schema will be tracked here.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
        {/* Timeline line */}
        {versions.length > 1 && (
          <div style={{
            position: 'absolute',
            left: 15,
            top: 24,
            bottom: 24,
            width: 2,
            background: 'var(--border)',
          }} />
        )}

        {versions.map((version, idx) => (
          <div key={version.id} style={{
            display: 'flex',
            gap: 16,
            padding: '12px 0',
            position: 'relative',
          }}>
            {/* Timeline dot */}
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: idx === 0 ? 'var(--accent)' : 'var(--border)',
              border: `2px solid ${idx === 0 ? 'var(--accent)' : 'var(--border)'}`,
              flexShrink: 0,
              marginTop: 4,
              marginLeft: 10,
              zIndex: 1,
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  v{version.version}
                </span>
                <span style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                }}>
                  {version.fieldCount} fields
                </span>
                {idx === 0 && (
                  <span style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    fontWeight: 500,
                  }}>
                    Current
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{version.changes}</p>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                {version.createdBy} &middot; {version.createdAt}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  color: 'var(--text-muted)',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const labelTextStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--surface)',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default EntityManagePanel
