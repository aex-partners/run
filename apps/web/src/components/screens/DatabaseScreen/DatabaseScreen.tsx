import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataGrid, type GridColumn, type GridRow, type RowGroup } from '../../organisms/DataGrid/DataGrid'
import type { ViewType } from '../../organisms/DataGrid/types'
import { AIChatBar } from '../../molecules/AIChatBar/AIChatBar'
import { ViewSwitcher } from './ViewSwitcher'
import { EntitySidebar } from './EntitySidebar'
import { KanbanBoard } from '../../organisms/KanbanBoard/KanbanBoard'
import { CalendarView } from '../../organisms/CalendarView/CalendarView'
import { FormView } from '../../organisms/FormView/FormView'
import { EntityManagePanel } from '../../organisms/EntityManagePanel/EntityManagePanel'
import type { EntityField, EntityFieldType, EntityRelationship, EntityVersion } from '../../organisms/EntityManagePanel/EntityManagePanel'

export interface DatabaseEntity {
  id: string
  name: string
  count: number
  icon?: React.ReactNode
  color?: string
  iconName?: string
}

export interface EntityFieldData {
  id: string
  name: string
  slug: string
  type: string
}

export interface DatabaseScreenProps {
  entities: DatabaseEntity[]
  activeEntityId?: string
  columns: GridColumn[]
  rows: GridRow[]
  rowsByEntity?: Record<string, GridRow[]>
  entityFields?: EntityFieldData[]
  onEntitySelect?: (id: string) => void
  onNewEntity?: () => void
  onAddRow?: () => void
  onAddColumn?: () => void
  onSelectRow?: (id: string, selected: boolean) => void
  selectedRows?: string[]
  onAISend?: (value: string) => void
  onRenameEntity?: (id: string, name: string) => void
  onDeleteEntity?: (id: string) => void
  onCellEdit?: (rowId: string, colId: string, value: string | number | boolean) => void
  onDeleteRow?: (rowId: string) => void
  groups?: RowGroup[]
  onToggleGroup?: (groupId: string) => void
  /** Hide AI chat bar and view switcher (used in preview/showcase) */
  preview?: boolean
  // Entity manage panel
  entityManageFields?: Record<string, EntityField[]>
  entityManageRelationships?: Record<string, EntityRelationship[]>
  entityManageVersions?: Record<string, EntityVersion[]>
  entityDescriptions?: Record<string, string>
  onManageEntity?: (id: string) => void
  onViewLogs?: (id: string) => void
  onUpdateEntityDescription?: (id: string, description: string) => void
  onAddEntityField?: (entityId: string, field: Omit<EntityField, 'id'>) => void
  onUpdateEntityField?: (entityId: string, fieldId: string, updates: Partial<EntityField>) => void
  onDeleteEntityField?: (entityId: string, fieldId: string) => void
  // DataGrid column operations (Issue #10)
  onColumnRename?: (colId: string, newLabel: string) => void
  onColumnDelete?: (colId: string) => void
  onColumnInsert?: (position: 'left' | 'right', referenceColId: string) => void
  // DataGrid inline new row (Issue #16)
  inlineNewRow?: {
    isActive: boolean
    values: Record<string, string>
    onStart: () => void
    onValueChange: (colId: string, value: string) => void
    onCommit: () => void
    onCancel: () => void
  }
  // DataGrid advanced cell props
  onFetchRelationshipRecords?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
  workspaceUsers?: { id: string; name: string; avatar?: string }[]
  onAIGenerate?: (rowId: string, colId: string, prompt: string) => Promise<string>
}

