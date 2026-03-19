export type GridColumnType =
  | 'text'
  | 'number'
  | 'badge'
  | 'date'
  | 'status'
  | 'person'
  | 'currency'
  | 'timeline'
  | 'priority'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'email'
  | 'url'
  | 'phone'
  | 'relationship'
  | 'ai'

export interface SelectOption {
  value: string
  label: string
  color?: string
}

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  columnId: string
  direction: SortDirection
}

export interface FilterCondition {
  columnId: string
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'isNotEmpty'
  value: string
}

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max'

export type ViewType = 'table' | 'kanban' | 'calendar' | 'form'

export interface GridColumn {
  id: string
  label: string
  type: GridColumnType
  width?: number
  statusColors?: Record<string, string>
  currencyCode?: string
  options?: SelectOption[]
  relationshipEntityId?: string
  aiPromptTemplate?: string
}

export interface RowGroup {
  id: string
  label: string
  color: string
  collapsed?: boolean
}

import type React from 'react'

export type GridRow = Record<string, string | number | boolean>

export interface DataGridProps {
  columns: GridColumn[]
  rows: GridRow[]
  onAddRow?: () => void
  onAddColumn?: () => void
  onCellEdit?: (rowId: string, colId: string, value: string | number | boolean) => void
  onDeleteRow?: (rowId: string) => void
  selectedRows?: string[]
  onSelectRow?: (id: string, selected: boolean) => void
  title?: string
  groups?: RowGroup[]
  onToggleGroup?: (groupId: string) => void
  emptyMessage?: string
  // Phase 2+
  onColumnRename?: (colId: string, newLabel: string) => void
  onColumnDelete?: (colId: string) => void
  onColumnInsert?: (position: 'left' | 'right', referenceColId: string) => void
  onColumnTypeChange?: (colId: string, newType: GridColumnType) => void
  sortConfig?: SortConfig[]
  onSortChange?: (config: SortConfig[]) => void
  // Phase 5+
  onBulkDelete?: (rowIds: string[]) => void
  onBulkDuplicate?: (rowIds: string[]) => void
  onBulkStatusChange?: (rowIds: string[], status: string) => void
  onBulkMoveGroup?: (rowIds: string[], groupId: string) => void
  onBulkExport?: (rowIds: string[]) => void
  onRowClick?: (rowId: string) => void
  detailPanelOpen?: boolean
  detailRowId?: string
  // Phase 6+
  filterConfig?: FilterCondition[]
  onFilterChange?: (config: FilterCondition[]) => void
  aggregationConfig?: Record<string, AggregationType>
  // Phase 10+
  onAIGenerate?: (rowId: string, colId: string, prompt: string) => Promise<string>
  groupByColumn?: string
  onGroupByChange?: (colId: string | null) => void
  /** Optional slot rendered at the start of the toolbar (e.g. ViewSwitcher) */
  toolbarLeftSlot?: React.ReactNode
}

export interface CellProps {
  column: GridColumn
  value: string | number | boolean
  rowId: string
  isEditing: boolean
  editValue: string
  onEditChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}
