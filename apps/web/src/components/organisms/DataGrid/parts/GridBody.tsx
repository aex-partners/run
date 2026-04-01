import React from 'react'
import type { GridColumn, GridRow as GridRowType, RowGroup } from '../types'
import { GridRow } from './GridRow'
import { GroupHeader } from './GroupHeader'
import { InlineNewRow } from './InlineNewRow'

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`

interface GridBodyProps {
  visibleRows: GridRowType[]
  visibleColumns: GridColumn[]
  idCol: string
  getRowId: (row: GridRowType) => string
  allSelectedIds: Set<string>
  hoveredRow: string | null
  editingCell: { rowId: string; colId: string } | null
  editValue: string
  rowMenuOpen: string | null
  groups?: RowGroup[]
  collapsedGroups: Set<string>
  emptyMessage?: string
  getColumnWidth?: (colId: string, defaultWidth: number) => number
  onHover: (id: string | null) => void
  onSelect: (rowId: string, checked: boolean) => void
  onCellClick: (rowId: string, col: GridColumn) => void
  onEditChange: (value: string) => void
  onEditCommit: (rowId: string, colId: string, col: GridColumn) => void
  onEditCancel: () => void
  onRowMenuToggle: (rowId: string) => void
  onEditRow: (rowId: string) => void
  onDeleteRow: (rowId: string) => void
  onToggleGroup: (groupId: string) => void
  onAddRow?: () => void
  rowMenuRef: React.RefObject<HTMLDivElement | null>
  onDirectCommit?: (rowId: string, colId: string, value: string | number | boolean) => void
  onFetchRelationshipRecords?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
  workspaceUsers?: { id: string; name: string; avatar?: string }[]
  onAIGenerate?: (rowId: string, colId: string, prompt: string) => Promise<string>
  onRowDoubleClick?: (rowId: string) => void
  inlineNewRow?: {
    isActive: boolean
    values: Record<string, string>
    onStart: () => void
    onValueChange: (colId: string, value: string) => void
    onCommit: () => void
    onCancel: () => void
  }
}

export function GridBody({
  visibleRows,
  visibleColumns,
  idCol,
  getRowId,
  allSelectedIds,
  hoveredRow,
  editingCell,
  editValue,
  rowMenuOpen,
  groups,
  collapsedGroups,
  emptyMessage,
  onHover,
  onSelect,
  onCellClick,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onRowMenuToggle,
  onEditRow,
  onDeleteRow,
  onToggleGroup,
  onAddRow,
  rowMenuRef,
  getColumnWidth,
  onDirectCommit,
  onFetchRelationshipRecords,
  workspaceUsers,
  onAIGenerate,
  onRowDoubleClick,
  inlineNewRow,
}: GridBodyProps) {
  const showSkeleton = visibleRows.length === 0 && !emptyMessage

  const renderDataRow = (row: GridRowType) => {
    const rowId = getRowId(row)
    return (
      <GridRow
        key={rowId}
        row={row}
        rowId={rowId}
        visibleColumns={visibleColumns}
        idCol={idCol}
        isSelected={allSelectedIds.has(rowId)}
        isHovered={hoveredRow === rowId}
        editingCell={editingCell}
        editValue={editValue}
        rowMenuOpen={rowMenuOpen === rowId}
        onHover={onHover}
        onSelect={onSelect}
        onCellClick={onCellClick}
        onEditChange={onEditChange}
        onEditCommit={onEditCommit}
        onEditCancel={onEditCancel}
        onRowMenuToggle={onRowMenuToggle}
        onEditRow={onEditRow}
        onDeleteRow={onDeleteRow}
        rowMenuRef={rowMenuRef}
        getColumnWidth={getColumnWidth}
        onDirectCommit={onDirectCommit}
        onFetchRelationshipRecords={onFetchRelationshipRecords}
        workspaceUsers={workspaceUsers}
        onAIGenerate={onAIGenerate}
        onDoubleClick={onRowDoubleClick}
      />
    )
  }

  const addRowElement = inlineNewRow ? (
    <InlineNewRow
      visibleColumns={visibleColumns}
      idCol={idCol}
      isActive={inlineNewRow.isActive}
      values={inlineNewRow.values}
      onStart={inlineNewRow.onStart}
      onValueChange={inlineNewRow.onValueChange}
      onCommit={() => {
        inlineNewRow.onCommit()
        onAddRow?.()
      }}
      onCancel={inlineNewRow.onCancel}
      getColumnWidth={getColumnWidth}
    />
  ) : (
    <InlineNewRow
      visibleColumns={visibleColumns}
      idCol={idCol}
      isActive={false}
      values={{}}
      onStart={() => onAddRow?.()}
      onValueChange={() => {}}
      onCommit={() => {}}
      onCancel={() => {}}
      getColumnWidth={getColumnWidth}
    />
  )

  if (showSkeleton) {
    return (
      <>
        <style>{shimmerKeyframes}</style>
        {[0, 1, 2].map(i => (
          <div key={`skeleton-${i}`} role="row" data-testid="skeleton-row" style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '9px 0' }}>
            <div style={{ width: 40, padding: '9px 12px' }} />
            {visibleColumns.map(col => (
              <div key={col.id} style={{ width: col.width || 120, minWidth: col.width || 120, padding: '9px 12px' }}>
                <div style={{
                  height: 14,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, var(--surface-2) 25%, #e8e8e8 50%, var(--surface-2) 75%)',
                  backgroundSize: '400px 100%',
                  animation: 'shimmer 1.5s infinite',
                  animationDelay: `${i * 0.15}s`,
                }} />
              </div>
            ))}
          </div>
        ))}
      </>
    )
  }

  if (visibleRows.length === 0 && emptyMessage) {
    return (
      <div role="row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 12px',
        color: 'var(--text-muted)',
        fontSize: 13,
        borderBottom: '1px solid var(--border)',
      }}>
        {emptyMessage}
      </div>
    )
  }

  if (groups && groups.length > 0) {
    const groupedRowIds = new Set<string>()
    return (
      <>
        {groups.map(group => {
          const groupRows = visibleRows.filter(row => (row as Record<string, unknown>)._groupId === group.id)
          groupRows.forEach(row => groupedRowIds.add(getRowId(row)))
          const isCollapsed = collapsedGroups.has(group.id)
          return (
            <React.Fragment key={group.id}>
              <GroupHeader
                group={group}
                rowCount={groupRows.length}
                isCollapsed={isCollapsed}
                onToggle={onToggleGroup}
              />
              {!isCollapsed && groupRows.map(renderDataRow)}
            </React.Fragment>
          )
        })}
        {visibleRows
          .filter(row => !groupedRowIds.has(getRowId(row)))
          .map(renderDataRow)
        }
        {addRowElement}
      </>
    )
  }

  return (
    <>
      {visibleRows.map(renderDataRow)}
      {addRowElement}
    </>
  )
}
