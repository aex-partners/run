export type GridColumnType =
  | 'text'
  | 'long_text'
  | 'rich_text'
  | 'number'
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'badge'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'status'
  | 'person'
  | 'timeline'
  | 'priority'
  | 'rating'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'email'
  | 'url'
  | 'phone'
  | 'relationship'
  | 'lookup'
  | 'rollup'
  | 'formula'
  | 'autonumber'
  | 'attachment'
  | 'json'
  | 'barcode'
  | 'ai'
  | 'created_at'
  | 'updated_at'
  | 'created_by'
  | 'updated_by'

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

export type ViewType = 'table' | 'list' | 'kanban' | 'calendar' | 'timeline' | 'form' | 'gallery' | 'map' | 'pivot'

export interface GridColumn {
  id: string
  label: string
  type: GridColumnType
  width?: number
  statusColors?: Record<string, string>
  currencyCode?: string
  options?: SelectOption[]
  relationshipEntityId?: string
  aiPrompt?: string
  maxRating?: number
  decimalPlaces?: number
  lookupEntityId?: string
  lookupFieldId?: string
  rollupFunction?: string
  formula?: string
}

export interface RowGroup {
  id: string
  label: string
  color: string
  collapsed?: boolean
}

import type React from 'react'

/**
 * Reserved row key holding a JSON map of relationship chips
 * (`{ [columnId]: { id, label }[] }`). Read by GridRow/RowDetailPanel to seed
 * multi-relation cells; ignored by sort/filter/aggregation since it is not a
 * column id. Not a real column, never rendered directly.
 */
export const REL_REFS_KEY = '__rel_refs__'

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
  /** Inline new row state and callbacks */
  inlineNewRow?: {
    isActive: boolean
    values: Record<string, string>
    onStart: () => void
    onValueChange: (colId: string, value: string) => void
    onCommit: () => void
    onCancel: () => void
  }
  /** Optional slot rendered at the start of the toolbar (e.g. ViewSwitcher) */
  toolbarLeftSlot?: React.ReactNode
  /** Persisted column order (array of column ids). Columns not listed keep their
   *  natural order, appended after the ordered ones. */
  columnOrder?: string[]
  /** Called when the user drags a column to a new position in the columns
   *  popover. Receives the full ordered list of column ids. */
  onColumnReorder?: (orderedIds: string[]) => void
  /** Persisted hidden column ids. When provided, visibility is controlled by the
   *  parent and onColumnVisibilityChange fires on every toggle. */
  hiddenColumnIds?: string[]
  /** Called with the next full list of hidden column ids when a column's
   *  visibility is toggled (controlled mode). */
  onColumnVisibilityChange?: (hiddenIds: string[]) => void
  /** Callback to fetch records from a related entity (for relationship cells) */
  onFetchRelationshipRecords?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
  /** Available workspace users (for person cells) */
  workspaceUsers?: { id: string; name: string; avatar?: string }[]
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
  /** Direct commit for cells that manage their own value (dropdowns, pickers) */
  onDirectCommit?: (value: string | number | boolean) => void
  /** Fetch related entity records (for relationship cells) */
  onFetchRelationshipRecords?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
  /** Resolved {id,label} chips for a relationship cell (seeds multi-relation state) */
  relationshipRefs?: { id: string; label: string }[]
  /** Available workspace users (for person cells) */
  workspaceUsers?: { id: string; name: string; avatar?: string }[]
  /** AI generation callback */
  onAIGenerate?: (rowId: string, colId: string, prompt: string) => Promise<string>
}
