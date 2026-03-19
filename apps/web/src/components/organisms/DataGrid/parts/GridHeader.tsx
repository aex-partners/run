import React from 'react'
import { Plus } from 'lucide-react'
import type { GridColumn, SortDirection } from '../types'
import { ColumnHeaderCell } from './ColumnHeaderCell'

interface GridHeaderProps {
  visibleColumns: GridColumn[]
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  onSelectAll: (checked: boolean) => void
  onAddColumn?: () => void
  getColumnWidth: (colId: string, defaultWidth: number) => number
  getSortDirection: (colId: string) => SortDirection | null
  getSortIndex: (colId: string) => number
  multiSort: boolean
  onSort: (colId: string) => void
  onSortAsc: (colId: string) => void
  onSortDesc: (colId: string) => void
  onHideColumn: (colId: string) => void
  onStartResize: (colId: string, startX: number, currentWidth: number) => void
  onColumnRename?: (colId: string) => void
  onColumnDelete?: (colId: string) => void
  onColumnInsert?: (position: 'left' | 'right', referenceColId: string) => void
}

export function GridHeader({
  visibleColumns,
  allVisibleSelected,
  someVisibleSelected,
  onSelectAll,
  onAddColumn,
  getColumnWidth,
  getSortDirection,
  getSortIndex,
  multiSort,
  onSort,
  onSortAsc,
  onSortDesc,
  onHideColumn,
  onStartResize,
  onColumnRename,
  onColumnDelete,
  onColumnInsert,
}: GridHeaderProps) {
  return (
    <div
      role="row"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div role="columnheader" style={{ width: 40, padding: '10px 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={allVisibleSelected}
          ref={(el) => {
            if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
          }}
          onChange={(e) => onSelectAll(e.target.checked)}
          aria-label="Select all rows"
          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
      {visibleColumns.map((col) => {
        const width = getColumnWidth(col.id, col.width || 120)
        return (
          <ColumnHeaderCell
            key={col.id}
            column={col}
            width={width}
            sortDirection={getSortDirection(col.id)}
            sortIndex={getSortIndex(col.id)}
            multiSort={multiSort}
            onSort={() => onSort(col.id)}
            onSortAsc={() => onSortAsc(col.id)}
            onSortDesc={() => onSortDesc(col.id)}
            onHide={() => onHideColumn(col.id)}
            onStartResize={(e) => onStartResize(col.id, e.clientX, width)}
            onRename={onColumnRename ? () => onColumnRename(col.id) : undefined}
            onDelete={onColumnDelete ? () => onColumnDelete(col.id) : undefined}
            onInsertLeft={onColumnInsert ? () => onColumnInsert('left', col.id) : undefined}
            onInsertRight={onColumnInsert ? () => onColumnInsert('right', col.id) : undefined}
          />
        )
      })}
      <div role="columnheader" style={{ width: 40, padding: '10px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={onAddColumn}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 4,
            display: 'flex',
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      {/* Spacer to fill remaining width */}
      <div style={{ flex: 1, minWidth: 0 }} />
    </div>
  )
}
