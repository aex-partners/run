import { useMemo, useState } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import type { DataGridProps, GridColumn, GridRow, RowGroup, FilterCondition } from './types'
import { useGridState } from './hooks/useGridState'
import { useSort } from './hooks/useSort'
import { useColumnResize } from './hooks/useColumnResize'
import { GridToolbar } from './parts/GridToolbar'
import { GridHeader } from './parts/GridHeader'
import { GridBody } from './parts/GridBody'
import { BulkActionsBar } from './parts/BulkActionsBar'
import { RowDetailPanel } from './parts/RowDetailPanel'

// Re-export types for backwards compatibility
export type { GridColumnType, GridColumn, GridRow, RowGroup, DataGridProps } from './types'

// Pastel colors for dynamic group-by
const GROUP_COLORS = ['#579bfc', '#00c875', '#a25ddc', '#fdab3d', '#e2445c', '#66ccff', '#9cd326', '#ff642e', '#bb3354', '#225091']

export function DataGrid({
  columns,
  rows,
  onAddRow,
  onAddColumn,
  onCellEdit,
  onDeleteRow,
  onSelectRow,
  selectedRows: selectedRowsProp = [],
  title = 'Data',
  groups: groupsProp,
  onToggleGroup,
  emptyMessage,
  sortConfig: externalSortConfig,
  onSortChange,
  onColumnRename,
  onColumnDelete,
  onColumnInsert,
  onBulkDelete,
  onBulkDuplicate,
  onBulkExport,
  onRowClick,
  groupByColumn: externalGroupBy,
  onGroupByChange: externalGroupByChange,
  filterConfig: externalFilterConfig,
  onFilterChange: externalFilterChange,
  toolbarLeftSlot,
  onAIGenerate,
  onFetchRelationshipRecords,
  workspaceUsers,
}: DataGridProps) {
  const [internalGroupBy, setInternalGroupBy] = useState<string | null>(externalGroupBy ?? null)
  const groupByColumn = externalGroupBy !== undefined ? externalGroupBy : (internalGroupBy ?? undefined)
  const onGroupByChange = externalGroupByChange ?? setInternalGroupBy

  const [internalFilters, setInternalFilters] = useState<FilterCondition[]>(externalFilterConfig ?? [])
  const filterConditions = externalFilterConfig ?? internalFilters
  const onFilterConditionsChange = externalFilterChange ?? setInternalFilters

  const state = useGridState(selectedRowsProp, groupsProp, onToggleGroup)
  const [detailRowId, setDetailRowId] = useState<string | null>(null)

  const idCol = columns[0]?.id

  // Build initial widths from columns
  const initialWidths = useMemo(() => {
    const widths: Record<string, number> = {}
    columns.forEach(col => {
      if (col.width) widths[col.id] = col.width
    })
    return widths
  }, [columns])

  const { getWidth, startResize } = useColumnResize(initialWidths)

  // Merge incoming rows with local edits, and remove deleted rows
  const mergedRows: GridRow[] = rows
    .filter((row) => {
      const rowId = String(row[idCol] ?? row.id ?? '')
      return !state.deletedRowIds.has(rowId)
    })
    .map((row) => {
      const rowId = String(row[idCol] ?? row.id ?? '')
      return state.editedRows[rowId] ? { ...row, ...state.editedRows[rowId] } : row
    })

  // Filter rows: per-field conditions + global text search
  const filteredRows = useMemo(() => {
    let result = mergedRows

    // Apply per-field filter conditions
    if (filterConditions.length > 0) {
      result = result.filter((row) =>
        filterConditions.every((cond) => {
          const val = String(row[cond.columnId] ?? '').toLowerCase()
          const condVal = cond.value.toLowerCase()
          switch (cond.operator) {
            case 'contains': return val.includes(condVal)
            case 'equals': return val === condVal
            case 'gt': return Number(row[cond.columnId]) > Number(cond.value)
            case 'lt': return Number(row[cond.columnId]) < Number(cond.value)
            case 'gte': return Number(row[cond.columnId]) >= Number(cond.value)
            case 'lte': return Number(row[cond.columnId]) <= Number(cond.value)
            case 'isEmpty': return val === ''
            case 'isNotEmpty': return val !== ''
            default: return true
          }
        })
      )
    }

    // Apply global text search on top
    if (state.filterText) {
      result = result.filter((row) =>
        columns.some((col) => {
          const val = String(row[col.id] ?? '')
          return val.toLowerCase().includes(state.filterText.toLowerCase())
        })
      )
    }

    return result
  }, [mergedRows, filterConditions, state.filterText, columns])

  // Sort rows
  const {
    sortConfig,
    sortedRows,
    toggleColumnSort,
    removeSort,
    clearSort,
    getSortDirection,
    getSortIndex,
  } = useSort(filteredRows, externalSortConfig, onSortChange)

  // Generate dynamic groups from groupByColumn
  const { dynamicGroups, groupedRows } = useMemo(() => {
    if (!groupByColumn || groupsProp) {
      return { dynamicGroups: groupsProp, groupedRows: sortedRows }
    }

    // Collect unique values for the grouped column
    const valueSet = new Map<string, number>()
    for (const row of sortedRows) {
      const val = String(row[groupByColumn] ?? '').trim() || '(empty)'
      valueSet.set(val, (valueSet.get(val) ?? 0) + 1)
    }

    const groups: RowGroup[] = Array.from(valueSet.keys()).map((val, i) => ({
      id: val,
      label: val,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }))

    // Tag rows with _groupId
    const tagged = sortedRows.map((row) => {
      const val = String(row[groupByColumn] ?? '').trim() || '(empty)'
      return { ...row, _groupId: val }
    })

    return { dynamicGroups: groups, groupedRows: tagged }
  }, [groupByColumn, groupsProp, sortedRows])

  const visibleRows = groupedRows
  const groups = dynamicGroups

  // Visible columns
  const visibleColumns = columns.filter((col) => !state.hiddenColumns.has(col.id))

  // Selected rows: merge prop and internal
  const allSelectedIds = new Set([...selectedRowsProp, ...state.internalSelected])

  const getRowId = (row: GridRow) => String(row[idCol] ?? row.id ?? '')

  const allVisibleIds = visibleRows.map(getRowId)
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => allSelectedIds.has(id))
  const someVisibleSelected = allVisibleIds.some((id) => allSelectedIds.has(id))

  const commitEdit = (rowId: string, colId: string, col: GridColumn) => {
    const newValue: string | number =
      col.type === 'number' ? (isNaN(Number(state.editValue)) ? state.editValue : Number(state.editValue)) : state.editValue
    state.setEditedRows((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [colId]: newValue },
    }))
    onCellEdit?.(rowId, colId, newValue)
    state.setEditingCell(null)
  }

  const handleCellClick = (rowId: string, col: GridColumn) => {
    if (col.id === idCol || col.type === 'badge') return
    const row = mergedRows.find((r) => getRowId(r) === rowId)
    const currentValue = row ? String(row[col.id] ?? '') : ''
    state.setEditValue(currentValue)
    state.setEditingCell({ rowId, colId: col.id })
  }

  const handleDirectCommit = (rowId: string, colId: string, value: string | number | boolean) => {
    state.setEditedRows((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [colId]: value },
    }))
    onCellEdit?.(rowId, colId, value)
    state.setEditingCell(null)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(state.internalSelected)
      allVisibleIds.forEach((id) => {
        newSelected.add(id)
        onSelectRow?.(id, true)
      })
      state.setInternalSelected(newSelected)
    } else {
      const newSelected = new Set(state.internalSelected)
      allVisibleIds.forEach((id) => {
        newSelected.delete(id)
        onSelectRow?.(id, false)
      })
      state.setInternalSelected(newSelected)
    }
  }

  const handleSelectRow = (rowId: string, checked: boolean) => {
    state.setInternalSelected((prev) => {
      const next = new Set(prev)
      if (checked) { next.add(rowId) } else { next.delete(rowId) }
      return next
    })
    onSelectRow?.(rowId, checked)
  }

  const handleDeleteRow = (rowId: string) => {
    state.setEditingCell(null)
    state.setDeletedRowIds((prev) => new Set([...prev, rowId]))
    state.setRowMenuOpen(null)
    onDeleteRow?.(rowId)
  }

  const handleEditRowMenu = (rowId: string) => {
    state.setRowMenuOpen(null)
    const firstEditableCol = visibleColumns.find(
      (col) => col.id !== idCol && col.type !== 'badge' && col.type !== 'status' && col.type !== 'priority'
    )
    if (!firstEditableCol) return
    const row = mergedRows.find((r) => getRowId(r) === rowId)
    const currentValue = row ? String(row[firstEditableCol.id] ?? '') : ''
    state.setEditValue(currentValue)
    state.setEditingCell({ rowId, colId: firstEditableCol.id })
  }

  const handleRowMenuToggle = (rowId: string) => {
    state.setRowMenuOpen((prev) => (prev === rowId ? null : rowId))
  }

  const handleSortAsc = (colId: string) => {
    const current = getSortDirection(colId)
    if (current === 'asc') {
      removeSort(colId)
    } else {
      // Replace or add asc sort for this column
      const newConfig = sortConfig.filter(s => s.columnId !== colId)
      newConfig.push({ columnId: colId, direction: 'asc' })
      if (onSortChange) onSortChange(newConfig)
      else toggleColumnSort(colId) // fallback
    }
  }

  const handleSortDesc = (colId: string) => {
    const current = getSortDirection(colId)
    if (current === 'desc') {
      removeSort(colId)
    } else {
      const newConfig = sortConfig.filter(s => s.columnId !== colId)
      newConfig.push({ columnId: colId, direction: 'desc' })
      if (onSortChange) onSortChange(newConfig)
      else toggleColumnSort(colId)
    }
  }

  const selectedIds = Array.from(allSelectedIds)
  const detailRow = detailRowId ? mergedRows.find(r => getRowId(r) === detailRowId) ?? null : null

  const _handleRowClickForDetail = (rowId: string, col: GridColumn) => {
    // If clicking on a cell that is not the ID column and not an editable action, open detail panel
    if (onRowClick) {
      onRowClick(rowId)
    }
    handleCellClick(rowId, col)
  }

  const handleClearSelection = () => {
    state.setInternalSelected(new Set())
    allVisibleIds.forEach(id => onSelectRow?.(id, false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <GridToolbar
        title={title}
        recordCount={visibleRows.length}
        filterActive={state.filterActive}
        filterText={state.filterText}
        onFilterToggle={() => {
          state.setFilterActive(!state.filterActive)
          if (state.filterActive) {
            state.setFilterText('')
            onFilterConditionsChange([])
          }
        }}
        onFilterTextChange={state.setFilterText}
        columns={columns}
        hiddenColumns={state.hiddenColumns}
        columnsOpen={state.columnsOpen}
        onColumnsToggle={() => state.setColumnsOpen(!state.columnsOpen)}
        onColumnVisibilityToggle={state.toggleColumn}
        columnsPopoverRef={state.columnsPopoverRef}
        onAddColumn={onAddColumn}
        onAddRow={onAddRow}
        sortConfig={sortConfig}
        onRemoveSort={removeSort}
        onClearSort={clearSort}
        groupByColumn={groupByColumn ?? null}
        onGroupByChange={onGroupByChange}
        filterConditions={filterConditions}
        onFilterConditionsChange={onFilterConditionsChange}
        leftSlot={toolbarLeftSlot}
      />

      <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea.Viewport style={{ height: '100%' }}>
          <div role="table" style={{ minWidth: '100%' }}>
            <GridHeader
              visibleColumns={visibleColumns}
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              onSelectAll={handleSelectAll}
              onAddColumn={onAddColumn}
              getColumnWidth={(colId, defaultWidth) => getWidth(colId, defaultWidth)}
              getSortDirection={getSortDirection}
              getSortIndex={getSortIndex}
              multiSort={sortConfig.length > 1}
              onSort={toggleColumnSort}
              onSortAsc={handleSortAsc}
              onSortDesc={handleSortDesc}
              onHideColumn={state.toggleColumn}
              onStartResize={startResize}
              onColumnRename={onColumnRename ? (colId) => onColumnRename(colId, '') : undefined}
              onColumnDelete={onColumnDelete}
              onColumnInsert={onColumnInsert}
            />

            <GridBody
              visibleRows={visibleRows}
              visibleColumns={visibleColumns}
              idCol={idCol}
              getRowId={getRowId}
              allSelectedIds={allSelectedIds}
              hoveredRow={state.hoveredRow}
              editingCell={state.editingCell}
              editValue={state.editValue}
              rowMenuOpen={state.rowMenuOpen}
              groups={groups}
              collapsedGroups={state.collapsedGroups}
              emptyMessage={emptyMessage}
              onHover={state.setHoveredRow}
              onSelect={handleSelectRow}
              onCellClick={handleCellClick}
              onEditChange={state.setEditValue}
              onEditCommit={commitEdit}
              onEditCancel={() => state.setEditingCell(null)}
              onRowMenuToggle={handleRowMenuToggle}
              onEditRow={handleEditRowMenu}
              onDeleteRow={handleDeleteRow}
              onToggleGroup={state.toggleGroup}
              onAddRow={onAddRow}
              rowMenuRef={state.rowMenuRef}
              getColumnWidth={(colId, defaultWidth) => getWidth(colId, defaultWidth)}
              onDirectCommit={handleDirectCommit}
              onFetchRelationshipRecords={onFetchRelationshipRecords}
              workspaceUsers={workspaceUsers}
              onAIGenerate={onAIGenerate}
            />
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" style={{ height: 8 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
          <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 4 }} />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <BulkActionsBar
        selectedCount={selectedIds.length}
        onDelete={onBulkDelete ? () => onBulkDelete(selectedIds) : undefined}
        onDuplicate={onBulkDuplicate ? () => onBulkDuplicate(selectedIds) : undefined}
        onExport={onBulkExport ? () => onBulkExport(selectedIds) : undefined}
        onClear={handleClearSelection}
      />

      {detailRowId && (
        <RowDetailPanel
          row={detailRow}
          rowId={detailRowId}
          columns={columns}
          onClose={() => setDetailRowId(null)}
          onCellEdit={onCellEdit}
        />
      )}
    </div>
  )
}

export default DataGrid