export function DatabaseScreen({
  entities: entitiesProp,
  activeEntityId: controlledEntityId,
  columns,
  rows,
  rowsByEntity,
  entityFields,
  onEntitySelect,
  onNewEntity,
  onAddRow,
  onAddColumn,
  onSelectRow,
  selectedRows = [],
  onAISend,
  onRenameEntity,
  onDeleteEntity,
  onCellEdit,
  onDeleteRow,
  groups,
  onToggleGroup,
  preview = false,
  entityManageFields,
  entityManageRelationships,
  entityManageVersions,
  entityDescriptions,
  onManageEntity,
  onViewLogs,
  onUpdateEntityDescription,
  onAddEntityField,
  onUpdateEntityField,
  onDeleteEntityField,
  onColumnRename,
  onColumnDelete,
  onColumnInsert,
  inlineNewRow,
  onFetchRelationshipRecords,
  workspaceUsers,
  onAIGenerate,
}: DatabaseScreenProps) {
  const { t } = useTranslation()
  const [entities, setEntities] = useState<DatabaseEntity[]>(entitiesProp)
  const [activeEntityId, setActiveEntityId] = useState<string | undefined>(
    controlledEntityId ?? entitiesProp[0]?.id
  )
  const [searchText, setSearchText] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [activeView, setActiveView] = useState<ViewType>('table')
  const [managingEntityId, setManagingEntityId] = useState<string | null>(null)

  useEffect(() => {
    setEntities(entitiesProp)
  }, [entitiesProp])

  useEffect(() => {
    if (controlledEntityId !== undefined) {
      setActiveEntityId(controlledEntityId)
    }
  }, [controlledEntityId])

  const handleEntitySelect = (id: string) => {
    setActiveEntityId(id)
    onEntitySelect?.(id)
  }

  const activeEntity = entities.find((e) => e.id === activeEntityId)
  const activeRows = rowsByEntity && activeEntityId ? (rowsByEntity[activeEntityId] ?? rows) : rows

  const handleAISend = () => {
    if (aiInput.trim() && onAISend) {
      onAISend(aiInput)
      setAiInput('')
    }
  }

  const handleRenameEntity = (id: string, name: string) => {
    setEntities(prev => prev.map(e => (e.id === id ? { ...e, name } : e)))
    onRenameEntity?.(id, name)
  }

  const handleDeleteEntity = (id: string) => {
    onDeleteEntity?.(id)
    setEntities(prev => {
      const next = prev.filter(e => e.id !== id)
      if (activeEntityId === id) {
        const currentIndex = prev.findIndex(e => e.id === id)
        const nextId = next[currentIndex]?.id ?? next[currentIndex - 1]?.id ?? next[0]?.id
        setActiveEntityId(nextId)
      }
      return next
    })
  }

  const handleManageEntity = (id: string) => {
    setManagingEntityId(id)
    setActiveEntityId(id)
    onManageEntity?.(id)
  }

  const handleViewLogs = (id: string) => {
    onViewLogs?.(id)
  }

  const managingEntity = managingEntityId ? entities.find((e) => e.id === managingEntityId) : null

  // Derive fields from grid columns when entityManageFields is not provided
  const managingFields: EntityField[] = (() => {
    if (!managingEntity) return []
    const explicit = entityManageFields?.[managingEntity.id]
    if (explicit && explicit.length > 0) return explicit
    // Fallback: convert current GridColumn[] to EntityField[]
    return columns.map((col) => ({
      id: col.id,
      name: col.label,
      type: (col.type === 'badge' ? 'status'
        : col.type === 'timeline' ? 'date'
        : col.type) as EntityFieldType,
      currencyCode: col.currencyCode,
      relationshipEntityId: col.relationshipEntityId,
      aiPrompt: col.aiPrompt,
      options: col.options?.map((o) => ({ value: o.value, label: o.label, color: o.color })),
    }))
  })()

  // Find the best column to group kanban by (first status or select column)
  const kanbanGroupCol = columns.find(c => c.type === 'status' || c.type === 'select')
  // Find the best date column for calendar
  const calendarDateCol = columns.find(c => c.type === 'date' || c.type === 'timeline')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <EntitySidebar
        entities={entities}
        activeEntityId={activeEntityId}
        searchText={searchText}
        onSearchChange={setSearchText}
        onEntitySelect={handleEntitySelect}
        onNewEntity={onNewEntity}
        onRenameEntity={handleRenameEntity}
        onDeleteEntity={handleDeleteEntity}
        onManageEntity={handleManageEntity}
        onViewLogs={handleViewLogs}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Entity Manage Panel */}
        {managingEntity && (
          <EntityManagePanel
            entityId={managingEntity.id}
            entityName={managingEntity.name}
            entityDescription={entityDescriptions?.[managingEntity.id]}
            fields={managingFields}
            relationships={entityManageRelationships?.[managingEntity.id]}
            versions={entityManageVersions?.[managingEntity.id]}
            onBack={() => setManagingEntityId(null)}
            onUpdateDescription={(desc) => onUpdateEntityDescription?.(managingEntity.id, desc)}
            onAddField={(field) => onAddEntityField?.(managingEntity.id, field)}
            onUpdateField={(fieldId, updates) => onUpdateEntityField?.(managingEntity.id, fieldId, updates)}
            onDeleteField={(fieldId) => onDeleteEntityField?.(managingEntity.id, fieldId)}
          />
        )}

        {/* View content */}
        {!managingEntity && <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeView === 'table' && (
            <DataGrid
              columns={columns}
              rows={activeRows}
              title={activeEntity?.name || 'Data'}
              emptyMessage={activeRows.length === 0 ? t('database.noRecords') : undefined}
              onAddRow={onAddRow}
              onAddColumn={onAddColumn}
              onCellEdit={onCellEdit}
              onDeleteRow={onDeleteRow}
              onSelectRow={onSelectRow}
              selectedRows={selectedRows}
              groups={groups}
              onToggleGroup={onToggleGroup}
              onColumnRename={onColumnRename}
              onColumnDelete={onColumnDelete}
              onColumnInsert={onColumnInsert}
              inlineNewRow={inlineNewRow}
              onFetchRelationshipRecords={onFetchRelationshipRecords}
              workspaceUsers={workspaceUsers}
              onAIGenerate={onAIGenerate}
              toolbarLeftSlot={
                <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
              }
            />
          )}
          {activeView !== 'table' && (
            <>
              {/* Minimal toolbar for non-table views */}
              <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}>
                <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 8px', borderRadius: 12, border: '1px solid var(--border)' }}>
                  {activeRows.length}
                </span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeView === 'kanban' && kanbanGroupCol && (
                  <KanbanBoard
                    columns={columns}
                    rows={activeRows}
                    groupByColumn={kanbanGroupCol.id}
                  />
                )}
                {activeView === 'kanban' && !kanbanGroupCol && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('database.kanbanEmpty')}
                  </div>
                )}
                {activeView === 'calendar' && calendarDateCol && (
                  <CalendarView
                    columns={columns}
                    rows={activeRows}
                    dateColumnId={calendarDateCol.id}
                  />
                )}
                {activeView === 'calendar' && !calendarDateCol && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('database.calendarEmpty')}
                  </div>
                )}
                {activeView === 'form' && activeEntityId && entityFields && (
                  <FormView
                    entityId={activeEntityId}
                    entityFields={entityFields}
                  />
                )}
                {activeView === 'form' && (!activeEntityId || !entityFields) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                    {t('database.formEmpty')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>}

        {/* AI chat bar */}
        {!preview && !managingEntity && (
          <div
            style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              flexShrink: 0,
            }}
          >
            <AIChatBar
              placeholder={t('ai.dataPlaceholder')}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onSend={handleAISend}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default DatabaseScreen
